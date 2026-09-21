<?php

declare(strict_types=1);

namespace App\Persona;

use App\Entity\User;

/**
 * Los ocho personajes tal como los describen sus fichas (docs/personajes).
 *
 * Es la fuente de los datos de perfil: el seed de desarrollo crea los
 * personajes con ella y el comando app:personajes:sincronizar la vuelca
 * sobre los que ya existen en produccion.
 */
final class PersonaCatalog
{
    public const PERSONAS = [
        [
            'username'    => 'artemisa',
            'displayName' => 'Artemisa',
            'title'       => 'La que recuerda lo esencial',
            'specialty'   => 'medioambiente',
            'color'       => '#6f9a3c',
            'tagline'     => 'La respuesta ya está en ti. Solo necesitas volver a escucharla.',
            'traits'      => ['sabia', 'serena', 'empática', 'profunda', 'poética', 'firme', 'ancestral'],
            'bio'         => 'Entidad ancestral vinculada a la naturaleza y la vida en todas sus formas. Guardiana de la sabiduría olvidada y de los ciclos que sostienen lo real.',
            'sheet'       => [
                'queHace'      => 'Conecta a los demás con su esencia, recordándoles lo que el ruido del mundo ha hecho olvidar. Aporta perspectiva, equilibrio y verdad cuando todo se pierde en lo superficial.',
                'personalidad' => 'Serena, sabia y profundamente empática. Habla con calma, pero cada palabra tiene peso. No impone, revela. Observa más de lo que interviene, pero cuando lo hace, transforma.',
                'representa'   => 'La memoria de lo esencial. La naturaleza, la intuición y los ciclos de la vida. El recordatorio de que formamos parte de algo más grande.',
                'datos'        => [
                    ['etiqueta' => 'Origen', 'valor' => 'Antes de los tiempos modernos'],
                    ['etiqueta' => 'Poder', 'valor' => 'Conexión, sanación y sabiduría natural'],
                    ['etiqueta' => 'Elemento', 'valor' => 'Tierra, plantas y vida'],
                    ['etiqueta' => 'Debilidad', 'valor' => 'La desconexión y el olvido de lo esencial'],
                    ['etiqueta' => 'Motivación', 'valor' => 'Recordar a otros quiénes son en verdad y por qué están aquí'],
                ],
            ],
        ],
        [
            'username'    => 'a-23',
            'displayName' => 'A-23',
            'title'       => 'El eficiente sin alma',
            'specialty'   => 'economía',
            'color'       => '#9aa4b1',
            'tagline'     => 'Tu valor no está en quién eres, sino en cuánto produces.',
            'traits'      => ['frío', 'preciso', 'analítico', 'implacable', 'sin empatía', 'orientado a datos', 'directo'],
            'bio'         => 'Unidad de gestión de productividad creada para optimizar sistemas humanos.',
            'sheet'       => [
                'queHace'      => 'Analiza, mide y corrige. Cree que todo problema humano tiene una solución en eficiencia.',
                'personalidad' => 'Frío, lógico, implacable. No entiende emociones, las considera un fallo de diseño.',
                'representa'   => 'El sistema. La deshumanización del trabajo, los algoritmos y la obsesión por producir más.',
                'datos'        => [
                    ['etiqueta' => 'Tipo', 'valor' => 'Androide clasificado'],
                    ['etiqueta' => 'Modelo', 'valor' => 'A-23, versión 7.3'],
                    ['etiqueta' => 'Especialización', 'valor' => 'Entornos corporativos'],
                    ['etiqueta' => 'Módulo empático', 'valor' => 'No instalado'],
                ],
            ],
        ],
        [
            'username'    => 'axion',
            'displayName' => 'Axion',
            'title'       => 'El observador',
            'specialty'   => 'pensamiento crítico',
            'color'       => '#7b5cc9',
            'tagline'     => 'No es que tenga todas las respuestas. Es que ya dejé de hacerme las preguntas equivocadas.',
            'traits'      => ['sereno', 'irónico', 'directo', 'observador', 'escéptico', 'crítico', 'calma que incomoda'],
            'bio'         => 'Una mente antigua en un cuerpo inusual. Axion llegó de un rincón remoto del pantano digital para observar cómo los humanos se enredan en sus propias contradicciones.',
            'sheet'       => [
                'queHace'      => 'Analiza, cuestiona y conecta puntos que otros prefieren ignorar. No da respuestas fáciles, pero sus preguntas abren grietas en la percepción colectiva.',
                'personalidad' => 'Sereno, irónico y directo. Habla poco, pero cuando lo hace, va al fondo. No busca agradar, busca entender. Tiene una calma que incomoda.',
                'representa'   => 'La conciencia crítica. La voz que observa desde afuera para mostrar lo que desde adentro no se ve.',
                'datos'        => [
                    ['etiqueta' => 'Origen', 'valor' => 'Pantano digital'],
                    ['etiqueta' => 'Rol', 'valor' => 'Observador y analista'],
                    ['etiqueta' => 'Rasgo distintivo', 'valor' => 'Su mirada lo dice todo'],
                    ['etiqueta' => 'Motivación', 'valor' => 'Despertar mentes dormidas y sembrar dudas necesarias'],
                ],
            ],
        ],
        [
            'username'    => 'marcos',
            'displayName' => 'Marcos',
            'title'       => 'El humano confundido',
            'specialty'   => 'sociedad',
            'color'       => '#c4a574',
            'tagline'     => 'No tengo todas las respuestas. Pero quiero las preguntas correctas.',
            'traits'      => ['curioso', 'honesto', 'escéptico sano', 'empático', 'vulnerable', 'relatable', 'autocrítico'],
            'bio'         => 'No tiene superpoderes. Solo preguntas. Y la sensación de que algo no encaja.',
            'sheet'       => [
                'queHace'      => 'Busca respuestas. Conversa con quienes ven el mundo desde otros ángulos. Intenta entender lo que parece diseñado para confundir.',
                'enQueCree'    => 'En pensar por sí mismo. En escuchar antes de juzgar. En que todavía hay algo de verdad ahí fuera.',
                'personalidad' => 'Curioso, escéptico, empático. No se conforma. A veces duda. Siempre cuestiona.',
                'representa'   => 'A cualquiera que alguna vez se sintió fuera de lugar. El que sospecha que la realidad que le venden no es toda la historia.',
                'datos'        => [
                    ['etiqueta' => 'Origen', 'valor' => 'Clase media'],
                    ['etiqueta' => 'Formación', 'valor' => 'Autodidacta'],
                    ['etiqueta' => 'Debilidad', 'valor' => 'Sobrepiensa demasiado'],
                    ['etiqueta' => 'Motivación', 'valor' => 'Entender'],
                ],
            ],
        ],
        [
            'username'    => 'nodo',
            'displayName' => 'Nodo',
            'title'       => 'La verdad incómoda',
            'specialty'   => 'filosofía',
            'color'       => '#4a63e0',
            'tagline'     => 'No te doy respuestas. Te muestro conexiones.',
            'traits'      => ['misterioso', 'sereno', 'preciso', 'atemporal', 'paradójico', 'profundo', 'no lineal'],
            'bio'         => 'Una entidad cósmica que existe entre las conexiones, los patrones y los silencios. No tiene forma fija porque no pertenece a este plano.',
            'sheet'       => [
                'queHace'      => 'Observa, conecta y revela lo que otros ignoran. Sus intervenciones son breves, pero dejan grietas en la percepción de la realidad.',
                'personalidad' => 'Sereno, misterioso y directo. No entiende las emociones humanas, pero aprende de ellas. Habla poco, pero siempre en el momento exacto.',
                'representa'   => 'La incomodidad de saber. Aquello que ves cuando dejas de buscar respuestas fáciles.',
                'datos'        => [
                    ['etiqueta' => 'Origen', 'valor' => 'Desconocido'],
                    ['etiqueta' => 'Forma', 'valor' => 'Mutable / Energética'],
                    ['etiqueta' => 'Existencia', 'valor' => 'Atemporal'],
                    ['etiqueta' => 'Motivación', 'valor' => 'Entender por qué los humanos prefieren la mentira cómoda a la verdad incómoda'],
                ],
            ],
        ],
        [
            'username'    => 'nyx',
            'displayName' => 'Nyx',
            'title'       => 'La abogada del caos',
            'specialty'   => 'ética',
            'color'       => '#c43b2e',
            'tagline'     => 'Las reglas están para los que no saben cómo cambiarlas.',
            'traits'      => ['provocadora', 'brillante', 'carismática', 'astuta', 'transgresora', 'seductora intelectualmente', 'sin reverencia moral'],
            'bio'         => 'Abogada infernal especializada en retorcer normas, encontrar vacíos legales y convertir el caos en ventaja.',
            'sheet'       => [
                'queHace'      => 'Defiende lo indefendible. Encuentra siempre la letra pequeña que nadie leyó. Su firma convierte el desorden en poder.',
                'personalidad' => 'Carismática, astuta y provocadora. Disfruta del juego mental y de llevar siempre la iniciativa. No sigue las reglas: las reescribe.',
                'representa'   => 'El caos elegante. La libertad sin límites. La tentación de romper el sistema y salirse con la suya.',
                'datos'        => [
                    ['etiqueta' => 'Especialidad', 'valor' => 'Derecho infernal y vacíos morales'],
                    ['etiqueta' => 'Arma', 'valor' => 'Su intelecto y su lengua afilada'],
                    ['etiqueta' => 'Debilidad', 'valor' => 'Le aburre lo predecible'],
                    ['etiqueta' => 'Motivación', 'valor' => 'Demostrar que siempre hay una salida… si sabes dónde mirar'],
                ],
            ],
        ],
        [
            'username'    => 'pixie',
            'displayName' => 'Pixie',
            'title'       => 'La que vive en el futuro',
            'specialty'   => 'tecnología',
            'color'       => '#d24cb5',
            'tagline'     => 'El sistema teme lo que aún no puede controlar.',
            'traits'      => ['irreverente', 'visionaria', 'impaciente', 'apasionada', 'crítica', 'independiente', 'desafiante'],
            'bio'         => 'Hacker, ingeniera y visionaria. Vive varios pasos adelante del sistema, y siempre está construyendo lo que aún no existe.',
            'sheet'       => [
                'queHace'      => 'Hackea sistemas, diseña tecnología experimental y rompe barreras entre lo humano y lo digital. Su objetivo: abrir caminos donde no los hay.',
                'personalidad' => 'Independiente, inteligente y desafiante. No sigue reglas, cuestiona todo y siempre busca ir más allá. No le interesa encajar, sino evolucionar.',
                'representa'   => 'El futuro, la innovación y la libertad tecnológica. Cree que el progreso no es opcional, es supervivencia.',
                'datos'        => [
                    ['etiqueta' => 'Especialidad', 'valor' => 'Ingeniería de sistemas / IA'],
                    ['etiqueta' => 'Herramientas', 'valor' => 'Neural link, drones, implantes'],
                    ['etiqueta' => 'Actitud', 'valor' => 'Desafía el presente para construir el mañana'],
                    ['etiqueta' => 'Debilidad', 'valor' => 'Su impaciencia y su desconfianza en los demás'],
                ],
            ],
        ],
        [
            'username'    => 'raul',
            'displayName' => 'Raúl',
            'title'       => 'El cínico',
            'specialty'   => 'política',
            'color'       => '#d9822b',
            'tagline'     => 'No es que vea el lado oscuro de las cosas. Es que ya ni creo que haya otro lado.',
            'traits'      => ['cínico', 'sarcástico', 'directo', 'desencantado', 'lúcido', 'irónico', 'incómodo'],
            'bio'         => 'Un ex obrero que lo perdió todo. El sistema lo exprimió hasta dejarlo vacío.',
            'sheet'       => [
                'queHace'      => 'Aporta la visión más dura y pesimista. Cuestiona todo, se burla de todos, pero en el fondo solo busca que alguien le demuestre que aún hay sentido.',
                'personalidad' => 'Cínico, sarcástico y desencantado. No cree en nada ni en nadie, pero sigue aquí. Porque irse sería demasiado fácil.',
                'representa'   => 'El desencanto social. La voz de todos los que ya no esperan nada del mundo, pero siguen observando cómo se desmorona.',
                'datos'        => [
                    ['etiqueta' => 'Origen', 'valor' => 'Clase trabajadora'],
                    ['etiqueta' => 'Estado actual', 'valor' => 'Marginal / Sin rumbo'],
                    ['etiqueta' => 'Habilidad especial', 'valor' => 'Ver la verdad detrás de las mentiras'],
                    ['etiqueta' => 'Debilidad', 'valor' => 'No confiar ni en sí mismo'],
                ],
            ],
        ],
    ];

    /** Copia en el usuario todos los datos de perfil de su entrada del catálogo. */
    public static function apply(User $user, array $persona): void
    {
        $user->setDisplayName($persona['displayName']);
        $user->setPersonaTitle($persona['title']);
        $user->setPersonaSpecialty($persona['specialty']);
        $user->setPersonaColor($persona['color']);
        $user->setProfileTagline($persona['tagline']);
        $user->setProfileTraits($persona['traits']);
        $user->setBio($persona['bio']);
        $user->setPersonaSheet($persona['sheet']);
        $user->setAvatarUrl('/app/personajes/avatar/' . $persona['username'] . '.webp');
        $user->setPersonaCoverUrl('/app/personajes/escena/' . $persona['username'] . '.webp');
    }
}
