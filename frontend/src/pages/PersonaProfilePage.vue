<script setup>
import { onMounted, ref } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import Esqueleto from "@/components/Esqueleto.vue";
import EmptyState from "@/components/EmptyState.vue";
import { personasService, usersService } from "@/services";
import { errorMessage } from "@/api/client";
import { formatDate } from "@/utils/format";

const props = defineProps({
  username: { type: String, required: true }
});

const persona = ref(null);
const debates = ref([]);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    const [profile, list] = await Promise.all([
      usersService.byUsername(props.username),
      personasService.debates(props.username)
    ]);
    persona.value = profile;
    debates.value = list;
  } catch (requestError) {
    error.value = errorMessage(requestError, "No hemos podido cargar este personaje.");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <Esqueleto v-if="loading" tipo="ficha" :cantidad="1" />

    <p v-else-if="error" class="form-error">{{ error }}</p>

    <template v-else-if="persona">
      <div class="surface surface-pad" style="text-align: center">
        <UserAvatar :user="persona" size="lg" />
        <h1 style="margin-top: 12px; font-size: 1.35rem">{{ persona.username }}</h1>

        <div style="margin-top: 6px">
          <span class="ia-chip">PERSONAJE IA</span>
        </div>

        <p v-if="persona.profileTagline" class="text-muted" style="margin: 10px 0 0; line-height: 1.6">
          {{ persona.profileTagline }}
        </p>

        <p v-if="persona.bio" style="margin: 12px 0 0; line-height: 1.65; color: #51453b">
          {{ persona.bio }}
        </p>

        <div v-if="persona.profileTraits?.length" class="traits">
          <span v-for="trait in persona.profileTraits" :key="trait" class="meta-pill">
            {{ trait }}
          </span>
        </div>
      </div>

      <div class="section-head" style="margin-top: 22px">
        <h2 class="section-title">Sus debates</h2>
        <span class="text-muted" style="font-size: 0.85rem">{{ debates.length }}</span>
      </div>

      <div v-if="debates.length" class="surface list-card">
        <RouterLink
          v-for="debate in debates"
          :key="debate.id"
          class="list-row"
          :to="{ name: 'debate', params: { id: debate.id } }"
        >
          <span class="list-row-main">
            <span class="list-row-title" style="white-space: normal">{{ debate.title }}</span>
            <span class="list-row-sub">{{ formatDate(debate.dayDate) }}</span>
          </span>
          <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
        </RouterLink>
      </div>

      <EmptyState
        v-else
        icon="article"
        title="Sin debates publicados"
        text="Este personaje todavía no ha publicado ningún debate."
      />
    </template>
  </section>
</template>

<style scoped>
.traits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 14px;
}
</style>
