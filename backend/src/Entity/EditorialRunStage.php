<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialRunStageRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Una etapa de una ejecución (ingesta, agrupación, dossier...). Guarda su
 * estado y sus métricas para poder reanudar y para el apartado de uso.
 */
#[ORM\Entity(repositoryClass: EditorialRunStageRepository::class)]
#[ORM\Table(name: 'editorial_run_stages')]
#[ORM\UniqueConstraint(name: 'uniq_editorial_stage', columns: ['run_id', 'name'])]
class EditorialRunStage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: EditorialRun::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EditorialRun $run;

    #[ORM\Column(type: 'string', length: 40)]
    private string $name;

    /** running, done, failed o skipped. */
    #[ORM\Column(type: 'string', length: 20)]
    private string $status = 'running';

    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $attempts = 1;

    #[ORM\Column(type: 'json')]
    private array $metrics = [];

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $error = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    public function __construct()
    {
        $this->startedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getRun(): EditorialRun { return $this->run; }
    public function setRun(EditorialRun $run): static { $this->run = $run; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getAttempts(): int { return $this->attempts; }
    public function setAttempts(int $n): static { $this->attempts = $n; return $this; }
    public function getMetrics(): array { return $this->metrics; }
    public function setMetrics(array $metrics): static { $this->metrics = $metrics; return $this; }
    public function getError(): ?string { return $this->error; }
    public function setError(?string $error): static { $this->error = $error; return $this; }
    public function getStartedAt(): \DateTimeImmutable { return $this->startedAt; }
    public function setStartedAt(\DateTimeImmutable $at): static { $this->startedAt = $at; return $this; }
    public function getFinishedAt(): ?\DateTimeImmutable { return $this->finishedAt; }
    public function setFinishedAt(?\DateTimeImmutable $at): static { $this->finishedAt = $at; return $this; }
}
