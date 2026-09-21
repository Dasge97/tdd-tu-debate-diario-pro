<?php

declare(strict_types=1);

namespace App\Service\Editorial;

/**
 * Catálogo inicial de fuentes del motor editorial.
 *
 * Todas se comprobaron el 2026-09-21 desde el servidor de producción: respondían
 * 200 con RSS o Atom y noticias del día. Se guardan solo el titular y el
 * extracto que publica el propio feed; no se descargan las páginas.
 *
 * Descartadas en esa comprobación: RTVE (sus feeds temáticos devuelven contenido
 * antiguo), SINC, Público, elEconomista (403) y las secciones de ciencia y
 * tecnología de El Mundo (404).
 */
final class EditorialSourceCatalog
{
    public const SOURCES = [
        // España: política y generales
        ['slug' => 'elpais-espana', 'name' => 'El País · España', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/espana/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política', 'sociedad']],
        ['slug' => 'elmundo-espana', 'name' => 'El Mundo · España', 'type' => 'rss', 'url' => 'https://e00-elmundo.uecdn.es/elmundo/rss/espana.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => '20minutos-nacional', 'name' => '20minutos · Nacional', 'type' => 'rss', 'url' => 'https://www.20minutos.es/rss/nacional/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política', 'sociedad']],
        ['slug' => 'abc-espana', 'name' => 'ABC · España', 'type' => 'rss', 'url' => 'https://www.abc.es/rss/2.0/espana/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => 'lavanguardia-politica', 'name' => 'La Vanguardia · Política', 'type' => 'rss', 'url' => 'https://www.lavanguardia.com/rss/politica.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => 'eldiario-politica', 'name' => 'elDiario.es · Política', 'type' => 'rss', 'url' => 'https://www.eldiario.es/rss/politica/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => 'elconfidencial-espana', 'name' => 'El Confidencial · España', 'type' => 'atom', 'url' => 'https://rss.elconfidencial.com/espana/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => 'europapress-nacional', 'name' => 'Europa Press · Nacional', 'type' => 'rss', 'url' => 'https://www.europapress.es/rss/rss.aspx?ch=00066', 'scope' => 'es', 'origin' => 'agencia', 'topics' => ['política']],
        // Economía
        ['slug' => 'elpais-economia', 'name' => 'El País · Economía', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'elmundo-economia', 'name' => 'El Mundo · Economía', 'type' => 'rss', 'url' => 'https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'lavanguardia-economia', 'name' => 'La Vanguardia · Economía', 'type' => 'rss', 'url' => 'https://www.lavanguardia.com/rss/economia.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'eldiario-economia', 'name' => 'elDiario.es · Economía', 'type' => 'rss', 'url' => 'https://www.eldiario.es/rss/economia/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'elconfidencial-economia', 'name' => 'El Confidencial · Economía', 'type' => 'atom', 'url' => 'https://rss.elconfidencial.com/economia/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'europapress-economia', 'name' => 'Europa Press · Economía', 'type' => 'rss', 'url' => 'https://www.europapress.es/rss/rss.aspx?ch=00136', 'scope' => 'es', 'origin' => 'agencia', 'topics' => ['economía']],
        ['slug' => 'expansion', 'name' => 'Expansión', 'type' => 'rss', 'url' => 'https://e00-expansion.uecdn.es/rss/portada.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        ['slug' => 'cincodias', 'name' => 'Cinco Días', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['economía']],
        // Ciencia
        ['slug' => 'elpais-ciencia', 'name' => 'El País · Ciencia', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['ciencia']],
        ['slug' => 'lavanguardia-ciencia', 'name' => 'La Vanguardia · Ciencia', 'type' => 'rss', 'url' => 'https://www.lavanguardia.com/rss/ciencia.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['ciencia']],
        ['slug' => '20minutos-ciencia', 'name' => '20minutos · Ciencia', 'type' => 'rss', 'url' => 'https://www.20minutos.es/rss/ciencia/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['ciencia']],
        ['slug' => 'elmundo-ciencia', 'name' => 'El Mundo · Ciencia', 'type' => 'rss', 'url' => 'https://e00-elmundo.uecdn.es/elmundo/rss/ciencia.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['ciencia']],
        // Tecnología
        ['slug' => 'elpais-tecnologia', 'name' => 'El País · Tecnología', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        ['slug' => 'lavanguardia-tecnologia', 'name' => 'La Vanguardia · Tecnología', 'type' => 'rss', 'url' => 'https://www.lavanguardia.com/rss/tecnologia.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        ['slug' => '20minutos-tecnologia', 'name' => '20minutos · Tecnología', 'type' => 'rss', 'url' => 'https://www.20minutos.es/rss/tecnologia/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        ['slug' => 'elconfidencial-tecnologia', 'name' => 'El Confidencial · Tecnología', 'type' => 'atom', 'url' => 'https://rss.elconfidencial.com/tecnologia/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        ['slug' => 'xataka', 'name' => 'Xataka', 'type' => 'rss', 'url' => 'https://www.xataka.com/feedburner.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        ['slug' => 'genbeta', 'name' => 'Genbeta', 'type' => 'rss', 'url' => 'https://www.genbeta.com/feedburner.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['tecnología']],
        // Sociedad
        ['slug' => 'elpais-sociedad', 'name' => 'El País · Sociedad', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['sociedad', 'ética']],
        ['slug' => 'abc-sociedad', 'name' => 'ABC · Sociedad', 'type' => 'rss', 'url' => 'https://www.abc.es/rss/2.0/sociedad/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['sociedad']],
        ['slug' => 'eldiario-sociedad', 'name' => 'elDiario.es · Sociedad', 'type' => 'rss', 'url' => 'https://www.eldiario.es/rss/sociedad/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['sociedad', 'ética']],
        ['slug' => 'newtral', 'name' => 'Newtral', 'type' => 'rss', 'url' => 'https://www.newtral.es/feed/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['sociedad', 'filosofía']],
        ['slug' => 'maldita', 'name' => 'Maldita.es', 'type' => 'rss', 'url' => 'https://maldita.es/feed', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['sociedad', 'filosofía']],
        // Medioambiente
        ['slug' => 'elpais-clima', 'name' => 'El País · Clima y medio ambiente', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/clima-y-medio-ambiente/portada', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['medioambiente']],
        ['slug' => 'lavanguardia-natural', 'name' => 'La Vanguardia · Natural', 'type' => 'rss', 'url' => 'https://www.lavanguardia.com/rss/natural.xml', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['medioambiente']],
        ['slug' => 'elconfidencial-medioambiente', 'name' => 'El Confidencial · Medio ambiente', 'type' => 'atom', 'url' => 'https://rss.elconfidencial.com/medioambiente/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['medioambiente']],
        ['slug' => 'efeverde', 'name' => 'EFE', 'type' => 'rss', 'url' => 'https://efeverde.com/feed/', 'scope' => 'es', 'origin' => 'agencia', 'topics' => ['medioambiente']],
        ['slug' => 'climatica', 'name' => 'Climática', 'type' => 'rss', 'url' => 'https://climatica.coop/feed/', 'scope' => 'es', 'origin' => 'medio', 'topics' => ['medioambiente']],
        // Fuentes primarias institucionales
        ['slug' => 'boe', 'name' => 'BOE', 'type' => 'rss', 'url' => 'https://www.boe.es/rss/boe.php', 'scope' => 'es', 'origin' => 'institucional', 'topics' => ['política', 'economía']],
        ['slug' => 'moncloa', 'name' => 'La Moncloa', 'type' => 'rss', 'url' => 'https://www.lamoncloa.gob.es/Paginas/rss.aspx', 'scope' => 'es', 'origin' => 'institucional', 'topics' => ['política']],
        // Internacional en español
        ['slug' => 'elpais-internacional', 'name' => 'El País · Internacional', 'type' => 'rss', 'url' => 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada', 'scope' => 'intl', 'origin' => 'medio', 'topics' => ['política']],
        ['slug' => 'bbcmundo', 'name' => 'BBC Mundo', 'type' => 'rss', 'url' => 'https://feeds.bbci.co.uk/mundo/rss.xml', 'scope' => 'intl', 'origin' => 'medio', 'topics' => ['política', 'sociedad']],
        ['slug' => 'dw-espanol', 'name' => 'DW Español', 'type' => 'rss', 'url' => 'https://rss.dw.com/rdf/rss-sp-all', 'scope' => 'intl', 'origin' => 'medio', 'topics' => ['política', 'sociedad']],
        ['slug' => 'france24-espanol', 'name' => 'France 24 Español', 'type' => 'rss', 'url' => 'https://www.france24.com/es/rss', 'scope' => 'intl', 'origin' => 'medio', 'topics' => ['política']],
    ];
}
