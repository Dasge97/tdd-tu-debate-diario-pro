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

/* Positivos y negativos van por separado, y el voto propio lo dice la API. */
const positivos = ref(Number(props.comment.upvotes || 0));
const negativos = ref(Number(props.comment.downvotes || 0));
const miVoto = ref(Number(props.comment.myVote || 0));
const enviando = ref(false);

const autor = computed(() => props.comment.user || {});
const respuestas = computed(() => props.comment.replies || []);

const votar = async (valor) => {
  if (!exigeSesion("votar comentarios")) return;
  if (enviando.value) return;

  const anterior = miVoto.value;
  // Volver a pulsar la misma flecha retira el voto.
  const nuevo = anterior === valor ? 0 : valor;

  enviando.value = true;
  try {
    await participationService.voteComment(props.comment.id, nuevo);

    // Se quita el voto anterior y se suma el nuevo, sin recargar la lista.
    if (anterior === 1) positivos.value -= 1;
    if (anterior === -1) negativos.value -= 1;
    if (nuevo === 1) positivos.value += 1;
    if (nuevo === -1) negativos.value += 1;

    miVoto.value = nuevo;
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido registrar tu voto."));
  } finally {
    enviando.value = false;
  }
};

const reportar = async () => {
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
    <UserAvatar :user="autor" size="sm" />

    <div class="comment-body">
      <div class="comment-head">
        <RouterLink
          class="comment-author"
          :to="
            autor.isAiPersona
              ? { name: 'persona', params: { username: autor.username } }
              : { name: 'user', params: { username: autor.username } }
          "
        >
          {{ autor.username }}
        </RouterLink>
        <span v-if="autor.isAiPersona" class="ia-chip">IA</span>
        <span class="comment-time">{{ formatRelative(comment.createdAt) }}</span>
      </div>

      <p class="comment-text">{{ comment.content }}</p>

      <div class="comment-actions">
        <button
          type="button"
          class="voto voto-arriba"
          :class="{ 'is-activo': miVoto === 1 }"
          aria-label="Votar a favor"
          @click="votar(1)"
        >
          <span class="material-symbols-rounded">arrow_upward</span>
          {{ positivos }}
        </button>

        <button
          type="button"
          class="voto voto-abajo"
          :class="{ 'is-activo': miVoto === -1 }"
          aria-label="Votar en contra"
          @click="votar(-1)"
        >
          <span class="material-symbols-rounded">arrow_downward</span>
          {{ negativos }}
        </button>

        <button
          v-if="depth === 0"
          type="button"
          class="comment-vote"
          @click="emit('reply', comment)"
        >
          Responder
        </button>

        <button type="button" class="comment-vote" aria-label="Reportar" @click="reportar">
          <span class="material-symbols-rounded" style="font-size: 18px">flag</span>
        </button>
      </div>

      <div v-if="respuestas.length" class="comment-replies">
        <CommentItem
          v-for="respuesta in respuestas"
          :key="respuesta.id"
          :comment="respuesta"
          :depth="depth + 1"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default { name: "CommentItem" };
</script>
