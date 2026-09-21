<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\Editorial\EditorialConfig;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Guarda la clave del modelo leyéndola de la entrada estándar, para poder
 * pasarla desde la bóveda sin que aparezca en la línea de órdenes ni en pantalla:
 *
 *   vault-usar "auth2api - tdd" K -- sh -c 'printf %s "$K" | docker exec -i <backend> php bin/console app:editorial:set-llm-key'
 */
#[AsCommand(
    name: 'app:editorial:set-llm-key',
    description: 'Guarda cifrada la clave del modelo del motor editorial (se lee de la entrada estándar)'
)]
class EditorialSetLlmKeyCommand extends Command
{
    public function __construct(private readonly EditorialConfig $config)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('base-url', null, InputOption::VALUE_REQUIRED, 'Dirección base compatible con OpenAI');
        $this->addOption('model', null, InputOption::VALUE_REQUIRED, 'Modelo');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $key = trim((string) stream_get_contents(STDIN));
        if ($key === '') {
            $io->error('No ha llegado ninguna clave por la entrada estándar.');
            return Command::FAILURE;
        }

        $entity = $this->config->entity();
        if ($input->getOption('base-url')) {
            $entity->setLlmBaseUrl((string) $input->getOption('base-url'));
        }
        if ($input->getOption('model')) {
            $entity->setLlmModel((string) $input->getOption('model'));
        }
        $this->config->setApiKey($key);

        $io->success('Clave guardada (termina en ' . substr($key, -4) . ').');
        return Command::SUCCESS;
    }
}
