<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\EditorialRun;

/** Exclusión de ejecuciones simultáneas, recuperación de bloqueos y reanudación. */
class RunLockTest extends EditorialTestCase
{
    public function testNoPuedenArrancarDosEjecucionesALaVez(): void
    {
        $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false);

        $this->expectExceptionMessage('ya hay una ejecución en marcha');
        $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false);
    }

    public function testUnBloqueoSinLatidoCaducaYSeAborta(): void
    {
        $old = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];
        $old->setHeartbeatAt(new \DateTimeImmutable('-2 hours', new \DateTimeZone('UTC')));
        $this->em->flush();

        $new = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];

        self::assertNotSame($old->getId(), $new->getId());
        self::assertSame('aborted', $this->runs()->get($old->getId())->getStatus());
    }

    public function testReanudaLaEjecucionFallidaDelMismoDia(): void
    {
        $first = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];
        $this->runs()->recordStage($first->getId(), ['name' => 'ingest', 'status' => 'done', 'metrics' => ['articles' => 10]]);
        $this->runs()->finish($first->getId(), 'failed', null, 'se cayó la red');

        $resumed = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', true);

        self::assertTrue($resumed['resumed']);
        self::assertSame($first->getId(), $resumed['run']->getId());
        $stages = $this->runs()->describe($first->getId())['stages'];
        self::assertSame('done', $stages[0]['status']);
    }

    public function testUnaEjecucionTerminadaNoAceptaMasEscrituras(): void
    {
        $run = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];
        $this->runs()->finish($run->getId(), 'completed', null, null);

        $this->expectExceptionMessage('ya no está en marcha');
        $this->runs()->recordStage($run->getId(), ['name' => 'ingest', 'status' => 'running']);
    }

    public function testNoSeAsignaUnAcontecimientoConEvidenciaInsuficiente(): void
    {
        $personas = $this->personas(1);
        $source = $this->source();
        $saved = $this->store()->upsertArticles($source->getId(), [self::article('https://medio-a.example/solo-titular', 'Solo un titular')]);
        $event = $this->store()->saveClusters([['title' => 'x', 'article_ids' => [$saved[0]['id']]]])[0];
        $dossier = $this->store()->saveDossier([
            'event_id' => $event['event_id'], 'evidence_hash' => $event['evidence_hash'],
            'prompt_version' => 'dossier-v1', 'model' => 'm', 'status' => 'insufficient',
        ]);
        $run = $this->runs()->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];

        $this->expectExceptionMessage('evidencia insuficiente');
        $this->runs()->saveAssignments($run->getId(), [[
            'slot' => 0, 'persona_id' => $personas[0]->getId(),
            'event_id' => $event['event_id'], 'dossier_id' => $dossier['id'],
        ]]);
    }
}
