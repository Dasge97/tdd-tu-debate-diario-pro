<?php

declare(strict_types=1);

namespace App\Service\Editorial;

/**
 * Cifra y descifra secretos guardados en la base de datos (la clave del modelo).
 *
 * La clave de cifrado se deriva de APP_SECRET, que no está en la base de
 * datos: una copia de la base de datos sola no basta para leer la clave.
 */
class SecretBox
{
    private const PREFIX = 'sb1:';

    private readonly string $key;

    public function __construct(string $appSecret)
    {
        if ($appSecret === '') {
            throw new \LogicException('APP_SECRET vacío: no se pueden cifrar secretos.');
        }
        $this->key = sodium_crypto_generichash('tdd-editorial-secret:' . $appSecret, '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
    }

    public function encrypt(string $plain): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        return self::PREFIX . base64_encode($nonce . sodium_crypto_secretbox($plain, $nonce, $this->key));
    }

    public function decrypt(string $stored): string
    {
        if (!str_starts_with($stored, self::PREFIX)) {
            throw new \RuntimeException('Secreto con formato desconocido.');
        }
        $raw = base64_decode(substr($stored, strlen(self::PREFIX)), true);
        if ($raw === false || strlen($raw) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            throw new \RuntimeException('Secreto dañado.');
        }
        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open(substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, $this->key);
        if ($plain === false) {
            throw new \RuntimeException('No se pudo descifrar el secreto: ¿ha cambiado APP_SECRET?');
        }
        return $plain;
    }

    /** Últimos cuatro caracteres, para enseñar en el panel qué clave hay puesta. */
    public static function hint(string $plain): string
    {
        return '…' . substr($plain, -4);
    }
}
