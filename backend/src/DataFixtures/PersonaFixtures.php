<?php

declare(strict_types=1);

namespace App\DataFixtures;

use App\Entity\User;
use App\Entity\WorkerConfig;
use App\Persona\PersonaCatalog;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

class PersonaFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        foreach (PersonaCatalog::PERSONAS as $personaData) {
            // Check if persona already exists
            $existing = $manager->getRepository(User::class)->findOneBy(['username' => $personaData['username']]);
            if ($existing !== null) {
                continue;
            }

            $user = new User();
            $user->setUsername($personaData['username']);
            $user->setEmail($personaData['username'] . '@tdd-app.internal');
            $user->setPasswordHash(password_hash('ai_persona_internal', PASSWORD_BCRYPT));
            $user->setIsAiPersona(true);
            $user->setRole('user');
            $user->setStatus('active');
            PersonaCatalog::apply($user, $personaData);

            $manager->persist($user);
        }

        // WorkerConfig singleton (id=1)
        $existingConfig = $manager->getRepository(WorkerConfig::class)->find(1);
        if ($existingConfig === null) {
            $config = new WorkerConfig();
            $config->setId(1);
            $config->setSchedule('0 7 * * *');
            $config->setEnabled(true);
            $config->setTriggerPending(false);
            $config->setDedupDays(14);
            $config->setRotationLimitDays(3);
            $config->setTargetDebates(5);
            $config->setOpencodeModel('gpt-4o');
            $config->setOpencodeProvider('openai');

            $manager->persist($config);
        }

        $manager->flush();
    }
}
