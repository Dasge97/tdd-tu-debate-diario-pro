<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialRunRepository;
use Doctrine\ORM\Mapping as ORM;

/** Una ejecución del motor editorial V2 para un día editorial. */
#[ORM\Entity(repositoryClass: EditorialRunRepository::class)]
#[ORM\Table(name: 'editorial_runs')]
#[ORM\Index(name: 'idx_editorial_runs_day', columns: ['editorial_day'])]
class EditorialRun
{
    public const MODE_DRY_RUN = 'dry_run';
    public const MODE_LIVE = 'live';

    /**
     * running: en marcha. published: lote publicado. completed: prueba terminada
     * sin publicar. incomplete: no se reunieron los debates válidos necesarios.
     * failed: error inesperado. aborted: bloqueo caducado sin terminar.
     */
    public const STATUSES = ['running', 'published', 'completed', 'incomplete', 'failed', 'aborted'];

    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 36)]
    private string $id;

    /** Día editorial en Europe/Madrid, al que pertenecen los debates. */
    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $editorialDay;

    #[ORM\Column(type: 'string', length: 12)]
    private string $mode;

    #[ORM\Column(type: 'string', length: 20)]
    private string $status = 'running';

    #[ORM\Column(type: 'string', length: 20, options: ['default' => 'manual'])]
    private string $triggeredBy = 'manual';

    /** Configuración efectiva con la que se ejecutó, sin la clave del modelo. */
    #[ORM\Column(type: 'json')]
    private array $config = [];

    #[ORM\Column(type: 'json')]
    private array $metrics = [];

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $error = null;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $publishedCount = 0;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $heartbeatAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    public function __construct(string $id)
    {
        $this->id = $id;
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->startedAt = $now;
        $this->heartbeatAt = $now;
    }

    public function getId(): string { return $this->id; }
    public function getEditorialDay(): \DateTimeImmutable { return $this->editorialDay; }
    public function setEditorialDay(\DateTimeImmutable $day): static { $this->editorialDay = $day; return $this; }
    public function getMode(): string { return $this->mode; }
    public function setMode(string $mode): static { $this->mode = $mode; return $this; }
    public function isDryRun(): bool { return $this->mode === self::MODE_DRY_RUN; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function isRunning(): bool { return $this->status === 'running'; }
    public function getTriggeredBy(): string { return $this->triggeredBy; }
    public function setTriggeredBy(string $by): static { $this->triggeredBy = $by; return $this; }
    public function getConfig(): array { return $this->config; }
    public function setConfig(array $config): static { $this->config = $config; return $this; }
    public function getMetrics(): array { return $this->metrics; }
    public function setMetrics(array $metrics): static { $this->metrics = $metrics; return $this; }
    public function getError(): ?string { return $this->error; }
    public function setError(?string $error): static { $this->error = $error; return $this; }
    public function getPublishedCount(): int { return $this->publishedCount; }
    public function setPublishedCount(int $n): static { $this->publishedCount = $n; return $this; }
    public function getStartedAt(): \DateTimeImmutable { return $this->startedAt; }
    public function getHeartbeatAt(): \DateTimeImmutable { return $this->heartbeatAt; }
    public function setHeartbeatAt(\DateTimeImmutable $at): static { $this->heartbeatAt = $at; return $this; }
    public function getFinishedAt(): ?\DateTimeImmutable { return $this->finishedAt; }
    public function setFinishedAt(?\DateTimeImmutable $at): static { $this->finishedAt = $at; return $this; }
}
