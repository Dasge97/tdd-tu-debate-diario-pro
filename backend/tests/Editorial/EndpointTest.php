<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\WorkerConfig;
use App\Service\Editorial\EditorialConfig;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/** Los endpoints internos exigen la clave del worker y no filtran la clave del modelo. */
class EndpointTest extends WebTestCase
{
    public function testSinClaveDelWorkerNoHayAcceso(): void
    {
        $client = self::createClient();
        $this->resetSchema();

        $client->request('GET', '/api/v1/worker/editorial/config');
        self::assertResponseStatusCodeSame(401);

        $client->request('GET', '/api/v1/worker/editorial/config', server: ['HTTP_X_WORKER_KEY' => 'otra']);
        self::assertResponseStatusCodeSame(401);
    }

    public function testLaConfiguracionLlegaAlWorkerYLaEjecucionNoGuardaLaClave(): void
    {
        $client = self::createClient();
        $this->resetSchema();
        self::getContainer()->get(EditorialConfig::class)->setApiKey('sk-prueba-9876');

        $client->request('GET', '/api/v1/worker/editorial/config', server: ['HTTP_X_WORKER_KEY' => 'test_worker_key']);
        self::assertResponseIsSuccessful();
        $config = json_decode($client->getResponse()->getContent(), true);
        self::assertSame('sk-prueba-9876', $config['llm']['api_key']);
        self::assertSame('dry_run', $config['mode']);

        $client->request('POST', '/api/v1/worker/editorial/runs', server: ['HTTP_X_WORKER_KEY' => 'test_worker_key'], content: json_encode([
            'mode' => 'dry_run', 'editorial_day' => '2026-09-21', 'triggered_by' => 'test',
        ]));
        self::assertResponseStatusCodeSame(201);

        $stored = self::getContainer()->get(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT config FROM editorial_runs');
        self::assertStringNotContainsString('sk-prueba-9876', $stored);
        $dbKey = self::getContainer()->get(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT llm_api_key_encrypted FROM worker_config');
        self::assertStringNotContainsString('sk-prueba-9876', $dbKey);
    }

    public function testUnSegundoArranqueDevuelve409(): void
    {
        $client = self::createClient();
        $this->resetSchema();
        $body = json_encode(['mode' => 'dry_run', 'editorial_day' => '2026-09-21', 'triggered_by' => 'test']);

        $client->request('POST', '/api/v1/worker/editorial/runs', server: ['HTTP_X_WORKER_KEY' => 'test_worker_key'], content: $body);
        $client->request('POST', '/api/v1/worker/editorial/runs', server: ['HTTP_X_WORKER_KEY' => 'test_worker_key'], content: $body);

        self::assertResponseStatusCodeSame(409);
    }

    private function resetSchema(): void
    {
        $em = self::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($em);
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
        $config = new WorkerConfig();
        $config->setId(1);
        $em->persist($config);
        $em->flush();
    }
}
