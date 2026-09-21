<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialDossierRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Resumen de hechos de un acontecimiento en una versión concreta.
 *
 * Se guarda en caché por acontecimiento + hash de la evidencia + versión del
 * prompt + modelo: si nada de eso cambia, no se vuelve a llamar al modelo.
 */
#[ORM\Entity(repositoryClass: EditorialDossierRepository::class)]
#[ORM\Table(name: 'editorial_dossiers')]
#[ORM\UniqueConstraint(name: 'uniq_editorial_dossier_cache', columns: ['event_id', 'evidence_hash', 'prompt_version', 'model'])]
class EditorialDossier
{
    /**
     * ok: se puede redactar un debate de actualidad. background: hay hechos pero
     * ninguna medida concreta; solo sirve para un debate de fondo. insufficient:
     * la evidencia no basta para redactar con rigor.
     */
    public const STATUSES = ['ok', 'background', 'insufficient'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: EditorialEvent::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EditorialEvent $event;

    #[ORM\Column(type: 'integer')]
    private int $eventVersion;

    #[ORM\Column(type: 'string', length: 64)]
    private string $evidenceHash;

    #[ORM\Column(type: 'string', length: 40)]
    private string $promptVersion;

    #[ORM\Column(type: 'string', length: 80)]
    private string $model;

    #[ORM\Column(type: 'string', length: 20)]
    private string $status;

    /** Hechos, declaraciones, cifras, discrepancias, incógnitas y encaje por especialidad. */
    #[ORM\Column(type: 'json')]
    private array $data = [];

    /** Los fragmentos exactos que recibió el modelo, con su id de referencia (E1, E2...). */
    #[ORM\Column(type: 'json')]
    private array $evidence = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getEvent(): EditorialEvent { return $this->event; }
    public function setEvent(EditorialEvent $event): static { $this->event = $event; return $this; }
    public function getEventVersion(): int { return $this->eventVersion; }
    public function setEventVersion(int $v): static { $this->eventVersion = $v; return $this; }
    public function getEvidenceHash(): string { return $this->evidenceHash; }
    public function setEvidenceHash(string $hash): static { $this->evidenceHash = $hash; return $this; }
    public function getPromptVersion(): string { return $this->promptVersion; }
    public function setPromptVersion(string $v): static { $this->promptVersion = $v; return $this; }
    public function getModel(): string { return $this->model; }
    public function setModel(string $model): static { $this->model = $model; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getData(): array { return $this->data; }
    public function setData(array $data): static { $this->data = $data; return $this; }
    public function getEvidence(): array { return $this->evidence; }
    public function setEvidence(array $evidence): static { $this->evidence = $evidence; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
