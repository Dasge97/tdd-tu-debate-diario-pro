<script setup>
import { computed } from "vue";
import { useFavoritesStore } from "@/stores/favorites";
import { useUsersStore } from "@/stores/users";

const props = defineProps({
  debate: {
    type: Object,
    required: true
  },
  showAction: {
    type: Boolean,
    default: true
  },
  showBack: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: "compact"
  }
});

const emit = defineEmits(["open", "back"]);
const favoritesStore = useFavoritesStore();
const usersStore = useUsersStore();

const isFavorite = computed(() => favoritesStore.favoriteIds.has(Number(props.debate.id)));
const favor = computed(() => Math.max(0, Number(props.debate.positions?.favor || 0)));
const contra = computed(() => Math.max(0, Number(props.debate.positions?.contra || 0)));
const neutral = computed(() => Math.max(0, Number(props.debate.positions?.neutral || 0)));
const totalVotes = computed(() => {
  const raw = props.debate.positionsRaw || {};
  return Number(raw.support || 0) + Number(raw.oppose || 0) + Number(raw.neutral || 0);
});

const isDetail = computed(() => props.variant === "detail");
const shortDescription = computed(
  () => props.debate.cardSummary || props.debate.context || ""
);
const question = computed(() => props.debate.question || "");
const contextParagraphs = computed(() =>
  String(props.debate.context || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
);

const publishedAtLabel = computed(() => {
  if (!props.debate.publishedAt) return "";

  const date = new Date(props.debate.publishedAt);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
});

const segmentStyle = (value, color) => ({
  width: `${Math.max(0, Number(value || 0))}%`,
  background: color
});

const toggleFavorite = async () => {
  if (!usersStore.isAuthenticated) return;
  await favoritesStore.toggle(props.debate.id);
};
</script>

<template>
  <q-card flat bordered class="q-mb-md debate-card debate-surface" :class="{ 'debate-card-detail': isDetail }">
    <q-card-section class="debate-card-body">
      <div class="debate-card-main">
        <div class="debate-card-topbar">
          <div class="debate-card-topspacer">
            <button v-if="showBack" type="button" class="debate-inline-back" @click="emit('back')">
              <span class="material-icons">arrow_back</span>
              <span>Volver</span>
            </button>
          </div>
          <q-btn
            v-if="usersStore.isAuthenticated"
            flat
            round
            dense
            size="sm"
            class="debate-favorite-btn"
            :icon="isFavorite ? 'favorite' : 'favorite_border'"
            @click="toggleFavorite"
          />
        </div>

        <div v-if="isDetail && (debate.category || publishedAtLabel)" class="debate-kicker-row q-mb-sm">
          <span v-if="debate.category" class="debate-kicker-chip">{{ debate.category }}</span>
          <span v-if="publishedAtLabel" class="debate-kicker-text">{{ publishedAtLabel }}</span>
        </div>

        <div class="text-h6 q-mb-sm debate-title">{{ props.debate.title }}</div>

        <template v-if="isDetail">
          <article class="debate-story q-mb-md">
            <div class="debate-section-label debate-story-heading">De qué va este debate</div>

            <p v-if="question" class="debate-story-paragraph debate-story-question">
              <span class="debate-story-lead">La pregunta:</span>
              {{ question }}
            </p>

            <p v-if="shortDescription" class="debate-story-paragraph">
              <span class="debate-story-lead">La idea central:</span>
              {{ shortDescription }}
            </p>

            <p v-for="(paragraph, index) in contextParagraphs" :key="index" class="debate-story-paragraph">
              {{ paragraph }}
            </p>

          </article>
        </template>

        <div v-else class="text-body2 text-grey-8 q-mb-md debate-context">
          {{ shortDescription }}
        </div>

        <div class="text-caption text-grey-7 q-mb-xs position-label">Posición de la comunidad</div>
        <div class="debate-segmented-bar q-mb-sm" aria-label="Resultado de posiciones">
          <div class="debate-segment debate-segment-favor" :style="segmentStyle(favor, '#2ecc71')"></div>
          <div class="debate-segment debate-segment-contra" :style="segmentStyle(contra, '#e74c3c')"></div>
          <div class="debate-segment debate-segment-neutral" :style="segmentStyle(neutral, '#bdc3c7')"></div>
        </div>

        <div class="debate-legend q-mb-md">
          <div class="debate-legend-item">
            <span class="debate-legend-dot" style="background:#2ecc71"></span>
            <span>A favor {{ favor }}%</span>
          </div>
          <div class="debate-legend-item">
            <span class="debate-legend-dot" style="background:#e74c3c"></span>
            <span>En contra {{ contra }}%</span>
          </div>
          <div class="debate-legend-item">
            <span class="debate-legend-dot" style="background:#bdc3c7"></span>
            <span>Neutral {{ neutral }}%</span>
          </div>
        </div>

        <div class="debate-card-actions">
          <div class="debate-card-tools">
            <div class="debate-meta-row">
              <div class="debate-meta-item">
                <span class="material-icons debate-meta-icon">people</span>
                <span>{{ totalVotes }} votos</span>
              </div>
              <div class="debate-meta-separator">·</div>
              <div class="debate-meta-item">
                <span class="material-icons debate-meta-icon">chat_bubble_outline</span>
                <span>{{ props.debate.commentCount || 0 }} comentarios</span>
              </div>
            </div>
          </div>
          <q-btn
            v-if="showAction"
            color="primary"
            label="Entrar al debate"
            unelevated
            class="debate-action-btn"
            @click="emit('open', props.debate.id)"
          />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.debate-card-detail {
  border-radius: 24px;
}

.debate-kicker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.debate-kicker-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(27, 107, 82, 0.12);
  color: #1f6b52;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: capitalize;
}

.debate-kicker-text {
  color: #7b6c61;
  font-size: 0.86rem;
}

.debate-story {
  padding: 8px 0 2px;
}

.debate-section-label {
  margin-bottom: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8f715f;
}

.debate-story-heading {
  margin-bottom: 14px;
}

.debate-story-paragraph {
  margin: 0;
  font-size: 1rem;
  line-height: 1.75;
  color: #473a31;
}

.debate-story-paragraph + .debate-story-paragraph {
  margin-top: 14px;
}

.debate-story-question {
  font-size: 1.06rem;
  color: #2f241d;
}

.debate-story-lead {
  margin-right: 6px;
  color: #2f241d;
  font-weight: 700;
}

</style>
