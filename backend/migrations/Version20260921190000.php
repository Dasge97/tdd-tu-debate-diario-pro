<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Motor editorial V2: fuentes, noticias, acontecimientos, dossiers,
 * ejecuciones, etapas, llamadas al modelo y asignaciones. Añade a debates la
 * relación con el acontecimiento y a worker_config la configuración del V2.
 *
 * Es la primera migración del proyecto. Hasta ahora el esquema de producción
 * se aplicaba con doctrine:schema:update; esta migración parte de ese esquema
 * (comprobado contra una copia de su estructura) y solo añade lo nuevo.
 * Los debates existentes no se tocan: las columnas nuevas quedan a NULL.
 */
final class Version20260921190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Motor editorial V2';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof AbstractMySQLPlatform, 'Migración escrita para MySQL. En desarrollo usa doctrine:schema:update.');

        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_articles (id BIGINT AUTO_INCREMENT NOT NULL, url VARCHAR(1024) NOT NULL, canonical_url VARCHAR(1024) DEFAULT NULL, url_hash VARCHAR(64) NOT NULL, title VARCHAR(500) NOT NULL, excerpt LONGTEXT DEFAULT NULL, content_hash VARCHAR(64) NOT NULL, published_at DATETIME DEFAULT NULL, source_updated_at DATETIME DEFAULT NULL, fetched_at DATETIME NOT NULL, language VARCHAR(8) DEFAULT 'es' NOT NULL, agency VARCHAR(40) DEFAULT NULL, source_id INT NOT NULL, event_id BIGINT DEFAULT NULL, UNIQUE INDEX UNIQ_94524384CFECAB00 (url_hash), INDEX IDX_94524384953C1C61 (source_id), INDEX IDX_9452438471F7E88B (event_id), INDEX idx_editorial_articles_published (published_at), INDEX idx_editorial_articles_fetched (fetched_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_assignments (id BIGINT AUTO_INCREMENT NOT NULL, editorial_day DATE NOT NULL, slot INT NOT NULL, event_version INT NOT NULL, scores JSON NOT NULL, reasons JSON NOT NULL, status VARCHAR(20) NOT NULL, draft JSON DEFAULT NULL, review JSON DEFAULT NULL, rejection_reason LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, run_id VARCHAR(36) NOT NULL, persona_id BIGINT NOT NULL, event_id BIGINT NOT NULL, dossier_id BIGINT NOT NULL, debate_id BIGINT DEFAULT NULL, INDEX IDX_F07CFCF784E3FEC4 (run_id), INDEX IDX_F07CFCF7F5F88DB9 (persona_id), INDEX IDX_F07CFCF771F7E88B (event_id), INDEX IDX_F07CFCF7611C0C56 (dossier_id), UNIQUE INDEX UNIQ_F07CFCF739A6B6F6 (debate_id), UNIQUE INDEX uniq_editorial_assignment_slot (run_id, slot), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_dossiers (id BIGINT AUTO_INCREMENT NOT NULL, event_version INT NOT NULL, evidence_hash VARCHAR(64) NOT NULL, prompt_version VARCHAR(40) NOT NULL, model VARCHAR(80) NOT NULL, status VARCHAR(20) NOT NULL, data JSON NOT NULL, evidence JSON NOT NULL, created_at DATETIME NOT NULL, event_id BIGINT NOT NULL, INDEX IDX_8801500871F7E88B (event_id), UNIQUE INDEX uniq_editorial_dossier_cache (event_id, evidence_hash, prompt_version, model), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_events (id BIGINT AUTO_INCREMENT NOT NULL, title VARCHAR(500) NOT NULL, keywords JSON NOT NULL, topics JSON NOT NULL, first_seen_at DATETIME NOT NULL, last_seen_at DATETIME NOT NULL, version INT DEFAULT 1 NOT NULL, evidence_hash VARCHAR(64) NOT NULL, article_count INT DEFAULT 0 NOT NULL, independent_source_count INT DEFAULT 0 NOT NULL, last_published_at DATETIME DEFAULT NULL, last_published_version INT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX idx_editorial_events_last_seen (last_seen_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_llm_calls (id BIGINT AUTO_INCREMENT NOT NULL, stage VARCHAR(40) NOT NULL, purpose VARCHAR(40) NOT NULL, reference VARCHAR(60) DEFAULT NULL, provider VARCHAR(40) NOT NULL, model VARCHAR(80) NOT NULL, prompt_version VARCHAR(40) NOT NULL, input_tokens INT DEFAULT NULL, output_tokens INT DEFAULT NULL, cached_tokens INT DEFAULT NULL, input_chars INT DEFAULT 0 NOT NULL, duration_ms INT DEFAULT 0 NOT NULL, attempt INT DEFAULT 1 NOT NULL, status VARCHAR(20) NOT NULL, error LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, run_id VARCHAR(36) NOT NULL, INDEX IDX_79B5CE5E84E3FEC4 (run_id), INDEX idx_editorial_llm_calls_created (created_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_runs (id VARCHAR(36) NOT NULL, editorial_day DATE NOT NULL, mode VARCHAR(12) NOT NULL, status VARCHAR(20) NOT NULL, triggered_by VARCHAR(20) DEFAULT 'manual' NOT NULL, config JSON NOT NULL, metrics JSON NOT NULL, error LONGTEXT DEFAULT NULL, published_count INT DEFAULT 0 NOT NULL, started_at DATETIME NOT NULL, heartbeat_at DATETIME NOT NULL, finished_at DATETIME DEFAULT NULL, INDEX idx_editorial_runs_day (editorial_day), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_run_stages (id BIGINT AUTO_INCREMENT NOT NULL, name VARCHAR(40) NOT NULL, status VARCHAR(20) NOT NULL, attempts INT DEFAULT 1 NOT NULL, metrics JSON NOT NULL, error LONGTEXT DEFAULT NULL, started_at DATETIME NOT NULL, finished_at DATETIME DEFAULT NULL, run_id VARCHAR(36) NOT NULL, INDEX IDX_695EDC2684E3FEC4 (run_id), UNIQUE INDEX uniq_editorial_stage (run_id, name), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE editorial_sources (id INT AUTO_INCREMENT NOT NULL, slug VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, type VARCHAR(20) DEFAULT 'rss' NOT NULL, url VARCHAR(1024) NOT NULL, language VARCHAR(8) DEFAULT 'es' NOT NULL, scope VARCHAR(20) DEFAULT 'es' NOT NULL, topics JSON NOT NULL, origin_type VARCHAR(20) DEFAULT 'medio' NOT NULL, enabled TINYINT DEFAULT 1 NOT NULL, status VARCHAR(20) DEFAULT 'pending' NOT NULL, last_fetched_at DATETIME DEFAULT NULL, last_success_at DATETIME DEFAULT NULL, last_error LONGTEXT DEFAULT NULL, consecutive_failures INT DEFAULT 0 NOT NULL, last_item_count INT DEFAULT 0 NOT NULL, etag VARCHAR(255) DEFAULT NULL, last_modified VARCHAR(64) DEFAULT NULL, created_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_E9751B48989D9B62 (slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_articles ADD CONSTRAINT FK_94524384953C1C61 FOREIGN KEY (source_id) REFERENCES editorial_sources (id) ON DELETE CASCADE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_articles ADD CONSTRAINT FK_9452438471F7E88B FOREIGN KEY (event_id) REFERENCES editorial_events (id) ON DELETE SET NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_assignments ADD CONSTRAINT FK_F07CFCF784E3FEC4 FOREIGN KEY (run_id) REFERENCES editorial_runs (id) ON DELETE CASCADE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_assignments ADD CONSTRAINT FK_F07CFCF7F5F88DB9 FOREIGN KEY (persona_id) REFERENCES users (id)
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_assignments ADD CONSTRAINT FK_F07CFCF771F7E88B FOREIGN KEY (event_id) REFERENCES editorial_events (id)
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_assignments ADD CONSTRAINT FK_F07CFCF7611C0C56 FOREIGN KEY (dossier_id) REFERENCES editorial_dossiers (id)
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_assignments ADD CONSTRAINT FK_F07CFCF739A6B6F6 FOREIGN KEY (debate_id) REFERENCES debates (id) ON DELETE SET NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_dossiers ADD CONSTRAINT FK_8801500871F7E88B FOREIGN KEY (event_id) REFERENCES editorial_events (id) ON DELETE CASCADE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_llm_calls ADD CONSTRAINT FK_79B5CE5E84E3FEC4 FOREIGN KEY (run_id) REFERENCES editorial_runs (id) ON DELETE CASCADE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE editorial_run_stages ADD CONSTRAINT FK_695EDC2684E3FEC4 FOREIGN KEY (run_id) REFERENCES editorial_runs (id) ON DELETE CASCADE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE debates ADD editorial_event_version INT DEFAULT NULL, ADD editorial_key VARCHAR(40) DEFAULT NULL, ADD sources JSON DEFAULT NULL, ADD fact_snapshot JSON DEFAULT NULL, ADD editorial_event_id BIGINT DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE debates ADD CONSTRAINT FK_58BAE2C25A789A67 FOREIGN KEY (editorial_event_id) REFERENCES editorial_events (id) ON DELETE SET NULL
            SQL);
        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX UNIQ_58BAE2C2E9930FB5 ON debates (editorial_key)
            SQL);
        $this->addSql(<<<'SQL'
            CREATE INDEX IDX_58BAE2C25A789A67 ON debates (editorial_event_id)
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE worker_config ADD engine VARCHAR(10) DEFAULT 'v1' NOT NULL, ADD editorial_mode VARCHAR(12) DEFAULT 'dry_run' NOT NULL, ADD llm_base_url VARCHAR(255) DEFAULT NULL, ADD llm_model VARCHAR(80) DEFAULT NULL, ADD llm_api_key_encrypted LONGTEXT DEFAULT NULL, ADD llm_billing JSON DEFAULT NULL, ADD editorial_limits JSON DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof AbstractMySQLPlatform, 'Migración escrita para MySQL.');

        $this->addSql('ALTER TABLE debates DROP FOREIGN KEY FK_58BAE2C25A789A67');
        $this->addSql('DROP INDEX UNIQ_58BAE2C2E9930FB5 ON debates');
        $this->addSql('DROP INDEX IDX_58BAE2C25A789A67 ON debates');
        $this->addSql('ALTER TABLE debates DROP editorial_event_version, DROP editorial_key, DROP sources, DROP fact_snapshot, DROP editorial_event_id');
        $this->addSql('ALTER TABLE worker_config DROP engine, DROP editorial_mode, DROP llm_base_url, DROP llm_model, DROP llm_api_key_encrypted, DROP llm_billing, DROP editorial_limits');
        $this->addSql('ALTER TABLE editorial_articles DROP FOREIGN KEY FK_94524384953C1C61');
        $this->addSql('ALTER TABLE editorial_articles DROP FOREIGN KEY FK_9452438471F7E88B');
        $this->addSql('ALTER TABLE editorial_assignments DROP FOREIGN KEY FK_F07CFCF784E3FEC4');
        $this->addSql('ALTER TABLE editorial_assignments DROP FOREIGN KEY FK_F07CFCF7F5F88DB9');
        $this->addSql('ALTER TABLE editorial_assignments DROP FOREIGN KEY FK_F07CFCF771F7E88B');
        $this->addSql('ALTER TABLE editorial_assignments DROP FOREIGN KEY FK_F07CFCF7611C0C56');
        $this->addSql('ALTER TABLE editorial_assignments DROP FOREIGN KEY FK_F07CFCF739A6B6F6');
        $this->addSql('ALTER TABLE editorial_dossiers DROP FOREIGN KEY FK_8801500871F7E88B');
        $this->addSql('ALTER TABLE editorial_llm_calls DROP FOREIGN KEY FK_79B5CE5E84E3FEC4');
        $this->addSql('ALTER TABLE editorial_run_stages DROP FOREIGN KEY FK_695EDC2684E3FEC4');
        $this->addSql('DROP TABLE editorial_articles');
        $this->addSql('DROP TABLE editorial_assignments');
        $this->addSql('DROP TABLE editorial_dossiers');
        $this->addSql('DROP TABLE editorial_events');
        $this->addSql('DROP TABLE editorial_llm_calls');
        $this->addSql('DROP TABLE editorial_runs');
        $this->addSql('DROP TABLE editorial_run_stages');
        $this->addSql('DROP TABLE editorial_sources');
    }
}
