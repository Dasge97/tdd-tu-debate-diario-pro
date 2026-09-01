<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import PositionBar from "@/components/PositionBar.vue";
import CommentItem from "@/components/CommentItem.vue";
import UserAvatar from "@/components/UserAvatar.vue";
import EmptyState from "@/components/EmptyState.vue";
import Lateral from "@/components/Lateral.vue";
import { useDebatesStore } from "@/stores/debates";
import { useFavoritesStore } from "@/stores/favorites";
import { useUiStore } from "@/stores/ui";
import { useSesion } from "@/composables/useSesion";
import { debatesService, participationService } from "@/services";
import { errorMessage } from "@/api/client";
import { formatDateTime, plural, toParagraphs } from "@/utils/format";

const props = defineProps({
  id: { type: [String, Number], required: true }
});

const debates = useDebatesStore();
const favorites = useFavoritesStore();
const ui = useUiStore();
const { auth, exigeSesion } = useSesion();

const debateId = Number(props.id);

const debate = ref(debates.byId[debateId] || null);
const comments = ref([]);
const loading = ref(true);
const loadingComments = ref(true);
const loadError = ref(null);

const draft = ref("");
const replyTo = ref(null);
const sending = ref(false);
const composer = ref(null);

/**
 * La API no devuelve que posicion eligio el usuario, solo los recuentos.
 * Se guarda en el navegador para que el boton siga marcado al volver.
 */
const POSITIONS_KEY = "tdd.myPositions";

const readPositions = () => {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || "{}");
  } catch (_) {
    return {};
  }
};

const myPosition = ref(readPositions()[debateId] || null);

const percentages = computed(() => debates.percentagesFor(debateId));
const isFavorite = computed(() => favorites.isFavorite(debateId));
const author = computed(() => debate.value?.createdBy || null);
const contextParagraphs = computed(() => toParagraphs(debate.value?.context));
const commentCount = computed(() =>
  comments.value.reduce((total, comment) => total + 1 + (comment.replies?.length || 0), 0)
);

const load = async () => {
  loading.value = true;
  loadError.value = null;
  try {
    const [detail] = await Promise.all([
      debatesService.byId(debateId),
      debates.fetchPositions(debateId).catch(() => {})
    ]);
    debate.value = detail;
  } catch (error) {
    loadError.value = errorMessage(error, "No hemos podido cargar este debate.");
  } finally {
    loading.value = false;
  }
};

const loadComments = async () => {
  loadingComments.value = true;
  try {
    comments.value = await participationService.getComments(debateId);
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido cargar los comentarios."));
  } finally {
    loadingComments.value = false;
  }
};

onMounted(() => {
  load();
  loadComments();
});

const setPosition = async (position) => {
  if (!exigeSesion("fijar tu posición")) return;

  const previous = myPosition.value;
  myPosition.value = position;

  try {
    await debates.setPosition(debateId, position);

    const stored = readPositions();
    stored[debateId] = position;
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(stored));
  } catch (error) {
    myPosition.value = previous;
    ui.error(errorMessage(error, "No hemos podido registrar tu posición."));
  }
};

