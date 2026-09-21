<?php

declare(strict_types=1);

namespace App\Command;

use App\Persona\PersonaCatalog;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:personajes:sincronizar',
    description: 'Vuelca las fichas de PersonaCatalog sobre los personajes que ya existen'
)]
class SincronizarPersonajesCommand extends Command
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly EntityManagerInterface $em
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Sincronizacion de personajes');

        // Pisa lo que se haya editado desde el admin en estos campos.
        $actualizados = 0;
        foreach (PersonaCatalog::PERSONAS as $persona) {
            $user = $this->userRepository->findOneBy(['username' => $persona['username']]);
            if ($user === null || !$user->isAiPersona()) {
                $io->warning("No existe el personaje {$persona['username']}. Se salta.");
                continue;
            }

            PersonaCatalog::apply($user, $persona);
            $actualizados++;
        }

        $this->em->flush();
        $io->success("Personajes actualizados: {$actualizados}.");

        return Command::SUCCESS;
    }
}
