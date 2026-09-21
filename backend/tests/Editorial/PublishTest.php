<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\EditorialRun;
use App\Service\Editorial\EditorialPublisher;

/** Publicación del lote: todo o nada, sin duplicados aunque se repita. */
class PublishTest extends EditorialTestCase
{
    private function publisher(): EditorialPublisher
    {
        return self::getContainer()->get(EditorialPublisher::class);
    }

    public function testPublicaElLoteCompletoConTrazabilidad(): void
    {
        $personas = $this->personas(6);
        $run = $this->liveRunWithValidated($personas, 5);

        $result = $this->publisher()->publish($run->getId());

        self::assertSame('published', $result['status']);
        self::assertSame(5, $result['created']);
        self::assertSame(5, $this->countDebates());

        $row = $this->em->getConnection()->fetchAssociative('SELECT * FROM debates ORDER BY id LIMIT 1');
        self::assertNotNull($row['editorial_event_id']);
        self::assertSame('2026-09-21', substr((string) $row['day_date'], 0, 10));
        self::assertStringStartsWith('2026-09-21:', $row['editorial_key']);
        self::assertNotEmpty(json_decode($row['fact_snapshot'], true)['data']['facts']);
    }

    public function testRepetirLaPublicacionNoDuplica(): void
    {
        $personas = $this->personas(6);
        $run = $this->liveRunWithValidated($personas, 5);

        $this->publisher()->publish($run->getId());
        $again = $this->publisher()->publish($run->getId());

        self::assertTrue($again['already_published']);
        self::assertSame(0, $again['created']);
        self::assertSame(5, $this->countDebates());
    }

    public function testUnLoteIncompletoNoPublicaNada(): void
    {
        $personas = $this->personas(6);
        $run = $this->liveRunWithValidated($personas, 4);

        try {
            $this->publisher()->publish($run->getId());
            self::fail('Debía rechazar un lote de 4');
        } catch (\RuntimeException $e) {
            self::assertStringContainsString('CONFLICT', $e->getMessage());
        }
        self::assertSame(0, $this->countDebates());
    }

    public function testSiUnBorradorFallaNoSeConfirmaNingunDebate(): void
    {
        $personas = $this->personas(6);
        $run = $this->liveRunWithValidated($personas, 5);

        // El quinto borrador cita una URL que no está en su evidencia.
        $this->runs()->saveAssignments($run->getId(), [[
            'slot'  => 4,
            'draft' => ['source_url' => 'https://inventada.example/x'] + self::validDraft('https://inventada.example/x', 4),
        ]]);

        try {
            $this->publisher()->publish($run->getId());
            self::fail('Debía rechazar el lote');
        } catch (\InvalidArgumentException $e) {
            self::assertStringContainsString('evidencia recuperada', $e->getMessage());
        }
        // Los cuatro primeros eran válidos y aun así no se ha guardado ninguno.
        self::assertSame(0, $this->countDebates());
    }

    public function testUnaPruebaNoPublica(): void
    {
        $this->personas(6);
        $run = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];

        $this->expectExceptionMessage('una ejecución de prueba no publica');
        $this->publisher()->publish($run->getId());
    }

    public function testUnPersonajeNoPublicaDosVecesElMismoDia(): void
    {
        $personas = $this->personas(6);
        $first = $this->liveRunWithValidated($personas, 5);
        $this->publisher()->publish($first->getId());

        // Otra ejecución en vivo del mismo día queda bloqueada de entrada.
        $this->expectExceptionMessage('ya está publicado');
        $this->runs()->start(EditorialRun::MODE_LIVE, '2026-09-21', 'test', false);
    }
}
