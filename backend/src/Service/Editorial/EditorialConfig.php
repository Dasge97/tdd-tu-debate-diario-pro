<?php

declare(strict_types=1);

namespace App\Service\Editorial;

use App\Entity\WorkerConfig;
use App\Repository\WorkerConfigRepository;

/**
 * Configuración efectiva del motor editorial V2: lo guardado en worker_config
 * más los valores por defecto de lo que no se haya tocado.
 */
class EditorialConfig
{
    public const PROVIDER = 'openai-compatible';

    /**
     * Límites por defecto. Cada uno se puede cambiar desde el panel.
     * Los de tokens y llamadas son por ejecución.
     */
    public const DEFAULT_LIMITS = [
        'timezone'              => 'Europe/Madrid',
        // Ingesta
        'maxItemsPerSource'     => 40,
        'maxArticleAgeHours'    => 48,
        'maxExcerptChars'       => 1200,
        'fetchTimeoutMs'        => 15000,
        'maxFeedBytes'          => 6000000,
        'fetchConcurrency'      => 4,
        // Agrupación y selección
        'clusterWindowHours'    => 72,
        'maxCandidates'         => 10,
        'maxDossiers'           => 20,
        'maxEvidencePerDossier' => 6,
        'maxEvidenceChars'      => 900,
        // Modelo
        'maxInputChars'         => 14000,
        'maxOutputTokens'       => 2500,
        'llmTimeoutMs'          => 180000,
        'llmConcurrency'        => 2,
        'maxLlmCalls'           => 40,
        'maxTotalTokens'        => 250000,
        'maxRepairAttempts'     => 1,
        'maxReplacements'       => 3,
    ];

    public const DEFAULT_BILLING = [
        'basis'         => 'subscription',
        'inputPerMTok'  => null,
        'outputPerMTok' => null,
        'currency'      => 'EUR',
        'priceDate'     => null,
    ];

    public function __construct(
        private readonly WorkerConfigRepository $repository,
        private readonly SecretBox $secretBox,
    ) {
    }

    public function entity(): WorkerConfig
    {
        return $this->repository->getConfig();
    }

    public function limits(): array
    {
        return self::mergeLimits($this->entity()->getEditorialLimits() ?? []);
    }

    /** Aplica los valores guardados sobre los de por defecto, ignorando claves desconocidas y tipos erróneos. */
    public static function mergeLimits(array $stored): array
    {
        $limits = self::DEFAULT_LIMITS;
        foreach ($stored as $key => $value) {
            if (!array_key_exists($key, $limits)) {
                continue;
            }
            if (is_int($limits[$key]) && is_numeric($value) && (int) $value > 0) {
                $limits[$key] = (int) $value;
            } elseif (is_string($limits[$key]) && is_string($value) && $value !== '') {
                $limits[$key] = $value;
            }
        }
        return $limits;
    }

    public function billing(): array
    {
        return array_merge(self::DEFAULT_BILLING, $this->entity()->getLlmBilling() ?? []);
    }

    public function hasApiKey(): bool
    {
        return $this->entity()->getLlmApiKeyEncrypted() !== null;
    }

    public function apiKey(): ?string
    {
        $stored = $this->entity()->getLlmApiKeyEncrypted();
        return $stored !== null ? $this->secretBox->decrypt($stored) : null;
    }

    public function apiKeyHint(): ?string
    {
        $key = $this->apiKey();
        return $key !== null ? SecretBox::hint($key) : null;
    }

    public function setApiKey(?string $plain): void
    {
        $config = $this->entity();
        $plain = $plain !== null ? trim($plain) : null;
        $config->setLlmApiKeyEncrypted($plain ? $this->secretBox->encrypt($plain) : null);
        $config->setUpdatedAt(new \DateTime());
        $this->repository->save($config);
    }

    /** Lo que recibe el worker. Incluye la clave: solo se sirve por el endpoint con X-Worker-Key. */
    public function forWorker(): array
    {
        $config = $this->entity();

        return [
            'engine'           => $config->getEngine(),
            'mode'             => $config->getEditorialMode(),
            'target_debates'   => $config->getTargetDebates(),
            'dedup_days'       => $config->getDedupDays(),
            'rotation_limit_days' => $config->getRotationLimitDays(),
            'limits'           => $this->limits(),
            'llm'              => [
                'provider' => self::PROVIDER,
                'base_url' => $config->getLlmBaseUrl(),
                'model'    => $config->getLlmModel(),
                'api_key'  => $this->apiKey(),
            ],
        ];
    }

    /** Lo mismo sin la clave, para guardarlo con cada ejecución. */
    public static function withoutSecrets(array $workerConfig): array
    {
        unset($workerConfig['llm']['api_key']);
        return $workerConfig;
    }
}
