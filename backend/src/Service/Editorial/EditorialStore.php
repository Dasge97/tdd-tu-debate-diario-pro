<?php

declare(strict_types=1);

namespace App\Service\Editorial;

use App\Entity\EditorialArticle;
use App\Entity\EditorialDossier;
use App\Entity\EditorialEvent;
use App\Entity\EditorialSource;
use App\Repository\EditorialArticleRepository;
use App\Repository\EditorialDossierRepository;
use App\Repository\EditorialEventRepository;
use App\Repository\EditorialSourceRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Persistencia de fuentes, noticias, acontecimientos y resúmenes de hechos.
 * El worker decide; el backend guarda y calcula versiones.
 */
class EditorialStore
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EditorialSourceRepository $sources,
        private readonly EditorialArticleRepository $articles,
        private readonly EditorialEventRepository $events,
        private readonly EditorialDossierRepository $dossiers,
    ) {
    }

    private static function now(): \DateTimeImmutable
    {
        return new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /** Fecha ISO a UTC, o null si falta o no se entiende. Nunca se inventa una fecha. */
    private static function date(mixed $value): ?\DateTimeImmutable
    {
        if (!is_string($value) || $value === '') {
            return null;
        }
        try {
            return (new \DateTimeImmutable($value))->setTimezone(new \DateTimeZone('UTC'));
        } catch (\Exception) {
            return null;
        }
    }

    // ── Fuentes ──

    public function enabledSources(): array
    {
        return array_map(static fn(EditorialSource $s) => [
            'id'            => $s->getId(),
            'slug'          => $s->getSlug(),
            'name'          => $s->getName(),
            'type'          => $s->getType(),
            'url'           => $s->getUrl(),
            'language'      => $s->getLanguage(),
            'scope'         => $s->getScope(),
            'topics'        => $s->getTopics(),
            'origin_type'   => $s->getOriginType(),
            'etag'          => $s->getEtag(),
            'last_modified' => $s->getLastModified(),
        ], $this->sources->findBy(['enabled' => true], ['id' => 'ASC']));
    }

    /** Guarda el resultado de descargar cada fuente. Una fuente que falla no afecta a las demás. */
    public function reportSources(array $reports): int
    {
        $updated = 0;
        foreach ($reports as $report) {
            $source = $this->sources->find((int) ($report['source_id'] ?? 0));
            if ($source === null) {
                continue;
            }
            $now = self::now();
            $source->setLastFetchedAt($now);
            if (($report['status'] ?? '') === 'ok' || ($report['status'] ?? '') === 'not_modified') {
                $source->setStatus('ok');
                $source->setLastSuccessAt($now);
                $source->setLastError(null);
                $source->setConsecutiveFailures(0);
                if (($report['status'] ?? '') === 'ok') {
                    $source->setLastItemCount((int) ($report['item_count'] ?? 0));
                }
                $source->setEtag(isset($report['etag']) ? mb_substr((string) $report['etag'], 0, 255) : $source->getEtag());
                $source->setLastModified(isset($report['last_modified']) ? mb_substr((string) $report['last_modified'], 0, 64) : $source->getLastModified());
            } else {
                $source->setStatus('error');
                $source->setLastError(mb_substr((string) ($report['error'] ?? 'error desconocido'), 0, 2000));
                $source->setConsecutiveFailures($source->getConsecutiveFailures() + 1);
            }
            $updated++;
        }
        $this->em->flush();
        return $updated;
    }

    // ── Noticias ──

    /**
     * Inserta o actualiza noticias por hash de URL.
     *
     * @return array<int, array{url_hash: string, id: int, status: string}> status: created, changed o unchanged
     */
    public function upsertArticles(int $sourceId, array $items): array
    {
        $source = $this->sources->find($sourceId);
        if ($source === null) {
            throw new \InvalidArgumentException("fuente {$sourceId} no existe");
        }

        $valid = [];
        foreach ($items as $item) {
            $hash = (string) ($item['url_hash'] ?? '');
            $url = (string) ($item['url'] ?? '');
            $title = trim((string) ($item['title'] ?? ''));
            if (!preg_match('/^[a-f0-9]{64}$/', $hash) || !preg_match('#^https?://#i', $url) || $title === '') {
                continue;
            }
            $valid[$hash] = $item;
        }
        if ($valid === []) {
            return [];
        }

        $existing = [];
        foreach ($this->articles->findBy(['urlHash' => array_keys($valid)]) as $article) {
            $existing[$article->getUrlHash()] = $article;
        }

        $result = [];
        $pending = [];
        foreach ($valid as $hash => $item) {
            $contentHash = (string) ($item['content_hash'] ?? hash('sha256', $item['title'] . '|' . ($item['excerpt'] ?? '')));
            $article = $existing[$hash] ?? null;
            $status = 'unchanged';

            if ($article === null) {
                $article = new EditorialArticle();
                $article->setSource($source);
                $article->setUrlHash($hash);
                $status = 'created';
            } elseif ($article->getContentHash() !== $contentHash) {
                $status = 'changed';
            }

            if ($status !== 'unchanged') {
                $article->setUrl(mb_substr((string) $item['url'], 0, 1024));
                $article->setCanonicalUrl(isset($item['canonical_url']) ? mb_substr((string) $item['canonical_url'], 0, 1024) : null);
                $article->setTitle(mb_substr(trim((string) $item['title']), 0, 500));
                $article->setExcerpt(isset($item['excerpt']) ? (string) $item['excerpt'] : null);
                $article->setContentHash($contentHash);
                $article->setPublishedAt(self::date($item['published_at'] ?? null) ?? $article->getPublishedAt());
                $article->setSourceUpdatedAt(self::date($item['source_updated_at'] ?? null));
                $article->setLanguage(mb_substr((string) ($item['language'] ?? $source->getLanguage()), 0, 8));
                $article->setAgency(isset($item['agency']) ? mb_substr((string) $item['agency'], 0, 40) : null);
                $article->setFetchedAt(self::now());
                $this->em->persist($article);
            }
            $pending[] = [$hash, $article, $status];
        }
        $this->em->flush();

        foreach ($pending as [$hash, $article, $status]) {
            $result[] = ['url_hash' => $hash, 'id' => $article->getId(), 'status' => $status];
        }
        return $result;
    }

    /** Noticias recientes para agrupar: recogidas o publicadas dentro de la ventana. */
    public function windowArticles(int $hours): array
    {
        $since = self::now()->modify("-{$hours} hours");
        $rows = $this->articles->createQueryBuilder('a')
            ->select('a', 's', 'e')
            ->join('a.source', 's')
            ->leftJoin('a.event', 'e')
            ->where('a.fetchedAt >= :since OR a.publishedAt >= :since')
            ->setParameter('since', $since)
            ->orderBy('a.id', 'ASC')
            ->getQuery()
            ->getResult();

        return array_map(fn(EditorialArticle $a) => $this->articleView($a), $rows);
    }

    private function articleView(EditorialArticle $a): array
    {
        $s = $a->getSource();
        return [
            'id'           => $a->getId(),
            'source_id'    => $s->getId(),
            'source_slug'  => $s->getSlug(),
            'source_name'  => $s->getName(),
            'origin_type'  => $s->getOriginType(),
            'scope'        => $s->getScope(),
            'source_topics'=> $s->getTopics(),
            'url'          => $a->getUrl(),
            'title'        => $a->getTitle(),
            'excerpt'      => $a->getExcerpt(),
            'content_hash' => $a->getContentHash(),
            'published_at' => $a->getPublishedAt()?->format(\DateTimeInterface::ATOM),
            'fetched_at'   => $a->getFetchedAt()->format(\DateTimeInterface::ATOM),
            'agency'       => $a->getAgency(),
            'event_id'     => $a->getEvent()?->getId(),
        ];
    }

    // ── Acontecimientos ──

    /**
     * Guarda la agrupación que calculó el worker.
     *
     * Cada grupo trae sus noticias y, si ya existía, el id del acontecimiento.
     * La versión solo sube si cambia la evidencia; un titular distinto sin
     * noticias nuevas no crea versión.
     */
    public function saveClusters(array $clusters): array
    {
        $result = [];

        foreach ($clusters as $cluster) {
            $ids = array_values(array_unique(array_map('intval', $cluster['article_ids'] ?? [])));
            if ($ids === []) {
                continue;
            }
            $articles = $this->articles->findBy(['id' => $ids]);
            if ($articles === []) {
                continue;
            }

            $event = null;
            if (!empty($cluster['event_id'])) {
                $event = $this->events->find((int) $cluster['event_id']);
            }
            if ($event === null) {
                // Si alguna noticia ya estaba en un acontecimiento, se sigue con el más antiguo.
                $known = array_filter(array_map(static fn(EditorialArticle $a) => $a->getEvent(), $articles));
                usort($known, static fn(EditorialEvent $x, EditorialEvent $y) => $x->getId() <=> $y->getId());
                $event = $known[0] ?? null;
            }
            $isNew = $event === null;
            if ($isNew) {
                $event = new EditorialEvent();
                $event->setTitle('');
                $this->em->persist($event);
            }

            foreach ($articles as $article) {
                $article->setEvent($event);
            }
            $event->setTitle(mb_substr(trim((string) ($cluster['title'] ?? $articles[0]->getTitle())), 0, 500));
            $event->setKeywords(array_slice(array_map('strval', $cluster['keywords'] ?? []), 0, 40));
            $event->setTopics(array_slice(array_map('strval', $cluster['topics'] ?? []), 0, 8));
            $this->em->flush();

            $this->refreshEvidence($event, $isNew);
            $result[] = $this->eventSummary($event);
        }

        $this->em->flush();
        return $result;
    }

    /** Recalcula hash de evidencia, recuentos y fechas a partir de todas sus noticias. */
    private function refreshEvidence(EditorialEvent $event, bool $isNew): void
    {
        $articles = $this->articles->findBy(['event' => $event], ['id' => 'ASC']);

        $parts = [];
        $independent = [];
        $first = null;
        $last = null;
        foreach ($articles as $a) {
            $parts[] = $a->getId() . ':' . $a->getContentHash();
            $independent[self::independenceKey($a)] = true;
            $seen = $a->getFetchedAt();
            $first = $first === null || $seen < $first ? $seen : $first;
            $last = $last === null || $seen > $last ? $seen : $last;
        }
        $hash = hash('sha256', implode('|', $parts));

        if (!$isNew && $event->getEvidenceHash() !== '' && $event->getEvidenceHash() !== $hash) {
            $event->setVersion($event->getVersion() + 1);
        }
        $event->setEvidenceHash($hash);
        $event->setArticleCount(count($articles));
        $event->setIndependentSourceCount(count($independent));
        if ($first !== null) {
            $event->setFirstSeenAt($first);
            $event->setLastSeenAt($last);
        }
        $event->touch();
    }

    /**
     * Qué cuenta como una confirmación independiente. Las copias de una misma
     * agencia publicadas en varios medios cuentan una sola vez.
     */
    public static function independenceKey(EditorialArticle $article): string
    {
        if ($article->getAgency() !== null) {
            return 'agencia:' . mb_strtolower($article->getAgency());
        }
        return 'fuente:' . $article->getSource()->getSlug();
    }

    private function eventSummary(EditorialEvent $event): array
    {
        return [
            'event_id'            => $event->getId(),
            'version'             => $event->getVersion(),
            'evidence_hash'       => $event->getEvidenceHash(),
            'title'               => $event->getTitle(),
            'article_count'       => $event->getArticleCount(),
            'independent_sources' => $event->getIndependentSourceCount(),
            'first_seen_at'       => $event->getFirstSeenAt()->format(\DateTimeInterface::ATOM),
            'last_seen_at'        => $event->getLastSeenAt()->format(\DateTimeInterface::ATOM),
            'last_published_at'   => $event->getLastPublishedAt()?->format(\DateTimeInterface::ATOM),
            'last_published_version' => $event->getLastPublishedVersion(),
        ];
    }

    /** Acontecimientos con sus noticias, para construir los resúmenes de hechos. */
    public function eventsWithArticles(array $eventIds, bool $withArticles = true): array
    {
        $events = $this->events->findBy(['id' => array_map('intval', $eventIds)]);
        $out = [];
        foreach ($events as $event) {
            $row = $this->eventSummary($event) + [
                'keywords' => $event->getKeywords(),
                'topics'   => $event->getTopics(),
            ];
            if ($withArticles) {
                $articles = $this->articles->findBy(['event' => $event], ['id' => 'ASC']);
                $row['articles'] = array_map(fn(EditorialArticle $a) => $this->articleView($a), $articles);
            }
            $out[] = $row;
        }
        return $out;
    }

    // ── Resúmenes de hechos ──

    public function findDossier(int $eventId, string $evidenceHash, string $promptVersion, string $model): ?array
    {
        $dossier = $this->dossiers->findOneBy([
            'event'         => $eventId,
            'evidenceHash'  => $evidenceHash,
            'promptVersion' => $promptVersion,
            'model'         => $model,
        ]);
        return $dossier !== null ? self::dossierView($dossier) : null;
    }

    public function saveDossier(array $data): array
    {
        $event = $this->events->find((int) ($data['event_id'] ?? 0));
        if ($event === null) {
            throw new \InvalidArgumentException('acontecimiento no encontrado');
        }
        $status = (string) ($data['status'] ?? '');
        if (!in_array($status, EditorialDossier::STATUSES, true)) {
            throw new \InvalidArgumentException('estado de dossier no válido');
        }

        $existing = $this->dossiers->findOneBy([
            'event'         => $event,
            'evidenceHash'  => (string) $data['evidence_hash'],
            'promptVersion' => (string) $data['prompt_version'],
            'model'         => (string) $data['model'],
        ]);
        $dossier = $existing ?? new EditorialDossier();
        $dossier->setEvent($event);
        $dossier->setEventVersion((int) ($data['event_version'] ?? $event->getVersion()));
        $dossier->setEvidenceHash((string) $data['evidence_hash']);
        $dossier->setPromptVersion(mb_substr((string) $data['prompt_version'], 0, 40));
        $dossier->setModel(mb_substr((string) $data['model'], 0, 80));
        $dossier->setStatus($status);
        $dossier->setData(is_array($data['data'] ?? null) ? $data['data'] : []);
        $dossier->setEvidence(is_array($data['evidence'] ?? null) ? $data['evidence'] : []);
        $this->em->persist($dossier);
        $this->em->flush();

        return self::dossierView($dossier);
    }

    public static function dossierView(EditorialDossier $d): array
    {
        return [
            'id'             => $d->getId(),
            'event_id'       => $d->getEvent()->getId(),
            'event_version'  => $d->getEventVersion(),
            'evidence_hash'  => $d->getEvidenceHash(),
            'prompt_version' => $d->getPromptVersion(),
            'model'          => $d->getModel(),
            'status'         => $d->getStatus(),
            'data'           => $d->getData(),
            'evidence'       => $d->getEvidence(),
            'created_at'     => $d->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}
