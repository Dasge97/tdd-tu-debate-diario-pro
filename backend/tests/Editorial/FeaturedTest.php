<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Entity\Debate;
use App\Entity\User;
use App\Entity\WorkerConfig;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/** El debate del día se lee sin cuenta y se puede cambiar desde el panel. */
class FeaturedTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;
    /** @var Debate[] */
    private array $debates = [];

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

        $persona = (new User())->setUsername('nyx')->setEmail('nyx@test.internal')->setPasswordHash('x');
        $persona->setIsAiPersona(true);
        $this->em->persist($persona);
        $admin = (new User())->setUsername('admin')->setEmail('admin@test.internal')->setPasswordHash(password_hash('clave-admin', PASSWORD_BCRYPT));
        $admin->setRole('admin');
        $this->em->persist($admin);

        foreach ([true, false] as $i => $featured) {
            $debate = (new Debate())
                ->setTitle("Debate {$i}")
                ->setContext('Contexto')
                ->setDayDate(new \DateTime('2026-09-21'))
                ->setCreatedBy($persona)
                ->setFeatured($featured);
            $this->em->persist($debate);
            $this->debates[] = $debate;
        }
        $this->em->flush();
    }

    public function testLaOtraAppLeeElDebateDelDiaSinCuenta(): void
    {
        $this->client->request('GET', '/api/v1/debates/featured?date=2026-09-21');
        self::assertResponseIsSuccessful();
        $body = json_decode($this->client->getResponse()->getContent(), true);
        self::assertSame($this->debates[0]->getId(), $body['id']);
        self::assertTrue($body['featured']);
        self::assertSame('https://tudebatediario.com/app/debate/' . $body['id'], $body['url']);

        $this->client->request('GET', '/api/v1/debates/featured?date=2026-09-22');
        self::assertResponseStatusCodeSame(404);

        $this->client->request('GET', '/api/v1/debates/featured?date=21-09-2026');
        self::assertResponseStatusCodeSame(400);
    }

    public function testDesdeElPanelSeCambiaElDebateDelDia(): void
    {
        $this->client->request('POST', '/admin/login', ['email' => 'admin@test.internal', 'password' => 'clave-admin']);
        $this->client->request('POST', '/admin/debates/' . $this->debates[1]->getId() . '/featured');
        self::assertResponseRedirects();

        $featured = $this->em->getConnection()->fetchFirstColumn('SELECT id FROM debates WHERE featured = 1');
        self::assertSame([(string) $this->debates[1]->getId()], array_map('strval', $featured));
    }
}
