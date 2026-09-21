<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\EditorialRun;
use App\Entity\User;
use App\Entity\WorkerConfig;
use App\Service\Editorial\EditorialConfig;
use App\Service\Editorial\EditorialPublisher;
use App\Service\Editorial\EditorialRunService;
use App\Service\Editorial\EditorialStore;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/** Las pantallas del motor editorial se ven con datos reales y la clave nunca aparece. */
class AdminPanelTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = self::createClient();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($this->em);
        $metadata = $this->em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
        $config = new WorkerConfig();
        $config->setId(1);
        $this->em->persist($config);

        $admin = (new User())->setUsername('admin')->setEmail('admin@test.internal')->setPasswordHash(password_hash('clave-admin', PASSWORD_BCRYPT));
        $admin->setRole('admin');
        $this->em->persist($admin);
        $this->em->flush();

        $this->client->request('POST', '/admin/login', ['email' => 'admin@test.internal', 'password' => 'clave-admin']);
        self::assertResponseRedirects('/admin/dashboard');
    }

    public function testConfiguraElModeloSinMostrarLaClave(): void
    {
        $this->client->request('POST', '/admin/editorial/config', [
            'engine' => 'v2', 'mode' => 'dry_run', 'llmBaseUrl' => 'https://auth2api.example', 'llmModel' => 'gpt-5.5',
            'llmApiKey' => 'sk-secreta-abcd1234', 'billingBasis' => 'subscription', 'limits' => ['maxCandidates' => '8'],
        ]);
        self::assertResponseRedirects('/admin/editorial?guardado=1');

        $crawler = $this->client->request('GET', '/admin/editorial');
        self::assertResponseIsSuccessful();
        $html = $this->client->getResponse()->getContent();
        self::assertStringNotContainsString('sk-secreta-abcd1234', $html);
        self::assertStringContainsString('…1234', $html);
        self::assertSame('8', $crawler->filter('input[name="limits[maxCandidates]"]')->attr('value'));

        $config = self::getContainer()->get(EditorialConfig::class);
        self::assertSame('sk-secreta-abcd1234', $config->apiKey());
        self::assertSame('v2', $config->entity()->getEngine());

        $audit = $this->em->getConnection()->fetchOne("SELECT payload FROM admin_audit_logs WHERE action_type = 'update_editorial_config'");
        self::assertStringNotContainsString('sk-secreta', $audit);

        // Guardar sin escribir clave la conserva.
        $this->client->request('POST', '/admin/editorial/config', ['engine' => 'v2', 'mode' => 'dry_run', 'llmModel' => 'gpt-5.5', 'llmApiKey' => '']);
        self::assertSame('sk-secreta-abcd1234', self::getContainer()->get(EditorialConfig::class)->apiKey());
    }

    public function testMuestraEjecucionUsoYFuentes(): void
    {
        $runs = self::getContainer()->get(EditorialRunService::class);
        $run = $runs->start(EditorialRun::MODE_DRY_RUN, '2026-09-21', 'test', false)['run'];
        $runs->recordStage($run->getId(), ['name' => 'ingest', 'status' => 'done', 'metrics' => ['created' => 12]]);
        $runs->recordLlmCalls($run->getId(), [
            ['stage' => 'dossier', 'purpose' => 'dossier', 'model' => 'gpt-5.5', 'prompt_version' => 'dossier-v1', 'input_tokens' => 1500, 'output_tokens' => 700, 'duration_ms' => 9000, 'status' => 'ok'],
            ['stage' => 'generate', 'purpose' => 'generate', 'model' => 'gpt-5.5', 'prompt_version' => 'generate-v1', 'input_tokens' => null, 'output_tokens' => null, 'duration_ms' => 1000, 'status' => 'error', 'error' => 'HTTP 502'],
        ]);
        $runs->finish($run->getId(), 'incomplete', ['stages' => []], 'solo 3 debates válidos');

        $this->client->request('GET', '/admin/editorial/runs/' . $run->getId());
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('body', 'solo 3 debates válidos');
        self::assertSelectorTextContains('body', 'HTTP 502');

        $this->client->request('GET', '/admin/editorial/uso');
        self::assertResponseIsSuccessful();
        $html = $this->client->getResponse()->getContent();
        self::assertStringContainsString('2.200', $html, 'tokens de entrada + salida');
        self::assertStringContainsString('suscripción', $html);

        $this->client->request('POST', '/admin/editorial/fuentes', ['name' => 'Medio Nuevo', 'url' => 'https://medio.example/rss', 'topics' => 'economía']);
        self::assertResponseRedirects('/admin/editorial/fuentes');
        $this->client->request('GET', '/admin/editorial/fuentes');
        self::assertSelectorTextContains('body', 'Medio Nuevo');

        $this->client->request('POST', '/admin/editorial/fuentes', ['name' => 'Mala', 'url' => 'http://no-https.example']);
        self::assertResponseRedirects();
        self::assertStringContainsString('error=', $this->client->getResponse()->headers->get('Location'));
    }

    public function testSinSesionRedirigeAlLogin(): void
    {
        $this->client->request('GET', '/admin/logout');
        $this->client->request('GET', '/admin/editorial/uso');
        self::assertResponseRedirects('/admin/login');
    }
}
