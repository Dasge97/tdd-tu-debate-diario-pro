<?php

declare(strict_types=1);

namespace App\Service\Editorial;

use App\Entity\EditorialSource;
use App\Repository\EditorialRunRepository;
use App\Repository\EditorialSourceRepository;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;

/** Consultas y cambios del motor editorial desde el panel de administración. */
class EditorialAdminService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Connection $db,
        private readonly EditorialConfig $config,
        private readonly EditorialRunRepository $runs,
        private readonly EditorialSourceRepository $sources,
        private readonly EditorialRunService $runService,
    ) {
    }

    public function updateConfig(array $input): void
    {
        $c = $this->config->entity();

        if (in_array($input['engine'] ?? null, ['v1', 'v2'], true)) {
            $c->setEngine($input['engine']);
        }
        if (in_array($input['mode'] ?? null, ['dry_run', 'live'], true)) {
            $c->setEditorialMode($input['mode']);
        }
        $baseUrl = trim((string) ($input['llmBaseUrl'] ?? ''));
        if ($baseUrl === '' || preg_match('#^https?://#i', $baseUrl)) {
            $c->setLlmBaseUrl($baseUrl !== '' ? $baseUrl : null);
        }
        $model = trim((string) ($input['llmModel'] ?? ''));
        $c->setLlmModel($model !== '' ? mb_substr($model, 0, 80) : null);

        $basis = ($input['billingBasis'] ?? 'subscription') === 'api' ? 'api' : 'subscription';
        $price = static fn($v) => is_numeric($v) && (float) $v >= 0 ? (float) $v : null;
        $c->setLlmBilling([
            'basis'         => $basis,
            'inputPerMTok'  => $price($input['inputPerMTok'] ?? null),
            'outputPerMTok' => $price($input['outputPerMTok'] ?? null),
            'currency'      => mb_substr(trim((string) ($input['currency'] ?? 'EUR')) ?: 'EUR', 0, 3),
            'priceDate'     => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($input['priceDate'] ?? '')) ? $input['priceDate'] : null,
        ]);

        $limits = [];
        foreach (EditorialConfig::DEFAULT_LIMITS as $key => $default) {
            if (isset($input['limits'][$key]) && $input['limits'][$key] !== '') {
                $limits[$key] = $input['limits'][$key];
            }
        }
        $c->setEditorialLimits(EditorialConfig::mergeLimits($limits));
        $c->setUpdatedAt(new \DateTime());
        $this->em->flush();

        // La clave solo cambia si se escribe una nueva; vacío la deja como está.
        $key = trim((string) ($input['llmApiKey'] ?? ''));
        if ($key !== '') {
            $this->config->setApiKey($key);
        }
        if (!empty($input['llmApiKeyClear'])) {
            $this->config->setApiKey(null);
        }
    }

    /** Ejecuciones recientes con su consumo. */
    public function recentRuns(int $limit = 20): array
    {
        $rows = $this->db->fetchAllAssociative(
            'SELECT r.id, r.editorial_day, r.mode, r.status, r.published_count, r.error, r.started_at, r.finished_at,
                    COUNT(c.id) AS calls,
                    SUM(c.input_tokens) AS input_tokens,
                    SUM(c.output_tokens) AS output_tokens,
                    SUM(CASE WHEN c.input_tokens IS NULL THEN 1 ELSE 0 END) AS unknown_calls
             FROM editorial_runs r
             LEFT JOIN editorial_llm_calls c ON c.run_id = r.id
             GROUP BY r.id, r.editorial_day, r.mode, r.status, r.published_count, r.error, r.started_at, r.finished_at
             ORDER BY r.started_at DESC
             LIMIT ' . (int) $limit
        );
        return $rows;
    }

    public function runDetail(string $id): array
    {
        $detail = $this->runService->describe($id);
        $detail['calls'] = $this->db->fetchAllAssociative(
            'SELECT stage, purpose, reference, model, prompt_version, input_tokens, output_tokens, cached_tokens, input_chars, duration_ms, attempt, status, error, created_at
             FROM editorial_llm_calls WHERE run_id = ? ORDER BY id',
            [$id]
        );
        $eventIds = array_unique(array_column($detail['assignments'], 'event_id'));
        $titles = $eventIds === [] ? [] : $this->db->fetchAllKeyValue(
            'SELECT id, title FROM editorial_events WHERE id IN (' . implode(',', array_map('intval', $eventIds)) . ')'
        );
        foreach ($detail['assignments'] as &$a) {
            $a['event_title'] = $titles[$a['event_id']] ?? '';
        }
        return $detail;
    }

    /**
     * Consumo por día editorial. El coste solo se calcula si hay tarifa por
     * token (API de pago); con suscripción se muestran tokens sin inventar euros.
     */
    public function usageByDay(int $days = 30): array
    {
        $since = (new \DateTimeImmutable("-{$days} days"))->format('Y-m-d');
        $rows = $this->db->fetchAllAssociative(
            "SELECT r.editorial_day AS day,
                    COUNT(DISTINCT r.id) AS runs,
                    SUM(CASE WHEN r.status = 'published' THEN r.published_count ELSE 0 END) AS published,
                    COUNT(c.id) AS calls,
                    SUM(CASE WHEN c.status <> 'ok' THEN 1 ELSE 0 END) AS failed_calls,
                    SUM(c.input_tokens) AS input_tokens,
                    SUM(c.output_tokens) AS output_tokens,
                    SUM(c.cached_tokens) AS cached_tokens,
                    SUM(CASE WHEN c.id IS NOT NULL AND c.input_tokens IS NULL THEN 1 ELSE 0 END) AS unknown_calls,
                    SUM(c.duration_ms) AS llm_ms
             FROM editorial_runs r
             LEFT JOIN editorial_llm_calls c ON c.run_id = r.id
             WHERE r.editorial_day >= ?
             GROUP BY r.editorial_day
             ORDER BY r.editorial_day DESC",
            [$since]
        );

        $validByDay = $this->db->fetchAllKeyValue(
            "SELECT editorial_day, COUNT(*) FROM editorial_assignments WHERE status IN ('validated', 'published') AND editorial_day >= ? GROUP BY editorial_day",
            [$since]
        );

        $billing = $this->config->billing();
        foreach ($rows as &$row) {
            $row['day'] = substr((string) $row['day'], 0, 10);
            $row['valid_debates'] = (int) ($validByDay[$row['day']] ?? $validByDay[$row['day'] . ' 00:00:00'] ?? 0);
            $tokens = (int) $row['input_tokens'] + (int) $row['output_tokens'];
            $row['tokens_per_valid'] = $row['valid_debates'] > 0 ? (int) round($tokens / $row['valid_debates']) : null;
            $row['cost'] = null;
            if ($billing['basis'] === 'api' && $billing['inputPerMTok'] !== null && $billing['outputPerMTok'] !== null) {
                $row['cost'] = round(((int) $row['input_tokens'] * $billing['inputPerMTok'] + (int) $row['output_tokens'] * $billing['outputPerMTok']) / 1_000_000, 4);
            }
        }
        return ['rows' => $rows, 'billing' => $billing];
    }

    public function sources(): array
    {
        return $this->sources->findBy([], ['scope' => 'ASC', 'name' => 'ASC']);
    }

    public function toggleSource(int $id): ?EditorialSource
    {
        $source = $this->sources->find($id);
        if ($source !== null) {
            $source->setEnabled(!$source->isEnabled());
            $this->em->flush();
        }
        return $source;
    }

    public function addSource(array $input): EditorialSource
    {
        $url = trim((string) ($input['url'] ?? ''));
        $name = trim((string) ($input['name'] ?? ''));
        if (!preg_match('#^https://#i', $url) || $name === '') {
            throw new \InvalidArgumentException('Hace falta un nombre y una URL https.');
        }
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $name) ?: $name)), '-');
        if ($slug === '' || $this->sources->findOneBy(['slug' => $slug]) !== null) {
            $slug .= '-' . substr(sha1($url), 0, 6);
        }
        $topics = array_values(array_filter(array_map('trim', explode(',', (string) ($input['topics'] ?? '')))));

        $source = (new EditorialSource())
            ->setSlug(mb_substr($slug, 0, 80))
            ->setName(mb_substr($name, 0, 120))
            ->setType(($input['type'] ?? 'rss') === 'atom' ? 'atom' : 'rss')
            ->setUrl($url)
            ->setScope(($input['scope'] ?? 'es') === 'intl' ? 'intl' : 'es')
            ->setOriginType(in_array($input['origin'] ?? '', EditorialSource::ORIGIN_TYPES, true) ? $input['origin'] : 'medio')
            ->setTopics($topics);
        $this->em->persist($source);
        $this->em->flush();
        return $source;
    }
}
