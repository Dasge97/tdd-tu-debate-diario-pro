<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\EditorialRun;
use App\Entity\EditorialSource;
use App\Entity\User;
use App\Entity\WorkerConfig;
use App\Service\Editorial\EditorialRunService;
use App\Service\Editorial\EditorialStore;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Base de las pruebas del motor editorial: base de datos SQLite de pruebas
 * recreada en cada test, con personajes, una fuente y helpers para montar
 * un lote completo.
 */
abstract class EditorialTestCase extends KernelTestCase
{
    protected EntityManagerInterface $em;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        $schema = new SchemaTool($this->em);
        $metadata = $this->em->getMetadataFactory()->getAllMetadata();
        $schema->dropSchema($metadata);
        $schema->createSchema($metadata);

        $config = new WorkerConfig();
        $config->setId(1);
        $this->em->persist($config);
        $this->em->flush();
    }

    protected function store(): EditorialStore
    {
        return self::getContainer()->get(EditorialStore::class);
    }

    protected function runs(): EditorialRunService
    {
        return self::getContainer()->get(EditorialRunService::class);
    }

    /** @return User[] */
    protected function personas(int $count = 6): array
    {
        $specialties = ['economía', 'política', 'ciencia', 'tecnología', 'sociedad', 'ética', 'filosofía', 'medioambiente'];
        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $u = new User();
            $u->setUsername('p' . $i);
            $u->setEmail("p{$i}@test.internal");
            $u->setPasswordHash('x');
            $u->setIsAiPersona(true);
            $u->setPersonaSpecialty($specialties[$i % count($specialties)]);
            $this->em->persist($u);
            $out[] = $u;
        }
        $this->em->flush();
        return $out;
    }

    protected function source(string $slug = 'medio-a', string $origin = 'medio'): EditorialSource
    {
        $s = (new EditorialSource())
            ->setSlug($slug)
            ->setName(strtoupper($slug))
            ->setUrl("https://{$slug}.example/rss")
            ->setOriginType($origin)
            ->setTopics(['política']);
        $this->em->persist($s);
        $this->em->flush();
        return $s;
    }

    protected static function article(string $url, string $title, ?string $agency = null, ?string $publishedAt = '2026-09-20T08:00:00+02:00'): array
    {
        return [
            'url'          => $url,
            'url_hash'     => hash('sha256', $url),
            'title'        => $title,
            'excerpt'      => "Extracto de {$title}",
            'content_hash' => hash('sha256', $title),
            'published_at' => $publishedAt,
            'agency'       => $agency,
        ];
    }

    /**
     * Crea un acontecimiento con una noticia y su dossier "ok".
     *
     * @return array{event_id: int, dossier_id: int, url: string, version: int}
     */
    protected function eventWithDossier(EditorialSource $source, int $n): array
    {
        $url = "https://{$source->getSlug()}.example/noticia-{$n}";
        $saved = $this->store()->upsertArticles($source->getId(), [self::article($url, "Noticia número {$n}")]);
        $event = $this->store()->saveClusters([[
            'title'       => "Acontecimiento {$n}",
            'article_ids' => [$saved[0]['id']],
            'keywords'    => ["clave{$n}"],
        ]])[0];
        $dossier = $this->store()->saveDossier([
            'event_id'       => $event['event_id'],
            'event_version'  => $event['version'],
            'evidence_hash'  => $event['evidence_hash'],
            'prompt_version' => 'dossier-v1',
            'model'          => 'modelo-prueba',
            'status'         => 'ok',
            'data'           => ['facts' => [['text' => "Hecho {$n}", 'refs' => ['E1']]]],
            'evidence'       => [['id' => 'E1', 'article_id' => $saved[0]['id'], 'url' => $url, 'source' => $source->getName()]],
        ]);

        return ['event_id' => $event['event_id'], 'dossier_id' => $dossier['id'], 'url' => $url, 'version' => $event['version']];
    }

    /** Borrador que cumple todas las reglas deterministas. */
    protected static function validDraft(string $url, int $n = 0): array
    {
        return [
            'title'            => "¿Debería aprobarse la medida número {$n} que el Gobierno ha presentado esta semana?",
            'question'         => "¿Estás a favor de que la medida número {$n} se apruebe tal como la ha presentado el Gobierno esta semana?",
            'card_summary'     => str_repeat('Resumen neutral del acontecimiento con los datos principales. ', 3),
            'context'          => implode("\n", ['Qué ha pasado', trim(str_repeat('hecho ', 60)), 'Qué se discute', trim(str_repeat('dilema ', 40)), 'A favor', '• ' . trim(str_repeat('razon ', 25)), '• ' . trim(str_repeat('razon ', 25)), 'En contra', '• ' . trim(str_repeat('objecion ', 25)), '• ' . trim(str_repeat('objecion ', 25)), 'Lo que no se sabe', trim(str_repeat('duda ', 20))]),
            'source_name'      => 'Medio A',
            'source_url'       => $url,
            'sources'          => [['name' => 'Medio A', 'url' => $url]],
            'generation_model' => 'modelo-prueba',
        ];
    }

    /**
     * Ejecución en vivo con N asignaciones validadas, lista para publicar.
     *
     * @param User[] $personas
     */
    protected function liveRunWithValidated(array $personas, int $validated, string $day = '2026-09-21'): EditorialRun
    {
        $source = $this->source('medio-' . bin2hex(random_bytes(3)));
        $started = $this->runs()->start(EditorialRun::MODE_LIVE, $day, 'test', false);
        $run = $started['run'];

        $items = [];
        for ($i = 0; $i < $validated; $i++) {
            $e = $this->eventWithDossier($source, $i);
            $items[] = [
                'slot'       => $i,
                'persona_id' => $personas[$i]->getId(),
                'event_id'   => $e['event_id'],
                'dossier_id' => $e['dossier_id'],
                'status'     => 'validated',
                'draft'      => self::validDraft($e['url'], $i),
            ];
        }
        $this->runs()->saveAssignments($run->getId(), $items);
        return $run;
    }

    protected function countDebates(): int
    {
        return (int) $this->em->getConnection()->fetchOne('SELECT COUNT(*) FROM debates');
    }
}
