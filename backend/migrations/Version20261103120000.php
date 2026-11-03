<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Debate del día: marca en debates el que se anuncia fuera de la app.
 * Los debates existentes quedan sin marcar.
 */
final class Version20261103120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Debate del día';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf(!$this->connection->getDatabasePlatform() instanceof AbstractMySQLPlatform, 'Migración escrita para MySQL. En desarrollo usa doctrine:schema:update.');

        $this->addSql('ALTER TABLE debates ADD featured TINYINT(1) DEFAULT 0 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE debates DROP featured');
    }
}
