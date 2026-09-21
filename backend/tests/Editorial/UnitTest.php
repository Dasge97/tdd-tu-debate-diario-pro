<?php

declare(strict_types=1);

namespace App\Tests\Editorial;

use App\Service\Editorial\DebateDraftValidator;
use App\Service\Editorial\EditorialConfig;
use App\Service\Editorial\SecretBox;
use PHPUnit\Framework\TestCase;

/** Piezas sin base de datos: cifrado, límites y validación de borradores. */
class UnitTest extends TestCase
{
    public function testLaClaveCifradaNoContieneElTextoYSeRecupera(): void
    {
        $box = new SecretBox('secreto-de-la-app');
        $stored = $box->encrypt('sk-clave-muy-secreta-1234');

        self::assertStringNotContainsString('sk-clave', $stored);
        self::assertSame('sk-clave-muy-secreta-1234', $box->decrypt($stored));
        self::assertSame('…1234', SecretBox::hint('sk-clave-muy-secreta-1234'));
    }

    public function testConOtroAppSecretNoSeDescifra(): void
    {
        $stored = (new SecretBox('uno'))->encrypt('clave');

        $this->expectException(\RuntimeException::class);
        (new SecretBox('otro'))->decrypt($stored);
    }

    public function testLosLimitesIgnoranClavesYTiposQueNoTocan(): void
    {
        $limits = EditorialConfig::mergeLimits([
            'maxCandidates' => '7',
            'maxLlmCalls'   => -3,
            'inventado'     => 99,
            'timezone'      => '',
        ]);

        self::assertSame(7, $limits['maxCandidates']);
        self::assertSame(EditorialConfig::DEFAULT_LIMITS['maxLlmCalls'], $limits['maxLlmCalls']);
        self::assertArrayNotHasKey('inventado', $limits);
        self::assertSame('Europe/Madrid', $limits['timezone']);
    }

    private static function draft(): array
    {
        return [
            'title'        => '¿Debería el ayuntamiento limitar el acceso de vehículos al centro de la ciudad?',
            'question'     => '¿Estás a favor de que el ayuntamiento limite el acceso de vehículos privados al centro desde enero?',
            'card_summary' => 'El ayuntamiento ha presentado un plan para limitar el tráfico en el centro. La medida entraría en vigor en enero.',
            'context'      => implode("\n", ['Qué ha pasado', trim(str_repeat('hecho ', 60)), 'Qué se discute', trim(str_repeat('dilema ', 40)), 'A favor', '• ' . trim(str_repeat('razon ', 25)), '• ' . trim(str_repeat('razon ', 25)), 'En contra', '• ' . trim(str_repeat('objecion ', 25)), '• ' . trim(str_repeat('objecion ', 25)), 'Lo que no se sabe', trim(str_repeat('duda ', 20))]),
            'source_name'  => 'Medio',
            'source_url'   => 'https://medio.example/a',
            'sources'      => [['name' => 'Medio', 'url' => 'https://medio.example/a']],
        ];
    }

    public function testUnBorradorCorrectoPasa(): void
    {
        self::assertSame([], (new DebateDraftValidator())->validate(self::draft(), ['https://medio.example/a']));
    }

    public function testRechazaPreguntaDobleFuenteInventadaYContextoCorto(): void
    {
        $draft = self::draft();
        $draft['question'] = '¿Estás a favor de limitar el tráfico? ¿Y de subir el precio del aparcamiento en el centro?';
        $draft['context'] = 'Demasiado corto.';
        $draft['sources'][] = ['name' => 'X', 'url' => 'https://inventada.example'];

        $errors = implode(' | ', (new DebateDraftValidator())->validate($draft, ['https://medio.example/a']));

        self::assertStringContainsString('más de una pregunta', $errors);
        self::assertStringContainsString('context tiene 2 palabras', $errors);
        self::assertStringContainsString('sin los bloques', $errors);
        self::assertStringContainsString('fuentes no pertenece', $errors);
    }

    public function testRechazaVocabularioInternoDelMotor(): void
    {
        $draft = self::draft();
        $draft['card_summary'] = 'Según los extractos disponibles, el ayuntamiento ha presentado un plan para limitar el tráfico en el centro.';

        $errors = implode(' | ', (new DebateDraftValidator())->validate($draft, ['https://medio.example/a']));

        self::assertStringContainsString('vocabulario interno', $errors);
    }
}
