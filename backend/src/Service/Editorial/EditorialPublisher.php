<?php

declare(strict_types=1);

namespace App\Service\Editorial;

use App\Entity\Debate;
use App\Entity\EditorialAssignment;
use App\Entity\EditorialRun;
use App\Repository\DebateRepository;
use App\Repository\EditorialAssignmentRepository;
use App\Repository\EditorialRunRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Publica el lote de una ejecución.
 *
 * Todo o nada: o se crean los N debates del día en una transacción, o no se
 * crea ninguno. Repetir la llamada (por un timeout, por ejemplo) devuelve lo
 * ya publicado sin duplicar.
 */
class EditorialPublisher
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EditorialRunRepository $runs,
        private readonly EditorialAssignmentRepository $assignments,
        private readonly DebateRepository $debates,
        private readonly DebateDraftValidator $validator,
    ) {
    }

    public static function editorialKey(\DateTimeInterface $day, int $personaId): string
    {
        return $day->format('Y-m-d') . ':' . $personaId;
    }

    /**
     * @return array{status: string, created: int, debate_ids: int[], already_published: bool}
     */
    public function publish(string $runId): array
    {
        return $this->em->wrapInTransaction(function () use ($runId): array {
            $run = $this->em->find(EditorialRun::class, $runId, LockMode::PESSIMISTIC_WRITE);
            if ($run === null) {
                throw new \RuntimeException('NOT_FOUND: ejecución no encontrada');
            }
            if ($run->isDryRun()) {
                throw new \RuntimeException('CONFLICT: una ejecución de prueba no publica');
            }

            $published = $this->assignments->findBy(['run' => $run, 'status' => 'published'], ['slot' => 'ASC']);
            if ($run->getStatus() === 'published') {
                return [
                    'status'            => 'published',
                    'created'           => 0,
                    'debate_ids'        => array_map(static fn(EditorialAssignment $a) => $a->getDebate()?->getId(), $published),
                    'already_published' => true,
                ];
            }
            if (!$run->isRunning()) {
                throw new \RuntimeException('CONFLICT: la ejecución no está en marcha (' . $run->getStatus() . ')');
            }

            $target = (int) ($run->getConfig()['target_debates'] ?? 5);
            $candidates = $this->assignments->findBy(['run' => $run, 'status' => 'validated'], ['slot' => 'ASC']);
            $batch = $this->pickBatch($candidates, $target);
            if (count($batch) < $target) {
                throw new \RuntimeException(sprintf(
                    'CONFLICT: hay %d debates válidos de %d; no se publica un lote incompleto',
                    count($batch),
                    $target
                ));
            }

            $day = $run->getEditorialDay();
            $dedupDays = (int) ($run->getConfig()['dedup_days'] ?? 14);
            $ids = [];

            foreach ($batch as $assignment) {
                $persona = $assignment->getPersona();
                $event = $assignment->getEvent();
                $key = self::editorialKey($day, $persona->getId());

                if ($this->debates->findOneBy(['editorialKey' => $key]) !== null) {
                    throw new \RuntimeException("CONFLICT: {$persona->getUsername()} ya tiene debate el " . $day->format('Y-m-d'));
                }
                if (!$persona->isAiPersona()) {
                    throw new \RuntimeException('CONFLICT: asignación con un usuario que no es personaje IA');
                }
                // El mismo acontecimiento solo vuelve si ha cambiado su evidencia desde la última publicación.
                if ($event->getLastPublishedAt() !== null
                    && $event->getLastPublishedAt() > new \DateTimeImmutable("-{$dedupDays} days")
                    && $event->getLastPublishedVersion() === $assignment->getEventVersion()) {
                    throw new \RuntimeException("CONFLICT: el acontecimiento {$event->getId()} ya se publicó en esta versión");
                }

                $draft = $assignment->getDraft() ?? [];
                $evidenceUrls = array_values(array_filter(array_map(
                    static fn(array $e) => $e['url'] ?? null,
                    $assignment->getDossier()->getEvidence()
                )));
                $errors = $this->validator->validate($draft, $evidenceUrls);
                if ($errors !== []) {
                    throw new \InvalidArgumentException("borrador de {$persona->getUsername()} no válido: " . implode('; ', $errors));
                }

                $debate = new Debate();
                $debate->setTitle(trim($draft['title']));
                $debate->setQuestion(trim($draft['question']));
                $debate->setCardSummary(trim($draft['card_summary']));
                $debate->setContext(trim($draft['context']));
                $debate->setSourceName(mb_substr(trim($draft['source_name']), 0, 255));
                $debate->setSourceUrl($draft['source_url']);
                $debate->setSources($draft['sources'] ?? null);
                $debate->setDayDate(\DateTime::createFromImmutable($day));
                $debate->setPublishedAt(new \DateTime('now', new \DateTimeZone('UTC')));
                $debate->setCreatedBy($persona);
                $debate->setAuthorType('ai');
                $debate->setGenerationModel(mb_substr((string) ($draft['generation_model'] ?? ''), 0, 180) ?: null);
                $debate->setEditorialEvent($event);
                $debate->setEditorialEventVersion($assignment->getEventVersion());
                $debate->setEditorialKey($key);
                $debate->setFactSnapshot([
                    'dossier_id' => $assignment->getDossier()->getId(),
                    'data'       => $assignment->getDossier()->getData(),
                    'evidence'   => $assignment->getDossier()->getEvidence(),
                ]);
                $this->em->persist($debate);

                $assignment->setDebate($debate);
                $assignment->setStatus('published');
                $event->setLastPublishedAt(new \DateTimeImmutable('now', new \DateTimeZone('UTC')));
                $event->setLastPublishedVersion($assignment->getEventVersion());
            }

            $run->setStatus('published');
            $run->setPublishedCount(count($batch));
            $run->setFinishedAt(new \DateTimeImmutable('now', new \DateTimeZone('UTC')));
            $this->em->flush();

            foreach ($batch as $assignment) {
                $ids[] = $assignment->getDebate()->getId();
            }

            return ['status' => 'published', 'created' => count($ids), 'debate_ids' => $ids, 'already_published' => false];
        });
    }

    /**
     * Elige los primeros N validados con personajes y acontecimientos distintos.
     *
     * @param EditorialAssignment[] $candidates
     * @return EditorialAssignment[]
     */
    private function pickBatch(array $candidates, int $target): array
    {
        $batch = [];
        $personas = [];
        $events = [];
        foreach ($candidates as $a) {
            $p = $a->getPersona()->getId();
            $e = $a->getEvent()->getId();
            if (isset($personas[$p]) || isset($events[$e])) {
                continue;
            }
            $personas[$p] = true;
            $events[$e] = true;
            $batch[] = $a;
            if (count($batch) === $target) {
                break;
            }
        }
        return $batch;
    }
}