const toggleFavorite = async () => {
  if (!exigeSesion("guardar debates")) return;

  try {
    const favorited = await favorites.toggle(debateId);
    ui.success(favorited ? "Guardado en favoritos" : "Quitado de favoritos");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
};

const startReply = async (comment) => {
  if (!exigeSesion("responder")) return;

  replyTo.value = comment;
  await nextTick();
  composer.value?.focus();
};

const send = async () => {
  if (!exigeSesion("comentar")) return;

  const content = draft.value.trim();
  if (!content || sending.value) return;

  sending.value = true;
  try {
    await participationService.addComment(debateId, content, replyTo.value?.id ?? null);
    draft.value = "";
    replyTo.value = null;
    await loadComments();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido publicar tu comentario."));
  } finally {
    sending.value = false;
  }
};

const report = async () => {
  if (!exigeSesion("reportar")) return;

  try {
    await debatesService.report(debateId, "Reportado desde la web");
    ui.success("Debate reportado. Gracias.");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar el reporte."));
  }
};

/* El textarea crece con el texto hasta el maximo que fija el CSS. */
const autoGrow = (event) => {
  const element = event.target;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
};
</script>

<template>
  <section class="con-lateral has-composer">
    <div>
    <div v-if="loading && !debate" class="skeleton" style="height: 320px" />

    <p v-else-if="loadError" class="form-error">{{ loadError }}</p>

    <template v-else-if="debate">
      <article class="debate-surface debate-detail">
        <div class="debate-card-topbar">
          <RouterLink
            v-if="author"
            class="debate-author"
            :to="
              author.isAiPersona
                ? { name: 'persona', params: { username: author.username } }
                : { name: 'user', params: { username: author.username } }
            "
          >
            <UserAvatar :user="author" size="sm" />
            <span style="min-width: 0">
              <span class="debate-author-name">{{ author.username }}</span>
              <span v-if="author.personaSpecialty" class="debate-author-tag">
                · {{ author.personaSpecialty }}
              </span>
            </span>
          </RouterLink>

          <span style="display: flex">
            <button
              type="button"
              class="icon-btn"
              :aria-label="isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'"
              @click="toggleFavorite"
            >
              <span
                class="material-symbols-rounded"
                :style="isFavorite ? 'color:#e74c3c;font-variation-settings:\'FILL\' 1' : ''"
              >
                favorite
              </span>
            </button>
            <button type="button" class="icon-btn" aria-label="Reportar debate" @click="report">
              <span class="material-symbols-rounded">flag</span>
            </button>
          </span>
        </div>

        <div class="debate-kicker-row">
          <span v-if="author?.isAiPersona" class="debate-kicker-chip">Generado por IA</span>
          <span v-if="debate.publishedAt" class="debate-kicker-text">
            {{ formatDateTime(debate.publishedAt) }}
          </span>
        </div>

        <h1 class="debate-title">{{ debate.title }}</h1>

        <div class="debate-section-label">De qué va este debate</div>

        <p v-if="debate.question" class="debate-story-paragraph debate-story-question">
          <span class="debate-story-lead">La pregunta:</span>
          {{ debate.question }}
        </p>

        <p v-if="debate.cardSummary" class="debate-story-paragraph">
          <span class="debate-story-lead">La idea central:</span>
          {{ debate.cardSummary }}
        </p>

        <p v-for="(paragraph, index) in contextParagraphs" :key="index" class="debate-story-paragraph">
          {{ paragraph }}
        </p>

        <p v-if="debate.sourceUrl" style="margin-top: 16px">
          <a :href="debate.sourceUrl" target="_blank" rel="noopener noreferrer">
            Fuente: {{ debate.sourceName || debate.sourceUrl }}
          </a>
        </p>

        <div style="margin-top: 20px">
          <PositionBar :percentages="percentages" />

          <div class="position-picker">
            <button
              type="button"
              class="position-btn"
              :class="{ 'is-active-support': myPosition === 'support' }"
              @click="setPosition('support')"
            >
              <span class="material-symbols-rounded">thumb_up</span>
              A favor
            </button>
            <button
              type="button"
              class="position-btn"
              :class="{ 'is-active-neutral': myPosition === 'neutral' }"
              @click="setPosition('neutral')"
            >
              <span class="material-symbols-rounded">drag_handle</span>
              Neutral
            </button>
            <button
              type="button"
              class="position-btn"
              :class="{ 'is-active-oppose': myPosition === 'oppose' }"
              @click="setPosition('oppose')"
            >
              <span class="material-symbols-rounded">thumb_down</span>
              En contra
            </button>
          </div>

          <p class="text-muted" style="margin: 10px 0 0; font-size: 0.84rem">
            {{ plural(percentages?.total ?? 0, "persona ya ha", "personas ya han") }}
            fijado su posición.
          </p>
        </div>
      </article>

      <div class="section-head" style="margin-top: 22px">
        <h2 class="section-title">Comentarios</h2>
        <span class="text-muted" style="font-size: 0.85rem">{{ commentCount }}</span>
      </div>

      <div v-if="loadingComments" class="spinner" />

      <div v-else-if="comments.length" class="surface surface-pad comentarios-caja">
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          @reply="startReply"
        />
      </div>

      <EmptyState
        v-else
        icon="chat"
        title="Nadie ha comentado todavía"
        text="Sé la primera persona en argumentar tu posición."
      />

      <div v-if="replyTo" class="composer-reply-hint">
        <span>Respondiendo a {{ replyTo.user?.username }}</span>
        <button type="button" class="btn btn-ghost btn-sm" @click="replyTo = null">Cancelar</button>
      </div>

      <div class="composer">
        <textarea
          ref="composer"
          v-model="draft"
          rows="1"
          :placeholder="auth.isAuthenticated ? 'Escribe tu argumento…' : 'Entra para comentar'"
          aria-label="Escribe tu comentario"
          @input="autoGrow"
        />
        <button
          type="button"
          class="composer-send"
          aria-label="Publicar comentario"
          :disabled="auth.isAuthenticated && (!draft.trim() || sending)"
          @click="send"
        >
          <span class="material-symbols-rounded">send</span>
        </button>
      </div>
    </template>
    </div>

    <Lateral :excluir-id="debateId" />
  </section>
</template>
