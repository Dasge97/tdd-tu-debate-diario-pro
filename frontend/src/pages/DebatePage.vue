<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DebateCard from "@/components/DebateCard.vue";
import DebateCommentItem from "@/components/DebateCommentItem.vue";
import { useDebatesStore } from "@/stores/debates";
import { useUsersStore } from "@/stores/users";
import { useToastStore } from "@/stores/toast";

const route = useRoute();
const router = useRouter();
const debatesStore = useDebatesStore();
const usersStore = useUsersStore();
const toastStore = useToastStore();

const debateId = computed(() => Number(route.params.id));
const newComment = ref("");
const position = ref("");
const commentError = ref("");
const activeReplyId = ref(null);
const replyError = ref("");

const debate = computed(() => debatesStore.byId[debateId.value]);
const isEditorialDebate = computed(() => debate.value?.author?.type !== "user");
const authorPanelTitle = computed(() =>
  isEditorialDebate.value ? "Sobre esta publicación" : "Sobre el autor"
);
const comments = computed(() => debatesStore.commentsByDebate[debateId.value] || []);
const commentsByParent = computed(() => {
  const map = {};
  comments.value.forEach((comment) => {
    const key = comment.parentId ?? "root";
    if (!map[key]) map[key] = [];
    map[key].push(comment);
  });
  return map;
});
const rootComments = computed(() => commentsByParent.value.root || []);
const editorialPublishedAtLabel = computed(() => {
  if (!debate.value?.publishedAt) return "";

  const date = new Date(debate.value.publishedAt);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
});

const editorialMetaItems = computed(() => {
  if (!debate.value) return [];

  return [
    debate.value.category ? `Tema: ${debate.value.category}` : "",
    editorialPublishedAtLabel.value ? `Publicado el ${editorialPublishedAtLabel.value}` : ""
  ].filter(Boolean);
});

const load = async () => {
  if (!Number.isInteger(debateId.value) || debateId.value <= 0) {
    router.push({ name: "home" });
    return;
  }
  await Promise.all([
    debatesStore.fetchToday(),
    debatesStore.fetchDebate(debateId.value),
    debatesStore.fetchComments(debateId.value)
  ]);
};

const submitComment = async () => {
  commentError.value = "";
  if (!usersStore.isAuthenticated) {
    commentError.value = "Debes iniciar sesión para comentar.";
    toastStore.info(commentError.value);
    return;
  }
  if (!newComment.value.trim()) {
    commentError.value = "Escribe un comentario antes de enviar.";
    return;
  }
  try {
    await debatesStore.createComment({
      debateId: debateId.value,
      content: newComment.value.trim()
    });
    newComment.value = "";
    commentError.value = "";
  } catch (error) {
    commentError.value = error?.response?.data?.error || "No se pudo publicar el comentario.";
    toastStore.error(commentError.value);
    commentError.value = "";
  }
};

const openReply = (commentId) => {
  if (!usersStore.isAuthenticated) {
    toastStore.info("Debes iniciar sesión para responder comentarios.");
    return;
  }
  replyError.value = "";
  activeReplyId.value = Number(commentId);
};

const cancelReply = () => {
  activeReplyId.value = null;
  replyError.value = "";
};

const submitReply = async ({ parentId, content }) => {
  replyError.value = "";
  if (!usersStore.isAuthenticated) {
    replyError.value = "Debes iniciar sesión para responder.";
    return;
  }
  if (!content.trim()) {
    replyError.value = "Escribe una respuesta antes de enviar.";
    return;
  }
  try {
    await debatesStore.createComment({
      debateId: debateId.value,
      parentId,
      content: content.trim()
    });
    activeReplyId.value = null;
    replyError.value = "";
  } catch (error) {
    replyError.value = error?.response?.data?.error || "No se pudo publicar la respuesta.";
    toastStore.error(replyError.value);
    replyError.value = "";
  }
};

