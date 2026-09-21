<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialSourceRepository;
use Doctrine\ORM\Mapping as ORM;

/** Una fuente de noticias (RSS/Atom) del catálogo del motor editorial. */
#[ORM\Entity(repositoryClass: EditorialSourceRepository::class)]
#[ORM\Table(name: 'editorial_sources')]
class EditorialSource
{
    public const TYPES = ['rss', 'atom'];
    public const SCOPES = ['es', 'intl'];
    /** medio: redacción propia; agencia: EFE, Europa Press...; institucional: organismo público. */
    public const ORIGIN_TYPES = ['medio', 'agencia', 'institucional'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(type: 'string', length: 80, unique: true)]
    private string $slug;

    #[ORM\Column(type: 'string', length: 120)]
    private string $name;

    #[ORM\Column(type: 'string', length: 20, options: ['default' => 'rss'])]
    private string $type = 'rss';

    #[ORM\Column(type: 'string', length: 1024)]
    private string $url;

    #[ORM\Column(type: 'string', length: 8, options: ['default' => 'es'])]
    private string $language = 'es';

    #[ORM\Column(type: 'string', length: 20, options: ['default' => 'es'])]
    private string $scope = 'es';

    /** Especialidades de personaje que suele cubrir (economía, ciencia...). */
    #[ORM\Column(type: 'json')]
    private array $topics = [];

    #[ORM\Column(type: 'string', length: 20, options: ['default' => 'medio'])]
    private string $originType = 'medio';

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $enabled = true;

    /** pending, ok o error, según la última descarga. */
    #[ORM\Column(type: 'string', length: 20, options: ['default' => 'pending'])]
    private string $status = 'pending';

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastFetchedAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastSuccessAt = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $lastError = null;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $consecutiveFailures = 0;

    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    private int $lastItemCount = 0;

    /** Cabeceras para la descarga condicional. */
    #[ORM\Column(type: 'string', length: 255, nullable: true)]
    private ?string $etag = null;

    #[ORM\Column(type: 'string', length: 64, nullable: true)]
    private ?string $lastModified = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int { return $this->id; }
    public function getSlug(): string { return $this->slug; }
    public function setSlug(string $slug): static { $this->slug = $slug; return $this; }
    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }
    public function getType(): string { return $this->type; }
    public function setType(string $type): static { $this->type = $type; return $this; }
    public function getUrl(): string { return $this->url; }
    public function setUrl(string $url): static { $this->url = $url; return $this; }
    public function getLanguage(): string { return $this->language; }
    public function setLanguage(string $language): static { $this->language = $language; return $this; }
    public function getScope(): string { return $this->scope; }
    public function setScope(string $scope): static { $this->scope = $scope; return $this; }
    public function getTopics(): array { return $this->topics; }
    public function setTopics(array $topics): static { $this->topics = array_values($topics); return $this; }
    public function getOriginType(): string { return $this->originType; }
    public function setOriginType(string $originType): static { $this->originType = $originType; return $this; }
    public function isEnabled(): bool { return $this->enabled; }
    public function setEnabled(bool $enabled): static { $this->enabled = $enabled; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): static { $this->status = $status; return $this; }
    public function getLastFetchedAt(): ?\DateTimeImmutable { return $this->lastFetchedAt; }
    public function setLastFetchedAt(?\DateTimeImmutable $at): static { $this->lastFetchedAt = $at; return $this; }
    public function getLastSuccessAt(): ?\DateTimeImmutable { return $this->lastSuccessAt; }
    public function setLastSuccessAt(?\DateTimeImmutable $at): static { $this->lastSuccessAt = $at; return $this; }
    public function getLastError(): ?string { return $this->lastError; }
    public function setLastError(?string $error): static { $this->lastError = $error; return $this; }
    public function getConsecutiveFailures(): int { return $this->consecutiveFailures; }
    public function setConsecutiveFailures(int $n): static { $this->consecutiveFailures = $n; return $this; }
    public function getLastItemCount(): int { return $this->lastItemCount; }
    public function setLastItemCount(int $n): static { $this->lastItemCount = $n; return $this; }
    public function getEtag(): ?string { return $this->etag; }
    public function setEtag(?string $etag): static { $this->etag = $etag; return $this; }
    public function getLastModified(): ?string { return $this->lastModified; }
    public function setLastModified(?string $lastModified): static { $this->lastModified = $lastModified; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
