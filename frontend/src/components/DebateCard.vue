<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "@/components/UserAvatar.vue";
import PositionBar from "@/components/PositionBar.vue";
import { useDebatesStore } from "@/stores/debates";
import { plural } from "@/utils/format";
import { useFavoritesStore } from "@/stores/favorites";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

const props = defineProps({
  debate: { type: Object, required: true }
});

const router = useRouter();
const debates = useDebatesStore();
const favorites = useFavoritesStore();
const ui = useUiStore();

const percentages = computed(() => debates.percentagesFor(props.debate.id));
const isFavorite = computed(() => favorites.isFavorite(props.debate.id));
const summary = computed(() => props.debate.cardSummary || props.debate.context || "");
const author = computed(() => props.debate.createdBy || null);

const open = () => router.push({ name: "debate", params: { id: props.debate.id } });

const toggleFavorite = async () => {
  try {
    const favorited = await favorites.toggle(props.debate.id);
    ui.success(favorited ? "Guardado en favoritos" : "Quitado de favoritos");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
};
</script>

<template>
  <article class="debate-card debate-surface">
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

      <button
        type="button"
        class="icon-btn"
        :aria-label="isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'"
        :aria-pressed="isFavorite"
        @click.stop="toggleFavorite"
      >
        <span
          class="material-symbols-rounded"
          :style="isFavorite ? 'color:#e74c3c;font-variation-settings:\'FILL\' 1' : ''"
        >
          favorite
        </span>
      </button>
    </div>

    <div role="button" tabindex="0" @click="open" @keydown.enter="open" @keydown.space.prevent="open">
      <h2 class="debate-title">{{ debate.title }}</h2>

      <p v-if="summary" class="debate-context">{{ summary }}</p>

      <PositionBar :percentages="percentages" />

      <div class="debate-meta-row">
        <span class="debate-meta-item">
          <span class="material-symbols-rounded">group</span>
          {{ plural(percentages?.total ?? 0, "voto", "votos") }}
        </span>
        <span class="debate-meta-separator">·</span>
        <span class="debate-meta-item">
          <span class="material-symbols-rounded">chat_bubble</span>
          {{ plural(debate.commentCount || 0, "comentario", "comentarios") }}
        </span>
      </div>
    </div>

    <button type="button" class="btn btn-primary btn-block" style="margin-top: 14px" @click="open">
      Entrar al debate
    </button>
  </article>
</template>
