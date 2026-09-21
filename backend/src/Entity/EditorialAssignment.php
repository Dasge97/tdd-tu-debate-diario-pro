<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialAssignmentRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Qué acontecimiento trata cada personaje en una ejecución, por qué, y el
 * debate que salió de ahí. Es el contrato entre selección, generación y
 * publicación: nadie interpreta texto libre del modelo para saber qué va con qué.
 */
#[ORM\Entity(repositoryClass: EditorialAssignmentRepository::class)]
#[ORM\Table(name: 'editorial_assignments')]
#[ORM\UniqueConstraint(name: 'uniq_editorial_assignment_slot', columns: ['run_id', 'slot'])]
class EditorialAssignment
{
    /**
     * planned: elegida. generated: el modelo devolvió un borrador. validated:
     * pasó validación y revisión. rejected: no se puede publicar (motivo en
     * rejectionReason). published: convertida en debate.
     */
    public const STATUSES = ['planned', 'generated', 'validated', 'rejected', 'published'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: EditorialRun::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EditorialRun $run;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $editorialDay;

    /** Orden dentro de la ejecución. Los reemplazos toman un número nuevo. */
    #[ORM\Column(type: 'integer')]
    private int $slot;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $persona;

    #[ORM\ManyToOne(targetEntity: EditorialEvent::class)]
    #[ORM\JoinColumn(nullable: false)]
    private EditorialEvent $event;

    #[ORM\Column(type: 'integer')]
    private int $eventVersion;

    #[ORM\ManyToOne(targetEntity: EditorialDossier::class)]
    #[ORM\JoinColumn(nullable: false)]
    private EditorialDossier $dossier;

    /** Puntuaciones que llevaron a la elección (actualidad, encaje, rotación...). */
    #[ORM\Column(type: 'json')]
    private array $scores = [];

    /** Motivos legibles, incluidas las excepciones de rotación. */
    #[ORM\Column(type: 'json')]
    private array $reasons = [];

    #[ORM\Column(type: 'string', length: 20)]
    private string $status = 'planned';

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $draft = null;

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $review = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $rejectionReason = null;

    #[ORM\OneToOne(targetEntity: Debate::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Debate $debate = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getRun(): EditorialRun { return $this->run; }
    public function setRun(EditorialRun $run): static { $this->run = $run; return $this; }
    public function getEditorialDay(): \DateTimeImmutable { return $this->editorialDay; }
    public function setEditorialDay(\DateTimeImmutable $day): static { $this->editorialDay = $day; return $this; }
    public function getSlot(): int { return $this->slot; }
    public function setSlot(int $slot): static { $this->slot = $slot; return $this; }
    public function getPersona(): User { return $this->persona; }
    public function setPersona(User $persona): static { $this->persona = $persona; return $this; }
    public function getEvent(): EditorialEvent { return $this->event; }
    public function setEvent(EditorialEvent $event): static { $this->event = $event; return $this; }
    public function getEventVersion(): int { return $this->eventVersion; }
    public function setEventVersion(int $v): static { $this->eventVersion = $v; return $this; }
    public function getDossier(): EditorialDossier { return $this->dossier; }
    public function setDossier(EditorialDossier $dossier): static { $this->dossier = $dossier; return $this; }
    public function getScores(): array { return $this->scores; }
    public function setScores(array $scores): static { $this->scores = $scores; return $this; }
    public function getReasons(): array { return $this->reasons; }
    public function setReasons(array $reasons): static { $this->reasons = $reasons; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; $this->touch(); return $this; }
    public function getDraft(): ?array { return $this->draft; }
    public function setDraft(?array $draft): static { $this->draft = $draft; $this->touch(); return $this; }
    public function getReview(): ?array { return $this->review; }
    public function setReview(?array $review): static { $this->review = $review; return $this; }
    public function getRejectionReason(): ?string { return $this->rejectionReason; }
    public function setRejectionReason(?string $reason): static { $this->rejectionReason = $reason; return $this; }
    public function getDebate(): ?Debate { return $this->debate; }
    public function setDebate(?Debate $debate): static { $this->debate = $debate; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }

    private function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }
}
