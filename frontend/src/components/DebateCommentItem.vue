<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

defineOptions({
  name: "DebateCommentItem"
});

const props = defineProps({
  comment: {
    type: Object,
    required: true
  },
  childrenMap: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  isLast: {
    type: Boolean,
    default: false
  },
  activeReplyId: {
    type: Number,
    default: null
  },
  replyError: {
    type: String,
    default: ""
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["reply", "cancel-reply", "submit-reply", "vote"]);
const router = useRouter();

const replyDraft = ref("");

const childComments = computed(() => props.childrenMap[props.comment.id] || []);
const isReplying = computed(() => Number(props.activeReplyId) === Number(props.comment.id));
const maxDepth = computed(() => Math.min(props.depth, 5));
const formattedDate = computed(() => {
  const date = new Date(props.comment.createdAt);
  if (Number.isNaN(date.getTime())) return props.comment.createdAt;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
});

const startReply = () => {
  emit("reply", props.comment.id);
};

const cancelReply = () => {
  replyDraft.value = "";
  emit("cancel-reply");
};

const submitReply = async () => {
  const content = replyDraft.value.trim();
  if (!content) return;
  emit("submit-reply", {
    parentId: props.comment.id,
    content
  });
};

const goProfile = () => {
  router.push({ name: "perfil", params: { username: props.comment.username } });
};
</script>

<template>
  <article
    class="debate-thread-item"
    :class="{
      'is-root': depth === 0,
      'is-last': isLast
    }"
    :style="{ '--thread-depth': maxDepth }"
  >
    <div class="debate-thread-row">
      <div class="debate-thread-card">
        <header class="debate-thread-header">
          <div class="debate-thread-meta">
            <button type="button" class="debate-thread-user-link" @click="goProfile">
              <span class="debate-thread-user">@{{ comment.username }}</span>
            </button>
            <span class="debate-thread-date">{{ formattedDate }}</span>
          </div>
          <button type="button" class="debate-thread-reply-link" @click="startReply">
            Responder
          </button>
        </header>

        <div class="debate-thread-content">{{ comment.content }}</div>

        <div class="debate-thread-footer">
          <div class="debate-thread-votes">
            <button
              type="button"
              class="debate-thread-vote debate-thread-vote-up"
              :class="{ active: Number(comment.currentUserVote || 0) > 0 }"
              @click="$emit('vote', comment.id, 1)"
            >
              <span class="material-icons">arrow_upward</span>
              <span class="debate-thread-vote-count">{{ comment.upvotes || 0 }}</span>
            </button>
            <button
              type="button"
              class="debate-thread-vote debate-thread-vote-down"
              :class="{ active: Number(comment.currentUserVote || 0) < 0 }"
              @click="$emit('vote', comment.id, -1)"
            >
              <span class="material-icons">arrow_downward</span>
              <span class="debate-thread-vote-count">{{ comment.downvotes || 0 }}</span>
            </button>
          </div>
        </div>

        <div v-if="isReplying" class="debate-thread-reply-box">
          <q-input
            v-model="replyDraft"
            type="textarea"
            autogrow
            outlined
            dense
            placeholder="Escribe una respuesta"
          />
          <div v-if="replyError" class="text-negative text-caption q-mt-xs">{{ replyError }}</div>
          <div class="debate-thread-reply-actions">
            <q-btn flat no-caps label="Cancelar" @click="cancelReply" />
            <q-btn
              color="primary"
              unelevated
              no-caps
              label="Responder"
              :disable="!isAuthenticated || !replyDraft.trim()"
              @click="submitReply"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="childComments.length" class="debate-thread-children">
      <DebateCommentItem
        v-for="child in childComments"
        :key="child.id"
        :comment="child"
        :children-map="childrenMap"
        :depth="depth + 1"
        :is-last="child.id === childComments[childComments.length - 1]?.id"
        :active-reply-id="activeReplyId"
        :reply-error="activeReplyId === child.id ? replyError : ''"
        :is-authenticated="isAuthenticated"
        @vote="(...args) => $emit('vote', ...args)"
        @reply="$emit('reply', $event)"
        @cancel-reply="$emit('cancel-reply')"
        @submit-reply="$emit('submit-reply', $event)"
      />
    </div>
  </article>
</template>
