<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\ShadowBanService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:review-shadow-bans',
    description: 'Levanta la ocultacion de las cuentas que han vuelto a aportar bien'
)]
class ReviewShadowBansCommand extends Command
{
    public function __construct(
        private readonly ShadowBanService $shadowBanService
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $io->title('Revision de cuentas ocultas');

        try {
            $levantados = $this->shadowBanService->reviewBanned();
            $io->success("Revision terminada. Cuentas que vuelven a verse: {$levantados}.");
        } catch (\Exception $e) {
            $io->error('Error durante la revision: ' . $e->getMessage());
            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
