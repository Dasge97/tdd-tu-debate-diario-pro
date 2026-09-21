<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialEventRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Un acontecimiento: el mismo suceso contado por una o varias noticias.
 *
 * La versión sube cuando cambia la evidencia (entra una noticia nueva o una
 * existente cambia su contenido). Un resumen de hechos calculado para una
 * versión deja de valer en la siguiente.
 */
#[ORM\Entity(repositoryClass: EditorialEventRepository::class)]
#[ORM\Table(name: 'editorial_events')]
#[ORM\Index(name: 'idx_editorial_events_last_seen', columns: ['last_seen_at'])]
class EditorialEvent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 500)]
    private string $title;

    /** Palabras y nombres propios que identifican el suceso; sirven para agrupar noticias nuevas. */
    #[ORM\Column(type: 'json')]
    private array $keywords = [];

    #[ORM\Column(type: 'json')]
    private array $topics = [];

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $firstSeenAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $lastSeenAt;

    #[ORM\Column(type: 'integer', options: ['default' => 1])]
    private int $version = 1;

    /** sha256 de los hashes de contenido de sus noticias, ordenados. */
    #[ORM\Column(type: 'string', length: 64)]
    private string $evidenceHash = '';

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $articleCount = 0;

    /** Fuentes independientes: medios distintos, contando una sola vez cada agencia. */
    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $independentSourceCount = 0;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastPublishedAt = null;

    #[ORM\Column(type: 'integer', nullable: true)]
    private ?int $lastPublishedVersion = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $this->createdAt = $now;
        $this->updatedAt = $now;
        $this->firstSeenAt = $now;
        $this->lastSeenAt = $now;
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getKeywords(): array { return $this->keywords; }
    public function setKeywords(array $keywords): static { $this->keywords = array_values($keywords); return $this; }
    public function getTopics(): array { return $this->topics; }
    public function setTopics(array $topics): static { $this->topics = array_values($topics); return $this; }
    public function getFirstSeenAt(): \DateTimeImmutable { return $this->firstSeenAt; }
    public function setFirstSeenAt(\DateTimeImmutable $at): static { $this->firstSeenAt = $at; return $this; }
    public function getLastSeenAt(): \DateTimeImmutable { return $this->lastSeenAt; }
    public function setLastSeenAt(\DateTimeImmutable $at): static { $this->lastSeenAt = $at; return $this; }
    public function getVersion(): int { return $this->version; }
    public function setVersion(int $version): static { $this->version = $version; return $this; }
    public function getEvidenceHash(): string { return $this->evidenceHash; }
    public function setEvidenceHash(string $hash): static { $this->evidenceHash = $hash; return $this; }
    public function getArticleCount(): int { return $this->articleCount; }
    public function setArticleCount(int $n): static { $this->articleCount = $n; return $this; }
    public function getIndependentSourceCount(): int { return $this->independentSourceCount; }
    public function setIndependentSourceCount(int $n): static { $this->independentSourceCount = $n; return $this; }
    public function getLastPublishedAt(): ?\DateTimeImmutable { return $this->lastPublishedAt; }
    public function setLastPublishedAt(?\DateTimeImmutable $at): static { $this->lastPublishedAt = $at; return $this; }
    public function getLastPublishedVersion(): ?int { return $this->lastPublishedVersion; }
    public function setLastPublishedVersion(?int $v): static { $this->lastPublishedVersion = $v; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    public function touch(): static { $this->updatedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC')); return $this; }
}
