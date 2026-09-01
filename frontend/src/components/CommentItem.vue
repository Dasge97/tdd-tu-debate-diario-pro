<script setup>
import { computed, ref } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { formatRelative } from "@/utils/format";
import { participationService } from "@/services";
import { useUiStore } from "@/stores/ui";
import { useSesion } from "@/composables/useSesion";
import { errorMessage } from "@/api/client";

const props = defineProps({
  comment: { type: Object, required: true },
  depth: { type: Number, default: 0 }
});

const emit = defineEmits(["reply"]);

const ui = useUiStore();
const { exigeSesion } = useSesion();

/**
 * El voto propio no viaja en la respuesta de la API, asi que se recuerda en el
 * navegador para que el boton siga marcado al volver al debate.
 */
const VOTES_KEY = "tdd.commentVotes";

const readVotes = () => {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) || "{}");
  } catch (_) {
    return {};
  }
};

const myVote = ref(readVotes()[props.comment.id] ?? 0);
const score = ref(Number(props.comment.score || 0));
const sending = ref(false);

const author = computed(() => props.comment.user || {});
const replies = computed(() => props.comment.replies || []);

const vote = async (value) => {
  if (!exigeSesion("votar comentarios")) return;
  if (sending.value) return;

  const next = myVote.value === value ? 0 : value;
  const previous = myVote.value;

  sending.value = true;
  try {
    await participationService.voteComment(props.comment.id, next);
    score.value += next - previous;
    myVote.value = next;

    const votes = readVotes();
    if (next === 0) {
      delete votes[props.comment.id];
    } else {
      votes[props.comment.id] = next;
    }
    localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido registrar tu voto."));
  } finally {
    sending.value = false;
  }
};

const report = async () => {
  if (!exigeSesion("reportar")) return;

  try {
    await participationService.reportComment(props.comment.id, "Reportado desde la web");
    ui.success("Comentario reportado. Gracias.");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar el reporte."));
  }
};
</script>

<template>
  <div class="comment">
    <UserAvatar :user="author" size="sm" />

    <div class="comment-body">
      <div class="comment-head">
        <RouterLink
          class="comment-author"
          :to="
            author.isAiPersona
              ? { name: 'persona', params: { username: author.username } }
              : { name: 'user', params: { username: author.username } }
          "
        >
          {{ author.username }}
        </RouterLink>
        <span v-if="author.isAiPersona" class="ia-chip">IA</span>
        <span class="comment-time">{{ formatRelative(comment.createdAt) }}</span>
      </div>

      <p class="comment-text">{{ comment.content }}</p>

      <div class="comment-actions">
        <button
          type="button"
          class="comment-vote"
          :class="{ 'is-up': myVote === 1 }"
          aria-label="Votar a favor"
          @click="vote(1)"
        >
          <span class="material-symbols-rounded" style="font-size: 19px">thumb_up</span>
        </button>

        <span class="comment-score">{{ score }}</span>

        <button
          type="button"
          class="comment-vote"
          :class="{ 'is-down': myVote === -1 }"
          aria-label="Votar en contra"
          @click="vote(-1)"
        >
          <span class="material-symbols-rounded" style="font-size: 19px">thumb_down</span>
        </button>

        <button
          v-if="depth === 0"
          type="button"
          class="comment-vote"
          @click="emit('reply', comment)"
        >
          Responder
        </button>

        <button type="button" class="comment-vote" aria-label="Reportar" @click="report">
          <span class="material-symbols-rounded" style="font-size: 18px">flag</span>
        </button>
      </div>

      <div v-if="replies.length" class="comment-replies">
        <CommentItem
          v-for="reply in replies"
          :key="reply.id"
          :comment="reply"
          :depth="depth + 1"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default { name: "CommentItem" };
</script>
