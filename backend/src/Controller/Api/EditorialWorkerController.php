<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Service\Editorial\EditorialConfig;
use App\Service\Editorial\EditorialPublisher;
use App\Service\Editorial\EditorialRunService;
use App\Service\Editorial\EditorialStore;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Endpoints internos del motor editorial V2. Solo los usa el worker, con
 * X-Worker-Key. El backend es el único que escribe en la base de datos.
 */
#[Route('/api/v1/worker/editorial')]
class EditorialWorkerController extends AbstractController
{
    public function __construct(
        private readonly EditorialConfig $config,
        private readonly EditorialStore $store,
        private readonly EditorialRunService $runs,
        private readonly EditorialPublisher $publisher,
        private readonly string $workerApiKey,
    ) {
    }

    private function auth(Request $request): void
    {
        $key = $request->headers->get('X-Worker-Key', '');
        if ($this->workerApiKey === '' || !hash_equals($this->workerApiKey, $key)) {
            throw new \RuntimeException('UNAUTHORIZED: invalid worker API key');
        }
    }

    private static function body(Request $request): array
    {
        $data = json_decode($request->getContent() ?: '{}', true);
        if (!is_array($data)) {
            throw new \InvalidArgumentException('cuerpo JSON no válido');
        }
        return $data;
    }

    #[Route('/config', methods: ['GET'])]
    public function config(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse($this->config->forWorker());
    }

    #[Route('/personas', methods: ['GET'])]
    public function personas(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse($this->runs->personas());
    }

    #[Route('/sources', methods: ['GET'])]
    public function sources(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse($this->store->enabledSources());
    }

    #[Route('/sources/report', methods: ['POST'])]
    public function reportSources(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse(['updated' => $this->store->reportSources(self::body($request)['reports'] ?? [])]);
    }

    #[Route('/articles', methods: ['POST'])]
    public function articles(Request $request): JsonResponse
    {
        $this->auth($request);
        $body = self::body($request);
        return new JsonResponse(['articles' => $this->store->upsertArticles((int) ($body['source_id'] ?? 0), $body['items'] ?? [])]);
    }

    #[Route('/articles/window', methods: ['GET'])]
    public function window(Request $request): JsonResponse
    {
        $this->auth($request);
        $hours = min(24 * 14, max(1, (int) $request->query->get('hours', '72')));
        return new JsonResponse(['articles' => $this->store->windowArticles($hours)]);
    }

    #[Route('/events', methods: ['POST'])]
    public function saveEvents(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse(['events' => $this->store->saveClusters(self::body($request)['clusters'] ?? [])]);
    }

    #[Route('/events', methods: ['GET'])]
    public function events(Request $request): JsonResponse
    {
        $this->auth($request);
        $ids = array_filter(array_map('intval', explode(',', (string) $request->query->get('ids', ''))));
        $withArticles = $request->query->get('articles', '1') !== '0';
        return new JsonResponse(['events' => $ids !== [] ? $this->store->eventsWithArticles($ids, $withArticles) : []]);
    }

    #[Route('/recent', methods: ['GET'])]
    public function recent(Request $request): JsonResponse
    {
        $this->auth($request);
        $days = min(90, max(1, (int) $request->query->get('days', '14')));
        return new JsonResponse(['debates' => $this->runs->recentPublished($days)]);
    }

    #[Route('/dossiers/lookup', methods: ['GET'])]
    public function lookupDossier(Request $request): JsonResponse
    {
        $this->auth($request);
        $q = $request->query;
        $dossier = $this->store->findDossier(
            (int) $q->get('event_id', '0'),
            (string) $q->get('evidence_hash', ''),
            (string) $q->get('prompt_version', ''),
            (string) $q->get('model', ''),
        );
        return new JsonResponse(['dossier' => $dossier]);
    }

    #[Route('/dossiers', methods: ['POST'])]
    public function saveDossier(Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse(['dossier' => $this->store->saveDossier(self::body($request))], 201);
    }

    #[Route('/runs', methods: ['POST'])]
    public function startRun(Request $request): JsonResponse
    {
        $this->auth($request);
        $body = self::body($request);
        $started = $this->runs->start(
            (string) ($body['mode'] ?? ''),
            (string) ($body['editorial_day'] ?? ''),
            (string) ($body['triggered_by'] ?? 'manual'),
            (bool) ($body['resume'] ?? true),
        );
        return new JsonResponse(
            $this->runs->describe($started['run']->getId()) + ['resumed' => $started['resumed']],
            201
        );
    }

    #[Route('/runs/{id}', methods: ['GET'])]
    public function run(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse($this->runs->describe($id));
    }

    #[Route('/runs/{id}/heartbeat', methods: ['POST'])]
    public function heartbeat(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        $this->runs->heartbeat($id);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/runs/{id}/stages', methods: ['POST'])]
    public function stage(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        $this->runs->recordStage($id, self::body($request));
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/runs/{id}/llm-calls', methods: ['POST'])]
    public function llmCalls(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse(['recorded' => $this->runs->recordLlmCalls($id, self::body($request)['calls'] ?? [])]);
    }

    #[Route('/runs/{id}/assignments', methods: ['POST'])]
    public function assignments(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse(['assignments' => $this->runs->saveAssignments($id, self::body($request)['assignments'] ?? [])]);
    }

    #[Route('/runs/{id}/publish', methods: ['POST'])]
    public function publish(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        return new JsonResponse($this->publisher->publish($id));
    }

    #[Route('/runs/{id}/finish', methods: ['POST'])]
    public function finish(string $id, Request $request): JsonResponse
    {
        $this->auth($request);
        $body = self::body($request);
        $run = $this->runs->finish(
            $id,
            (string) ($body['status'] ?? ''),
            is_array($body['metrics'] ?? null) ? $body['metrics'] : null,
            isset($body['error']) ? (string) $body['error'] : null,
        );
        return new JsonResponse(EditorialRunService::runView($run));
    }
}
