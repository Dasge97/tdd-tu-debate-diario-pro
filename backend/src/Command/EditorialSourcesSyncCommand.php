<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\EditorialSource;
use App\Repository\EditorialSourceRepository;
use App\Service\Editorial\EditorialSourceCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:editorial:sources:sync',
    description: 'Da de alta las fuentes del catálogo que falten; no toca las que ya existen'
)]
class EditorialSourcesSyncCommand extends Command
{
    public function __construct(
        private readonly EditorialSourceRepository $sources,
        private readonly EntityManagerInterface $em,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $created = 0;

        foreach (EditorialSourceCatalog::SOURCES as $s) {
            // Una fuente que ya existe se respeta tal cual: puede que un administrador la haya cambiado o desactivado.
            if ($this->sources->findOneBy(['slug' => $s['slug']]) !== null) {
                continue;
            }
            $this->em->persist((new EditorialSource())
                ->setSlug($s['slug'])
                ->setName($s['name'])
                ->setType($s['type'])
                ->setUrl($s['url'])
                ->setScope($s['scope'])
                ->setOriginType($s['origin'])
                ->setTopics($s['topics']));
            $created++;
        }
        $this->em->flush();

        $io->success(sprintf('Fuentes nuevas: %d. Total en el catálogo: %d.', $created, count(EditorialSourceCatalog::SOURCES)));
        return Command::SUCCESS;
    }
}
