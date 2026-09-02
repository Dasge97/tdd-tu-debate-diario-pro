<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\User;
use App\Repository\CommentRepository;
use App\Repository\UserRepository;
use App\Repository\VoteRepository;

/**
 * Oculta los comentarios de quien aporta mal.
 *
 * Solo mira los comentarios de la persona y los votos que esos comentarios han
 * recibido. Lo que la persona vote en los debates no cuenta para nada.
 *
 * Cuando una cuenta esta oculta, sus comentarios dejan de verse en los hilos,
 * pero ella los sigue viendo y puede seguir leyendo, votando y proponiendo.
 */
class ShadowBanService
{
    /** Ventana que se mira para juzgar como se esta portando alguien ahora. */
    private const DIAS_VENTANA = 30;

    /** Puntos negativos en la ventana a partir de los cuales se oculta. */
    private const LIMITE_PUNTOS = -10;

    /** Comentarios minimos en la ventana para poder juzgar la proporcion. */
    private const MINIMO_COMENTARIOS = 5;

    /** Proporcion de comentarios negativos a partir de la cual se oculta. */
    private const PROPORCION_NEGATIVOS = 0.40;

    /** Dias que se revisan para decidir si se levanta la ocultacion. */
    private const DIAS_REVISION = 7;

    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly CommentRepository $commentRepository,
        private readonly VoteRepository $voteRepository
    ) {
    }

    public function evaluate(User $author): void
    {
        if ($author->isAiPersona()) {
            return;
        }

        if ($this->mereceOcultarse($author) && !$author->isShadowBanned()) {
            $author->setIsShadowBanned(true);
            $this->userRepository->save($author);
        }
    }

    private function mereceOcultarse(User $autor): bool
    {
        // Primera via: muchos votos negativos recientes. Se mira solo la
        // ventana de 30 dias, no el historial entero, para que quien cambia de
        // actitud pueda salir por si mismo.
        $sumaReciente = $this->voteRepository->sumaRecibidaPor($autor->getId(), self::DIAS_VENTANA);
        $puntosRecientes = intdiv($sumaReciente, CommentService::VOTOS_POR_PUNTO);

        if ($puntosRecientes <= self::LIMITE_PUNTOS) {
            return true;
        }

        // Segunda via: la mayor parte de lo que escribe cae mal. Cuenta la
        // proporcion, para no castigar a quien tiene mucho escrito y algun
        // comentario malo suelto.
        $total = $this->commentRepository->countByUserInLast30Days($autor->getId());

        if ($total < self::MINIMO_COMENTARIOS) {
            return false;
        }

        $negativos = $this->commentRepository->countNegativeByUserInLast30Days($autor->getId());

        return $negativos / $total >= self::PROPORCION_NEGATIVOS;
    }

    /**
     * Levanta la ocultacion de quien ha vuelto a aportar bien.
     *
     * Lo lanza el comando app:review-shadow-bans, que el contenedor scheduler
     * ejecuta cada pocas horas.
     */
    public function reviewBanned(): int
    {
        $ocultos = $this->userRepository->findShadowBannedForReview();
        $levantados = 0;

        foreach ($ocultos as $usuario) {
            $recientes = $this->commentRepository->findRecentByUser(
                $usuario->getId(),
                self::DIAS_REVISION
            );

            // Sin comentarios nuevos no hay nada que juzgar todavia.
            if (empty($recientes)) {
                continue;
            }

            $suma = 0;
            foreach ($recientes as $comentario) {
                $suma += $comentario->getScore();
            }

            $media = $suma / count($recientes);

            // Si lo ultimo que ha escrito no cae mal, y ya no cumple ninguna de
            // las condiciones para estar oculto, vuelve a verse.
            if ($media >= 0 && !$this->mereceOcultarse($usuario)) {
                $usuario->setIsShadowBanned(false);
                $this->userRepository->save($usuario);
                $levantados++;
            }
        }

        return $levantados;
    }
}
