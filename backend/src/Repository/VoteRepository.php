<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Vote;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class VoteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Vote::class);
    }

    public function findByUserAndComment(int $userId, int $commentId): ?Vote
    {
        return $this->findOneBy(['user' => $userId, 'comment' => $commentId]);
    }

    /**
     * Positivos y negativos de cada comentario de un debate, y el voto de quien
     * mira, si ha votado.
     *
     * Se hace en una sola consulta para no pedir los votos comentario a
     * comentario, que con un hilo largo serian decenas de consultas.
     *
     * @return array<int, array{positivos: int, negativos: int, miVoto: int}>
     */
    public function resumenPorDebate(int $debateId, ?int $userId): array
    {
        $filas = $this->getEntityManager()->getConnection()->fetchAllAssociative(
            'SELECT v.comment_id,
                    SUM(CASE WHEN v.value > 0 THEN 1 ELSE 0 END) AS positivos,
                    SUM(CASE WHEN v.value < 0 THEN 1 ELSE 0 END) AS negativos,
                    COALESCE(SUM(CASE WHEN v.user_id = :userId THEN v.value ELSE 0 END), 0) AS mi_voto
               FROM votes v
               JOIN comments c ON c.id = v.comment_id
              WHERE c.debate_id = :debateId
              GROUP BY v.comment_id',
            ['debateId' => $debateId, 'userId' => $userId ?? 0]
        );

        $resumen = [];
        foreach ($filas as $fila) {
            $resumen[(int) $fila['comment_id']] = [
                'positivos' => (int) $fila['positivos'],
                'negativos' => (int) $fila['negativos'],
                'miVoto'    => (int) $fila['mi_voto'],
            ];
        }

        return $resumen;
    }

    /**
     * Suma de los votos que han recibido los comentarios de un usuario.
     *
     * Con $dias se cuentan solo los votos de ese periodo, que es lo que hace
     * falta para juzgar como se esta portando alguien ahora y no hace un ano.
     */
    public function sumaRecibidaPor(int $userId, ?int $dias = null): int
    {
        $sql = 'SELECT COALESCE(SUM(v.value), 0)
                  FROM votes v
                  JOIN comments c ON c.id = v.comment_id
                 WHERE c.user_id = :userId';

        $parametros = ['userId' => $userId];

        if ($dias !== null) {
            $sql .= ' AND v.created_at >= :desde';
            $parametros['desde'] = (new \DateTime("-{$dias} days"))->format('Y-m-d H:i:s');
        }

        return (int) $this->getEntityManager()->getConnection()->fetchOne($sql, $parametros);
    }

    public function delete(int $userId, int $commentId): void
    {
        $this->getEntityManager()->getConnection()->executeStatement(
            'DELETE FROM votes WHERE user_id = :userId AND comment_id = :commentId',
            ['userId' => $userId, 'commentId' => $commentId]
        );
    }

    public function upsert(int $userId, int $commentId, int $value): void
    {
        $em = $this->getEntityManager();
        $existing = $this->findByUserAndComment($userId, $commentId);

        if ($existing) {
            $existing->setValue($value);
            $em->flush();
        } else {
            $em->getConnection()->executeStatement(
                'INSERT INTO votes (user_id, comment_id, value, created_at) VALUES (?, ?, ?, NOW())',
                [$userId, $commentId, $value]
            );
        }
    }
}
