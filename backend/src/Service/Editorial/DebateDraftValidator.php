<?php

declare(strict_types=1);

namespace App\Service\Editorial;

/**
 * Comprobaciones deterministas de un borrador de debate antes de publicarlo.
 *
 * Son las mismas que hace el worker (worker/src/v2/validate.js). El backend
 * las repite porque no se fía de lo que le llega: es el último paso antes de
 * que el debate lo vea la comunidad.
 */
class DebateDraftValidator
{
    public const TITLE_MIN = 60;
    public const TITLE_MAX = 120;
    public const QUESTION_MIN = 80;
    public const QUESTION_MAX = 160;
    public const SUMMARY_MIN = 100;
    public const SUMMARY_MAX = 220;
    public const CONTEXT_MIN_WORDS = 200;
    public const CONTEXT_MAX_WORDS = 420;
    /** Bloques obligatorios del contexto, cada título en su propia línea. */
    public const CONTEXT_SECTIONS = ['Qué ha pasado', 'Qué se discute', 'A favor', 'En contra'];

    /**
     * @param array    $draft        title, question, card_summary, context, source_url, sources[]
     * @param string[] $evidenceUrls URLs de las noticias que el motor recuperó para ese acontecimiento
     * @return string[] errores; vacío si el borrador es válido
     */
    public function validate(array $draft, array $evidenceUrls): array
    {
        $errors = [];

        foreach (['title', 'question', 'card_summary', 'context', 'source_url', 'source_name'] as $field) {
            if (!isset($draft[$field]) || !is_string($draft[$field]) || trim($draft[$field]) === '') {
                $errors[] = "falta el campo {$field}";
            }
        }
        if ($errors !== []) {
            return $errors;
        }

        $title = trim($draft['title']);
        $question = trim($draft['question']);
        $len = static fn(string $s): int => mb_strlen($s);

        if ($len($title) < self::TITLE_MIN || $len($title) > self::TITLE_MAX) {
            $errors[] = sprintf('title tiene %d caracteres (%d-%d)', $len($title), self::TITLE_MIN, self::TITLE_MAX);
        }
        if (!str_ends_with($title, '?')) {
            $errors[] = 'title debe terminar en "?"';
        }
        if ($len($question) < self::QUESTION_MIN || $len($question) > self::QUESTION_MAX) {
            $errors[] = sprintf('question tiene %d caracteres (%d-%d)', $len($question), self::QUESTION_MIN, self::QUESTION_MAX);
        }
        if (!str_ends_with($question, '?')) {
            $errors[] = 'question debe terminar en "?"';
        }
        if (mb_strtolower($question) === mb_strtolower($title)) {
            $errors[] = 'question no puede repetir el title';
        }
        // Una pregunta con dos interrogaciones suele ser una pregunta doble.
        if (substr_count($question, '?') > 1) {
            $errors[] = 'question contiene más de una pregunta';
        }

        $summary = trim($draft['card_summary']);
        if ($len($summary) < self::SUMMARY_MIN || $len($summary) > self::SUMMARY_MAX) {
            $errors[] = sprintf('card_summary tiene %d caracteres (%d-%d)', $len($summary), self::SUMMARY_MIN, self::SUMMARY_MAX);
        }

        $words = count(preg_split('/\s+/u', trim($draft['context']), -1, PREG_SPLIT_NO_EMPTY));
        if ($words < self::CONTEXT_MIN_WORDS || $words > self::CONTEXT_MAX_WORDS) {
            $errors[] = sprintf('context tiene %d palabras (%d-%d)', $words, self::CONTEXT_MIN_WORDS, self::CONTEXT_MAX_WORDS);
        }

        // Un debate, no una noticia: bloques obligatorios y los dos lados con los mismos argumentos.
        $sections = self::sections($draft['context']);
        $missing = array_values(array_filter(self::CONTEXT_SECTIONS, static fn(string $h) => empty($sections[$h])));
        if ($missing !== []) {
            $errors[] = 'context sin los bloques: ' . implode(', ', $missing);
        } else {
            $bullets = static fn(string $h) => count(array_filter($sections[$h], static fn(string $l) => str_starts_with($l, '•')));
            $pro = $bullets('A favor');
            $con = $bullets('En contra');
            if ($pro < 2 || $con < 2) {
                $errors[] = "A favor y En contra necesitan al menos 2 argumentos (hay {$pro} y {$con})";
            } elseif ($pro !== $con) {
                $errors[] = "A favor tiene {$pro} argumentos y En contra {$con}";
            }
        }

        // Vocabulario interno del motor que el lector no debe ver.
        foreach (['title', 'question', 'card_summary', 'context'] as $field) {
            if (preg_match('/\b(dossier|fragmentos?|extractos?)\b/iu', $draft[$field])) {
                $errors[] = "{$field} usa vocabulario interno (dossier, fragmento, extracto)";
            }
        }

        // Ninguna URL puede salir de la nada: todas tienen que ser noticias recuperadas.
        $allowed = array_flip($evidenceUrls);
        if (!isset($allowed[$draft['source_url']])) {
            $errors[] = 'source_url no pertenece a la evidencia recuperada';
        }
        foreach ($draft['sources'] ?? [] as $source) {
            if (!isset($source['url']) || !isset($allowed[$source['url']])) {
                $errors[] = 'una de las fuentes no pertenece a la evidencia recuperada';
                break;
            }
        }

        return $errors;
    }

    /** Parte el contexto en bloques por sus títulos: [título => líneas]. */
    public static function sections(string $context): array
    {
        $known = [...self::CONTEXT_SECTIONS, 'Lo que no se sabe'];
        $out = [];
        $current = null;
        foreach (preg_split('/\R/u', $context) as $raw) {
            $line = trim($raw);
            if ($line === '') {
                continue;
            }
            $heading = rtrim($line, ':');
            if (in_array($heading, $known, true)) {
                $current = $heading;
                $out[$current] = [];
                continue;
            }
            if ($current !== null) {
                $out[$current][] = $line;
            }
        }
        return $out;
    }
}
