<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\EditorialArticleRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Una noticia descargada de una fuente. Guarda solo el extracto que publica
 * el propio feed; no se descarga la página completa.
 */
#[ORM\Entity(repositoryClass: EditorialArticleRepository::class)]
#[ORM\Table(name: 'editorial_articles')]
#[ORM\Index(name: 'idx_editorial_articles_published', columns: ['published_at'])]
#[ORM\Index(name: 'idx_editorial_articles_fetched', columns: ['fetched_at'])]
class EditorialArticle
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'bigint')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: EditorialSource::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EditorialSource $source;

    #[ORM\Column(type: 'string', length: 1024)]
    private string $url;

    #[ORM\Column(type: 'string', length: 1024, nullable: true)]
    private ?string $canonicalUrl = null;

    /** sha256 de la URL normalizada; identifica la noticia entre descargas. */
    #[ORM\Column(type: 'string', length: 64, unique: true)]
    private string $urlHash;

    #[ORM\Column(type: 'string', length: 500)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $excerpt = null;

    /** sha256 de título + extracto normalizados; cambia si la noticia cambia. */
    #[ORM\Column(type: 'string', length: 64)]
    private string $contentHash;

    /** Fecha que da la fuente. Null si la fuente no la da: nunca se sustituye por la de descarga. */
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $publishedAt = null;

    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $sourceUpdatedAt = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $fetchedAt;

    #[ORM\Column(type: 'string', length: 8, options: ['default' => 'es'])]
    private string $language = 'es';

    /** Agencia de origen detectada en el texto (EFE, Europa Press...). Varias copias de una agencia son una sola confirmación. */
    #[ORM\Column(type: 'string', length: 40, nullable: true)]
    private ?string $agency = null;

    #[ORM\ManyToOne(targetEntity: EditorialEvent::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?EditorialEvent $event = null;

    public function __construct()
    {
        $this->fetchedAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    public function getId(): ?int { return $this->id !== null ? (int) $this->id : null; }
    public function getSource(): EditorialSource { return $this->source; }
    public function setSource(EditorialSource $source): static { $this->source = $source; return $this; }
    public function getUrl(): string { return $this->url; }
    public function setUrl(string $url): static { $this->url = $url; return $this; }
    public function getCanonicalUrl(): ?string { return $this->canonicalUrl; }
    public function setCanonicalUrl(?string $url): static { $this->canonicalUrl = $url; return $this; }
    public function getUrlHash(): string { return $this->urlHash; }
    public function setUrlHash(string $hash): static { $this->urlHash = $hash; return $this; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getExcerpt(): ?string { return $this->excerpt; }
    public function setExcerpt(?string $excerpt): static { $this->excerpt = $excerpt; return $this; }
    public function getContentHash(): string { return $this->contentHash; }
    public function setContentHash(string $hash): static { $this->contentHash = $hash; return $this; }
    public function getPublishedAt(): ?\DateTimeImmutable { return $this->publishedAt; }
    public function setPublishedAt(?\DateTimeImmutable $at): static { $this->publishedAt = $at; return $this; }
    public function getSourceUpdatedAt(): ?\DateTimeImmutable { return $this->sourceUpdatedAt; }
    public function setSourceUpdatedAt(?\DateTimeImmutable $at): static { $this->sourceUpdatedAt = $at; return $this; }
    public function getFetchedAt(): \DateTimeImmutable { return $this->fetchedAt; }
    public function setFetchedAt(\DateTimeImmutable $at): static { $this->fetchedAt = $at; return $this; }
    public function getLanguage(): string { return $this->language; }
    public function setLanguage(string $language): static { $this->language = $language; return $this; }
    public function getAgency(): ?string { return $this->agency; }
    public function setAgency(?string $agency): static { $this->agency = $agency; return $this; }
    public function getEvent(): ?EditorialEvent { return $this->event; }
    public function setEvent(?EditorialEvent $event): static { $this->event = $event; return $this; }
}