const submitPosition = async () => {
  if (!usersStore.isAuthenticated) {
    commentError.value = "Debes iniciar sesión para elegir una posición.";
    toastStore.info(commentError.value);
    return;
  }
  if (!position.value) return;
  try {
    await debatesStore.setPosition({ debateId: debateId.value, position: position.value });
    commentError.value = "";
  } catch (error) {
    commentError.value = error?.response?.data?.error || "No se pudo registrar tu posición.";
    toastStore.error(commentError.value);
    commentError.value = "";
  }
};

const voteComment = async (commentId, value) => {
  if (!usersStore.isAuthenticated) {
    toastStore.info("Debes iniciar sesión para votar comentarios.");
    return;
  }
  try {
    await debatesStore.voteComment({ debateId: debateId.value, commentId, value });
    commentError.value = "";
  } catch (error) {
    commentError.value = error?.response?.data?.error || "No se pudo votar el comentario.";
    toastStore.error(commentError.value);
    commentError.value = "";
  }
};

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <q-page>
    <div class="row q-col-gutter-lg q-px-md q-pb-lg debate-page-wrap">
      <div class="col-12 col-lg-8">
        <q-skeleton v-if="debatesStore.loadingDebate" type="rect" height="220px" />
        <DebateCard
          v-else-if="debate"
          :debate="debate"
          :show-action="false"
          :show-back="true"
          variant="detail"
          @back="router.push({ name: 'home' })"
        />

        <q-card flat bordered class="q-mb-md debate-surface debate-position-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium q-mb-md">Tu posición en el debate</div>
            <div class="debate-position-grid">
              <button
                type="button"
                class="debate-position-option"
                :class="{ active: position === 'support', support: true }"
                @click="position = 'support'"
              >
                <span class="debate-position-head">
                  <span class="debate-position-title">A favor</span>
                  <span class="debate-position-pill"></span>
                </span>
                <span class="debate-position-copy">Apoyas la propuesta o ves más beneficios.</span>
              </button>
              <button
                type="button"
                class="debate-position-option"
                :class="{ active: position === 'oppose', oppose: true }"
                @click="position = 'oppose'"
              >
                <span class="debate-position-head">
                  <span class="debate-position-title">En contra</span>
                  <span class="debate-position-pill"></span>
                </span>
                <span class="debate-position-copy">No compartes la medida o ves más riesgos.</span>
              </button>
              <button
                type="button"
                class="debate-position-option"
                :class="{ active: position === 'neutral', neutral: true }"
                @click="position = 'neutral'"
              >
                <span class="debate-position-head">
                  <span class="debate-position-title">Neutral</span>
                  <span class="debate-position-pill"></span>
                </span>
                <span class="debate-position-copy">Aún no tomas postura o ves equilibrio.</span>
              </button>
            </div>
            <div class="debate-position-actions">
              <q-btn class="q-mt-sm" color="primary" unelevated label="Guardar posición" @click="submitPosition" />
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mb-md debate-surface debate-comment-form-card">
          <q-card-section>
            <div class="text-subtitle1 text-weight-medium q-mb-sm">Comentarios</div>
            <q-input
              v-model="newComment"
              type="textarea"
              outlined
              autogrow
              class="debate-comment-input"
              placeholder="Escribe tu comentario"
            />
            <div class="debate-comment-form-actions">
              <q-btn class="q-mt-sm" color="primary" unelevated label="Publicar comentario" @click="submitComment" />
            </div>
          </q-card-section>
        </q-card>

        <div class="debate-comments-list">
          <DebateCommentItem
            v-for="comment in rootComments"
            :key="comment.id"
            :comment="comment"
            :children-map="commentsByParent"
            :depth="0"
            :is-last="comment.id === rootComments[rootComments.length - 1]?.id"
            :active-reply-id="activeReplyId"
            :reply-error="replyError"
            :is-authenticated="usersStore.isAuthenticated"
            @vote="voteComment"
            @reply="openReply"
            @cancel-reply="cancelReply"
            @submit-reply="submitReply"
          />

          <q-card v-if="comments.length === 0" flat bordered class="debate-surface">
            <q-card-section class="text-grey-7">
              Todavía no hay comentarios en este debate.
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="q-gutter-md">
          <q-card flat bordered class="debate-surface side-panel">
            <q-card-section>
              <div class="text-overline text-grey-7 q-mb-sm panel-heading">{{ authorPanelTitle }}</div>
              <div
                v-if="debate?.author"
                class="debate-author-profile"
                :class="{ 'debate-author-profile-editorial': debate.author.type !== 'user' }"
              >
                <template v-if="debate.author.type === 'user'">
                  <div class="debate-author-topline">
                    <q-avatar class="debate-author-avatar" size="60px" color="primary" text-color="white">
                      <img
                        v-if="debate.author.avatarUrl"
                        :src="debate.author.avatarUrl"
                        :alt="`Avatar de ${debate.author.name}`"
                      />
                      <span v-else>{{ debate.author.name?.slice(0, 1)?.toUpperCase() || "T" }}</span>
                    </q-avatar>
                    <div class="debate-author-main">
                      <div class="debate-author-kicker">Perfil autor</div>
                      <div
                        class="debate-author-name cursor-pointer"
                        @click="router.push({ name: 'perfil', params: { username: debate.author.name } })"
                      >
                        @{{ debate.author.name }}
                      </div>
                      <div class="debate-author-label">{{ debate.author.label }}</div>
                    </div>
                  </div>

                  <div class="debate-author-focus">
                    {{ debate.author.focus || debate.author.label }}
                  </div>

                  <div class="debate-author-bio">
                    {{ debate.author.bio }}
                  </div>

                  <div v-if="debate.author.traits?.length" class="debate-author-traits">
                    <span v-for="trait in debate.author.traits" :key="trait" class="debate-author-trait">
                      {{ trait }}
                    </span>
                  </div>

                  <div class="debate-author-meta">
                    <span>Fuente: usuario</span>
                    <span v-if="debate.author.location">{{ debate.author.location }}</span>
                    <span>Índice {{ debate.author.reliabilityScore || 0 }}</span>
                  </div>
                </template>

                <template v-else>
                  <div class="debate-author-topline">
                    <q-avatar class="debate-author-avatar" size="60px" color="primary" text-color="white">
                      <span>{{ debate.author.name?.slice(0, 1)?.toUpperCase() || "T" }}</span>
                    </q-avatar>
                    <div class="debate-author-main">
                      <div class="debate-author-kicker">Debate editorial</div>
                      <div class="debate-author-name">{{ debate.author.name }}</div>
                      <div class="debate-author-label">{{ debate.author.label }}</div>
                    </div>
                  </div>

                  <div class="debate-author-focus">
                    Este tema lo propone el sistema editorial de TDD a partir de una noticia reciente. No representa la opinión de una persona concreta: sirve para abrir conversación con contexto y una pregunta clara.
                  </div>

                  <div class="debate-author-bio">
                    {{ debate.author.bio }}
                  </div>

                  <div class="debate-editorial-notes">
                    <div class="debate-editorial-note">
                      Resume el conflicto principal de la noticia para que la comunidad discuta el fondo del tema.
                    </div>
                    <div class="debate-editorial-note">
                      La postura la pone la conversación de los usuarios, no la ficha editorial.
                    </div>
                  </div>

                  <div class="debate-author-meta">
                    <span v-for="item in editorialMetaItems" :key="item">{{ item }}</span>
                  </div>
                </template>
              </div>
              <div v-else class="text-grey-7">Sin información de autor disponible.</div>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="debate-surface side-panel">
            <q-card-section>
              <div class="text-overline text-grey-7 q-mb-sm panel-heading">Antes de comentar</div>
              <div class="debate-rules-board">
                <div class="debate-rules-pin" aria-hidden="true"></div>
                <div class="debate-rules-paper">
                  <div class="debate-rules-title">Tablón de la comunidad</div>
                  <div class="debate-rules-subtitle">Un recordatorio rápido para que la conversación merezca la pena.</div>

                  <ul class="debate-rules-list">
                    <li>Explica tu punto con una razón concreta, aunque sea breve.</li>
                    <li>Debate las ideas con firmeza, sin atacar a quien piensa distinto.</li>
                    <li>Si algo no lo tienes claro, dilo: preguntar también mejora el debate.</li>
                    <li>Evita repetir eslóganes o soltar el titular sin aportar nada más.</li>
                  </ul>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>
