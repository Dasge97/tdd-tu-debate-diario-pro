<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialLlmCallRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Una llamada al modelo. Los tokens son los que devuelve el proveedor; si no
 * los devuelve se quedan en null (desconocido), nunca se estiman con caracteres.
 */
#[ORM\Entity(repositoryClass: EditorialLlmCallRepository::class)]
#[ORM\Table(name: 'editorial_llm_calls')]
#[ORM\Index(name: 'idx_editorial_llm_calls_created', columns: ['created_at'])]
class EditorialLlmCall
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: EditorialRun::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EditorialRun $run;

    #[ORM\Column(type: 'string', length: 40)]
    private string $stage;

    /** Para qué era la llamada: dossier, generate, review, repair. */
    #[ORM\Column(type: 'string', length: 40)]
    private string $purpose;

    /** Referencia libre: id del acontecimiento o de la asignación. */
    #[ORM\Column(type: 'string', length: 60, nullable: true)]
    private ?string $reference = null;

    #[ORM\Column(type: 'string', length: 40)]
    private string $provider;

    #[ORM\Column(type: 'string', length: 80)]
    private string $model;

    #[ORM\Column(type: 'string', length: 40)]
    private string $promptVersion;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $inputTokens = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $outputTokens = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $cachedTokens = null;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $inputChars = 0;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $durationMs = 0;

    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $attempt = 1;

    /** ok, error (fallo del proveedor) o invalid (respuesta que no cumple el contrato). */
    #[ORM\Column(type: 'string', length: 20)]
    private string $status;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $error = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getRun(): EditorialRun { return $this->run; }
    public function setRun(EditorialRun $run): static { $this->run = $run; return $this; }
    public function getStage(): string { return $this->stage; }
    public function setStage(string $stage): static { $this->stage = $stage; return $this; }
    public function getPurpose(): string { return $this->purpose; }
    public function setPurpose(string $purpose): static { $this->purpose = $purpose; return $this; }
    public function getReference(): ?string { return $this->reference; }
    public function setReference(?string $reference): static { $this->reference = $reference; return $this; }
    public function getProvider(): string { return $this->provider; }
    public function setProvider(string $provider): static { $this->provider = $provider; return $this; }
    public function getModel(): string { return $this->model; }
    public function setModel(string $model): static { $this->model = $model; return $this; }
    public function getPromptVersion(): string { return $this->promptVersion; }
    public function setPromptVersion(string $v): static { $this->promptVersion = $v; return $this; }
    public function getInputTokens(): ?int { return $this->inputTokens; }
    public function setInputTokens(?int $n): static { $this->inputTokens = $n; return $this; }
    public function getOutputTokens(): ?int { return $this->outputTokens; }
    public function setOutputTokens(?int $n): static { $this->outputTokens = $n; return $this; }
    public function getCachedTokens(): ?int { return $this->cachedTokens; }
    public function setCachedTokens(?int $n): static { $this->cachedTokens = $n; return $this; }
    public function getInputChars(): int { return $this->inputChars; }
    public function setInputChars(int $n): static { $this->inputChars = $n; return $this; }
    public function getDurationMs(): int { return $this->durationMs; }
    public function setDurationMs(int $ms): static { $this->durationMs = $ms; return $this; }
    public function getAttempt(): int { return $this->attempt; }
    public function setAttempt(int $n): static { $this->attempt = $n; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getError(): ?string { return $this->error; }
    public function setError(?string $error): static { $this->error = $error; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function setCreatedAt(\DateTimeImmutable $at): static { $this->createdAt = $at; return $this; }
}
