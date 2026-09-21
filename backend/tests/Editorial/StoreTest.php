<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

/** Noticias, acontecimientos, versiones y caché de dossiers. */
class StoreTest extends EditorialTestCase
{
    public function testLaMismaUrlNoSeGuardaDosVeces(): void
    {
        $source = $this->source();
        $item = self::article('https://medio-a.example/n1', 'Titular');

        $first = $this->store()->upsertArticles($source->getId(), [$item]);
        $second = $this->store()->upsertArticles($source->getId(), [$item]);

        self::assertSame('created', $first[0]['status']);
        self::assertSame('unchanged', $second[0]['status']);
        self::assertSame($first[0]['id'], $second[0]['id']);
    }

    public function testUnaFechaDesconocidaSigueDesconocida(): void
    {
        $source = $this->source();
        $saved = $this->store()->upsertArticles($source->getId(), [self::article('https://medio-a.example/sin-fecha', 'Sin fecha', null, null)]);

        $row = $this->em->getConnection()->fetchAssociative('SELECT published_at, fetched_at FROM editorial_articles WHERE id = ?', [$saved[0]['id']]);
        self::assertNull($row['published_at']);
        self::assertNotNull($row['fetched_at']);
    }

    public function testLaVersionSoloSubeSiCambiaLaEvidencia(): void
    {
        $source = $this->source();
        $a = $this->store()->upsertArticles($source->getId(), [self::article('https://medio-a.example/a', 'A')])[0];

        $v1 = $this->store()->saveClusters([['title' => 'Suceso', 'article_ids' => [$a['id']]]])[0];
        // Mismo grupo con otro titular: no hay evidencia nueva.
        $same = $this->store()->saveClusters([['event_id' => $v1['event_id'], 'title' => 'Otro titular', 'article_ids' => [$a['id']]]])[0];
        self::assertSame(1, $same['version']);

        // Entra una noticia nueva: versión 2.
        $b = $this->store()->upsertArticles($source->getId(), [self::article('https://medio-a.example/b', 'B')])[0];
        $v2 = $this->store()->saveClusters([['event_id' => $v1['event_id'], 'title' => 'Suceso', 'article_ids' => [$a['id'], $b['id']]]])[0];
        self::assertSame(2, $v2['version']);
        self::assertNotSame($v1['evidence_hash'], $v2['evidence_hash']);

        // Una noticia existente cambia su contenido: versión 3.
        $changed = self::article('https://medio-a.example/b', 'B');
        $changed['content_hash'] = hash('sha256', 'B corregida');
        $this->store()->upsertArticles($source->getId(), [$changed]);
        $v3 = $this->store()->saveClusters([['event_id' => $v1['event_id'], 'title' => 'Suceso', 'article_ids' => [$a['id'], $b['id']]]])[0];
        self::assertSame(3, $v3['version']);
    }

    public function testLasCopiasDeAgenciaCuentanComoUnaSolaFuente(): void
    {
        $m1 = $this->source('medio-1');
        $m2 = $this->source('medio-2');
        $m3 = $this->source('medio-3');
        $ids = [
            $this->store()->upsertArticles($m1->getId(), [self::article('https://medio-1.example/x', 'Teletipo', 'EFE')])[0]['id'],
            $this->store()->upsertArticles($m2->getId(), [self::article('https://medio-2.example/x', 'Teletipo', 'EFE')])[0]['id'],
            $this->store()->upsertArticles($m3->getId(), [self::article('https://medio-3.example/x', 'Crónica propia')])[0]['id'],
        ];

        $event = $this->store()->saveClusters([['title' => 'Suceso', 'article_ids' => $ids]])[0];

        self::assertSame(3, $event['article_count']);
        self::assertSame(2, $event['independent_sources']);
    }

    public function testElDossierSeReutilizaHastaQueCambiaLaEvidencia(): void
    {
        $source = $this->source();
        $e = $this->eventWithDossier($source, 1);
        $event = $this->store()->eventsWithArticles([$e['event_id']])[0];

        $hit = $this->store()->findDossier($e['event_id'], $event['evidence_hash'], 'dossier-v1', 'modelo-prueba');
        self::assertSame($e['dossier_id'], $hit['id']);

        $b = $this->store()->upsertArticles($source->getId(), [self::article('https://medio-a.example/novedad', 'Novedad')])[0];
        $updated = $this->store()->saveClusters([['event_id' => $e['event_id'], 'title' => 'x', 'article_ids' => [$b['id']]]])[0];

        self::assertNull($this->store()->findDossier($e['event_id'], $updated['evidence_hash'], 'dossier-v1', 'modelo-prueba'));
        // Otro prompt u otro modelo tampoco reutilizan.
        self::assertNull($this->store()->findDossier($e['event_id'], $event['evidence_hash'], 'dossier-v2', 'modelo-prueba'));
    }
}
