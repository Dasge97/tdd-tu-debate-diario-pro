<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Comment;
use App\Entity\User;
use App\Repository\CommentRepository;
use App\Repository\DebateRepository;
use App\Repository\UserRepository;
use App\Repository\VoteRepository;

class CommentService
{
    /** Votos del mismo signo que hacen falta para mover un punto de fiabilidad. */
    public const VOTOS_POR_PUNTO = 3;

    public function __construct(
        private readonly CommentRepository $commentRepository,
        private readonly DebateRepository $debateRepository,
        private readonly UserRepository $userRepository,
        private readonly VoteRepository $voteRepository,
        private readonly ShadowBanService $shadowBanService
    ) {
    }

    public function getComments(int $debateId, ?int $parentId, ?User $currentUser): array
    {
        $excludeShadowBanned = $currentUser === null || !$currentUser->isShadowBanned();
        return $this->commentRepository->findByDebate($debateId, $parentId, $excludeShadowBanned);
    }

    /**
     * Returns all comments for a debate (including replies), allowing the caller
     * to group them into a parent → children structure efficiently.
     */
    public function getAllComments(int $debateId, ?User $currentUser): array
    {
        $excludeShadowBanned = $currentUser === null || !$currentUser->isShadowBanned();
        return $this->commentRepository->findAllByDebate($debateId, $excludeShadowBanned);
    }

    public function addComment(User $user, int $debateId, ?int $parentId, string $content): Comment
    {
        if (empty(trim($content))) {
            throw new \InvalidArgumentException('content cannot be empty');
        }

        $debate = $this->debateRepository->find($debateId);
        if ($debate === null) {
            throw new \RuntimeException('NOT_FOUND: debate not found');
        }

        $parent = null;
        if ($parentId !== null) {
            $parent = $this->commentRepository->find($parentId);
            if ($parent === null) {
                throw new \RuntimeException('NOT_FOUND: parent comment not found');
            }
        }

        $comment = new Comment();
        $comment->setDebate($debate);
        $comment->setUser($user);
        $comment->setParent($parent);
        $comment->setContent(trim($content));

        $this->commentRepository->save($comment);

        return $comment;
    }

    /**
     * Vota un comentario. El valor 0 retira el voto que hubiera.
     */
    public function voteComment(User $voter, int $commentId, int $value): void
    {
        if (!in_array($value, [1, 0, -1], true)) {
            throw new \InvalidArgumentException('value must be 1, 0 or -1');
        }

        $comment = $this->commentRepository->find($commentId);
        if ($comment === null) {
            throw new \RuntimeException('NOT_FOUND: comment not found');
        }

        if ($comment->getUser()->getId() === $voter->getId()) {
            throw new \RuntimeException('FORBIDDEN: cannot vote on own comment');
        }

        if ($value === 0) {
            $this->voteRepository->delete($voter->getId(), $commentId);
        } else {
            $this->voteRepository->upsert($voter->getId(), $commentId, $value);
        }

        $this->recalculateScore($comment);

        $author = $comment->getUser();
        $this->recalcularFiabilidad($author);

        $this->shadowBanService->evaluate($author);
    }

    /**
     * Recalcula la fiabilidad del autor a partir de todos los votos que han
     * recibido sus comentarios.
     *
     * Hacen falta VOTOS_POR_PUNTO votos del mismo signo para mover un punto, de
     * modo que la fiabilidad refleje un comportamiento sostenido y no una mala
     * tarde. Se recalcula entero en lugar de ir sumando: asi, retirar o cambiar
     * un voto corrige la cuenta, y no quedan restos de votos ya deshechos.
     */
    public function recalcularFiabilidad(User $autor): void
    {
        $suma = $this->voteRepository->sumaRecibidaPor($autor->getId());

        $autor->setReliabilityScore(intdiv($suma, self::VOTOS_POR_PUNTO));
        $this->userRepository->save($autor);
    }

    private function recalculateScore(Comment $comment): void
    {
        $conn = $this->commentRepository->getEntityManager()->getConnection();
        $score = (int) $conn->fetchOne(
            'SELECT COALESCE(SUM(value), 0) FROM votes WHERE comment_id = :id',
            ['id' => $comment->getId()]
        );
        $comment->setScore($score);
        $this->commentRepository->save($comment);
    }

    private function userRepository(): UserRepository
    {
        return $this->userRepository;
    }
}
