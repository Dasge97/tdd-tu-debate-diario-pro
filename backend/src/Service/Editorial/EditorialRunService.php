<?php

declare(strict_types=1);

namespace App\Service\Editorial;

use App\Entity\EditorialAssignment;
use App\Entity\EditorialLlmCall;
use App\Entity\EditorialRun;
use App\Entity\EditorialRunStage;
use App\Entity\User;
use App\Entity\WorkerConfig;
use App\Repository\DebateRepository;
use App\Repository\EditorialAssignmentRepository;
use App\Repository\EditorialDossierRepository;
use App\Repository\EditorialEventRepository;
use App\Repository\EditorialRunRepository;
use App\Repository\EditorialRunStageRepository;
use App\Repository\UserRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Ramsey\Uuid\Uuid;

/** Ciclo de vida de una ejecución del motor V2: bloqueo, etapas, uso y asignaciones. */
class EditorialRunService
{
    /** Minutos sin latido tras los que una ejecución "running" se da por caída. */
    public const LOCK_TTL_MINUTES = 20;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EditorialRunRepository $runs,
        private readonly EditorialRunStageRepository $stages,
        private readonly EditorialAssignmentRepository $assignments,
        private readonly EditorialEventRepository $events,
        private readonly EditorialDossierRepository $dossiers,
        private readonly UserRepository $users,
        private readonly DebateRepository $debates,
        private readonly EditorialConfig $config,
    ) {
    }

    private static function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /**
     * Empieza o reanuda una ejecución.
     *
     * Solo puede haber una ejecución viva a la vez: se bloquea la fila de
     * worker_config mientras se comprueba, así dos arranques simultáneos no
     * pasan los dos. Una ejecución sin latido durante LOCK_TTL_MINUTES se
     * marca como abortada y deja de bloquear.
     *
     * @return array{run: EditorialRun, resumed: bool}
     */
    public function start(string $mode, string $day, string $triggeredBy, bool $resume): array
    {
        if (!in_array($mode, [EditorialRun::MODE_DRY_RUN, EditorialRun::MODE_LIVE], true)) {
            throw new \InvalidArgumentException('modo no válido');
        }
        $editorialDay = \DateTimeImmutable::createFromFormat('!Y-m-d', $day, new \DateTimeZone('UTC'));
        if ($editorialDay === false) {
            throw new \InvalidArgumentException('día editorial no válido');
        }

        return $this->em->wrapInTransaction(function () use ($mode, $editorialDay, $triggeredBy, $resume) {
            $this->em->find(WorkerConfig::class, 1, LockMode::PESSIMISTIC_WRITE);

            $staleBefore = self::now()->modify('-' . self::LOCK_TTL_MINUTES . ' minutes');
            foreach ($this->runs->findBy(['status' => 'running']) as $running) {
                if ($running->getHeartbeatAt() >= $staleBefore) {
                    throw new \RuntimeException('CONFLICT: ya hay una ejecución en marcha (' . $running->getId() . ')');
                }
                $running->setStatus('aborted');
                $running->setError('Sin latido durante ' . self::LOCK_TTL_MINUTES . ' minutos: se da por caída.');
                $running->setFinishedAt(self::now());
            }

            if ($mode === EditorialRun::MODE_LIVE && $this->runs->findOneBy(['editorialDay' => $editorialDay, 'mode' => $mode, 'status' => 'published']) !== null) {
                throw new \RuntimeException('CONFLICT: el día ' . $editorialDay->format('Y-m-d') . ' ya está publicado');
            }

            if ($resume) {
                $previous = $this->runs->createQueryBuilder('r')
                    ->where('r.editorialDay = :day AND r.mode = :mode AND r.status IN (:statuses)')
                    ->setParameter('day', $editorialDay, 'date_immutable')
                    ->setParameter('mode', $mode)
                    ->setParameter('statuses', ['failed', 'aborted', 'incomplete'])
                    ->orderBy('r.startedAt', 'DESC')
                    ->setMaxResults(1)
                    ->getQuery()
                    ->getOneOrNullResult();
                if ($previous instanceof EditorialRun) {
                    $previous->setStatus('running');
                    $previous->setError(null);
                    $previous->setFinishedAt(null);
                    $previous->setHeartbeatAt(self::now());
                    $this->em->flush();
                    return ['run' => $previous, 'resumed' => true];
                }
            }

            $run = new EditorialRun(Uuid::uuid4()->toString());
            $run->setEditorialDay($editorialDay);
            $run->setMode($mode);
            $run->setTriggeredBy(mb_substr($triggeredBy, 0, 20));
            $run->setConfig(EditorialConfig::withoutSecrets($this->config->forWorker()));
            $this->em->persist($run);
            $this->em->flush();

            return ['run' => $run, 'resumed' => false];
        });
    }

    public function get(string $runId): EditorialRun
    {
        $run = $this->runs->find($runId);
        if ($run === null) {
            throw new \RuntimeException('NOT_FOUND: ejecución no encontrada');
        }
        return $run;
    }

    private function running(string $runId): EditorialRun
    {
        $run = $this->get($runId);
        if (!$run->isRunning()) {
            throw new \RuntimeException('CONFLICT: la ejecución ya no está en marcha (' . $run->getStatus() . ')');
        }
        return $run;
    }

    public function heartbeat(string $runId): void
    {
        $this->running($runId)->setHeartbeatAt(self::now());
        $this->em->flush();
    }

    public function recordStage(string $runId, array $data): void
    {
        $run = $this->running($runId);
        $name = mb_substr((string) ($data['name'] ?? ''), 0, 40);
        if ($name === '') {
            throw new \InvalidArgumentException('falta el nombre de la etapa');
        }
        $stage = $this->stages->findOneBy(['run' => $run, 'name' => $name]);
        if ($stage === null) {
            $stage = (new EditorialRunStage())->setRun($run)->setName($name)->setAttempts(0);
            $this->em->persist($stage);
        }
        $status = (string) ($data['status'] ?? 'running');
        if ($status === 'running') {
            $stage->setAttempts($stage->getAttempts() + 1);
            $stage->setStartedAt(self::now());
            $stage->setFinishedAt(null);
            $stage->setError(null);
        } else {
            $stage->setFinishedAt(self::now());
            $stage->setAttempts(max(1, $stage->getAttempts()));
        }
        $stage->setStatus($status);
        if (isset($data['metrics']) && is_array($data['metrics'])) {
            $stage->setMetrics($data['metrics']);
        }
        if (array_key_exists('error', $data)) {
            $stage->setError($data['error'] !== null ? mb_substr((string) $data['error'], 0, 4000) : null);
        }
        $run->setHeartbeatAt(self::now());
        $this->em->flush();
    }

    public function recordLlmCalls(string $runId, array $calls): int
    {
        $run = $this->get($runId);
        $n = 0;
        foreach ($calls as $c) {
            $call = (new EditorialLlmCall())
                ->setRun($run)
                ->setStage(mb_substr((string) ($c['stage'] ?? ''), 0, 40))
                ->setPurpose(mb_substr((string) ($c['purpose'] ?? ''), 0, 40))
                ->setReference(isset($c['reference']) ? mb_substr((string) $c['reference'], 0, 60) : null)
                ->setProvider(mb_substr((string) ($c['provider'] ?? EditorialConfig::PROVIDER), 0, 40))
                ->setModel(mb_substr((string) ($c['model'] ?? ''), 0, 80))
                ->setPromptVersion(mb_substr((string) ($c['prompt_version'] ?? ''), 0, 40))
                ->setInputTokens(self::intOrNull($c['input_tokens'] ?? null))
                ->setOutputTokens(self::intOrNull($c['output_tokens'] ?? null))
                ->setCachedTokens(self::intOrNull($c['cached_tokens'] ?? null))
                ->setInputChars((int) ($c['input_chars'] ?? 0))
                ->setDurationMs((int) ($c['duration_ms'] ?? 0))
                ->setAttempt((int) ($c['attempt'] ?? 1))
                ->setStatus(mb_substr((string) ($c['status'] ?? 'ok'), 0, 20))
                ->setError(isset($c['error']) ? mb_substr((string) $c['error'], 0, 4000) : null);
            $this->em->persist($call);
            $n++;
        }
        $this->em->flush();
        return $n;
    }

    private static function intOrNull(mixed $v): ?int
    {
        return is_numeric($v) ? (int) $v : null;
    }

    /**
     * Crea o actualiza asignaciones por número de slot. Un slot publicado ya no
     * se toca.
     */
    public function saveAssignments(string $runId, array $items): array
    {
        $run = $this->running($runId);
        $out = [];

        foreach ($items as $item) {
            $slot = (int) ($item['slot'] ?? -1);
            if ($slot < 0) {
                throw new \InvalidArgumentException('slot no válido');
            }
            $assignment = $this->assignments->findOneBy(['run' => $run, 'slot' => $slot]);

            if ($assignment === null) {
                $persona = $this->users->find((int) ($item['persona_id'] ?? 0));
                if (!$persona instanceof User || !$persona->isAiPersona()) {
                    throw new \InvalidArgumentException('el personaje de la asignación no es un personaje IA');
                }
                $event = $this->events->find((int) ($item['event_id'] ?? 0));
                $dossier = $this->dossiers->find((int) ($item['dossier_id'] ?? 0));
                if ($event === null || $dossier === null || $dossier->getEvent()->getId() !== $event->getId()) {
                    throw new \InvalidArgumentException('acontecimiento o dossier no válidos para la asignación');
                }
                if (!in_array($dossier->getStatus(), ['ok', 'background'], true)) {
                    throw new \InvalidArgumentException('no se puede asignar un acontecimiento con evidencia insuficiente');
                }
                $assignment = (new EditorialAssignment())
                    ->setRun($run)
                    ->setEditorialDay($run->getEditorialDay())
                    ->setSlot($slot)
                    ->setPersona($persona)
                    ->setEvent($event)
                    ->setEventVersion($dossier->getEventVersion())
                    ->setDossier($dossier);
                $this->em->persist($assignment);
            } elseif ($assignment->getStatus() === 'published') {
                $out[] = self::assignmentView($assignment);
                continue;
            }

            if (isset($item['scores']) && is_array($item['scores'])) {
                $assignment->setScores($item['scores']);
            }
            if (isset($item['reasons']) && is_array($item['reasons'])) {
                $assignment->setReasons($item['reasons']);
            }
            if (isset($item['status'])) {
                $status = (string) $item['status'];
                if (!in_array($status, ['planned', 'generated', 'validated', 'rejected'], true)) {
                    throw new \InvalidArgumentException('estado de asignación no válido');
                }
                $assignment->setStatus($status);
            }
            if (array_key_exists('draft', $item)) {
                $assignment->setDraft(is_array($item['draft']) ? $item['draft'] : null);
            }
            if (array_key_exists('review', $item)) {
                $assignment->setReview(is_array($item['review']) ? $item['review'] : null);
            }
            if (array_key_exists('rejection_reason', $item)) {
                $assignment->setRejectionReason($item['rejection_reason'] !== null ? mb_substr((string) $item['rejection_reason'], 0, 4000) : null);
            }
            $out[] = $assignment;
        }

        $run->setHeartbeatAt(self::now());
        $this->em->flush();

        return array_map(static fn($a) => $a instanceof EditorialAssignment ? self::assignmentView($a) : $a, $out);
    }

    public function finish(string $runId, string $status, ?array $metrics, ?string $error): EditorialRun
    {
        $run = $this->get($runId);
        if (!in_array($status, ['completed', 'incomplete', 'failed'], true)) {
            throw new \InvalidArgumentException('estado final no válido');
        }
        // Un lote publicado no se puede rebajar a fallido por un error posterior del cliente.
        if ($run->getStatus() !== 'published') {
            $run->setStatus($status);
            $run->setError($error !== null ? mb_substr($error, 0, 4000) : null);
        }
        if ($metrics !== null) {
            $run->setMetrics($metrics);
        }
        $run->setFinishedAt($run->getFinishedAt() ?? self::now());
        $this->em->flush();
        return $run;
    }

    /** Estado completo de una ejecución, para reanudarla o enseñarla en el panel. */
    public function describe(string $runId): array
    {
        $run = $this->get($runId);
        return [
            'run'         => self::runView($run),
            'stages'      => array_map(static fn(EditorialRunStage $s) => [
                'name'        => $s->getName(),
                'status'      => $s->getStatus(),
                'attempts'    => $s->getAttempts(),
                'metrics'     => $s->getMetrics(),
                'error'       => $s->getError(),
                'started_at'  => $s->getStartedAt()->format(\DateTimeInterface::ATOM),
                'finished_at' => $s->getFinishedAt()?->format(\DateTimeInterface::ATOM),
            ], $this->stages->findBy(['run' => $run], ['id' => 'ASC'])),
            'assignments' => array_map(
                static fn(EditorialAssignment $a) => self::assignmentView($a),
                $this->assignments->findBy(['run' => $run], ['slot' => 'ASC'])
            ),
        ];
    }

    public static function runView(EditorialRun $run): array
    {
        return [
            'id'              => $run->getId(),
            'editorial_day'   => $run->getEditorialDay()->format('Y-m-d'),
            'mode'            => $run->getMode(),
            'status'          => $run->getStatus(),
            'triggered_by'    => $run->getTriggeredBy(),
            'published_count' => $run->getPublishedCount(),
            'metrics'         => $run->getMetrics(),
            'error'           => $run->getError(),
            'started_at'      => $run->getStartedAt()->format(\DateTimeInterface::ATOM),
            'finished_at'     => $run->getFinishedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }

    public static function assignmentView(EditorialAssignment $a): array
    {
        return [
            'id'               => $a->getId(),
            'slot'             => $a->getSlot(),
            'persona_id'       => $a->getPersona()->getId(),
            'persona_username' => $a->getPersona()->getUsername(),
            'event_id'         => $a->getEvent()->getId(),
            'event_version'    => $a->getEventVersion(),
            'dossier_id'       => $a->getDossier()->getId(),
            'status'           => $a->getStatus(),
            'scores'           => $a->getScores(),
            'reasons'          => $a->getReasons(),
            'draft'            => $a->getDraft(),
            'review'           => $a->getReview(),
            'rejection_reason' => $a->getRejectionReason(),
            'debate_id'        => $a->getDebate()?->getId(),
        ];
    }

    /**
     * Personajes con lo que el motor necesita: especialidad, rasgos, carácter
     * (cómo habla) y días desde su último debate. No se mandan la bio ni "qué
     * representa", porque llevan postura y el debate tiene que ser neutral.
     */
    public function personas(): array
    {
        $now = self::now();
        $out = [];
        foreach ($this->users->findAiPersonas() as $persona) {
            $last = $this->debates->findLastDateByPersona($persona);
            $out[] = [
                'id'           => $persona->getId(),
                'username'     => $persona->getUsername(),
                'display_name' => $persona->getDisplayName() ?? $persona->getUsername(),
                'specialty'    => $persona->getPersonaSpecialty(),
                'traits'       => $persona->getProfileTraits() ?? [],
                // Cómo habla el personaje. Es tono, no postura: la redacción le exige neutralidad.
                'voice'        => $persona->getPersonaSheet()['personalidad'] ?? null,
                'days_since'   => $last !== null ? (int) (new \DateTimeImmutable($last->format('Y-m-d')))->diff($now)->days : null,
            ];
        }
        return $out;
    }

    /** Debates recientes (de cualquier motor) para no repetir acontecimientos ni temas. */
    public function recentPublished(int $days): array
    {
        $since = self::now()->modify("-{$days} days")->format('Y-m-d');
        $rows = $this->debates->createQueryBuilder('d')
            ->select('d.id', 'd.title', 'd.question', 'd.dayDate', 'IDENTITY(d.editorialEvent) AS event_id', 'd.editorialEventVersion AS event_version', 'IDENTITY(d.createdBy) AS persona_id')
            ->where('d.dayDate >= :since')
            ->andWhere("d.authorType = 'ai'")
            ->setParameter('since', $since)
            ->orderBy('d.dayDate', 'DESC')
            ->getQuery()
            ->getArrayResult();

        return array_map(static fn(array $r) => [
            'debate_id'     => (int) $r['id'],
            'title'         => $r['title'],
            'question'      => $r['question'],
            'day_date'      => $r['dayDate'] instanceof \DateTimeInterface ? $r['dayDate']->format('Y-m-d') : (string) $r['dayDate'],
            'event_id'      => $r['event_id'] !== null ? (int) $r['event_id'] : null,
            'event_version' => $r['event_version'] !== null ? (int) $r['event_version'] : null,
            'persona_id'    => (int) $r['persona_id'],
        ], $rows);
    }
}
