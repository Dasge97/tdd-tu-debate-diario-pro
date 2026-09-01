<script setup>
import { computed, onMounted } from "vue";
import UserAvatar from "@/components/UserAvatar.vue";
import { useAuthStore } from "@/stores/auth";
import { useFavoritesStore } from "@/stores/favorites";
import { formatDate } from "@/utils/format";

const auth = useAuthStore();
const favorites = useFavoritesStore();

const user = computed(() => auth.user);

onMounted(() => {
  auth.refreshProfile().catch(() => {});
  favorites.load().catch(() => {});
});
</script>

<template>
  <section v-if="user">
    <div class="surface surface-pad" style="text-align: center">
      <UserAvatar :user="user" size="lg" />
      <h1 style="margin-top: 12px; font-size: 1.35rem">{{ user.username }}</h1>

      <p v-if="user.profileTagline" class="text-muted" style="margin: 6px 0 0">
        {{ user.profileTagline }}
      </p>

      <p v-if="user.bio" style="margin: 12px 0 0; line-height: 1.65; color: #51453b">
        {{ user.bio }}
      </p>

      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">{{ user.reliabilityScore ?? 0 }}</div>
          <div class="profile-stat-label">Fiabilidad</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">{{ favorites.items.length }}</div>
          <div class="profile-stat-label">Favoritos</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">{{ formatDate(user.createdAt).split(" ").pop() }}</div>
          <div class="profile-stat-label">Desde</div>
        </div>
      </div>

      <RouterLink class="btn btn-primary btn-block" :to="{ name: 'edit-profile' }" style="margin-top: 18px">
        Editar perfil
      </RouterLink>
    </div>

    <div class="surface list-card" style="margin-top: 18px">
      <RouterLink class="list-row" :to="{ name: 'favorites' }">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">favorite</span>
        <span class="list-row-main"><span class="list-row-title">Debates guardados</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
      </RouterLink>

      <RouterLink class="list-row" :to="{ name: 'friends' }">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">group</span>
        <span class="list-row-main"><span class="list-row-title">Amigos</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
      </RouterLink>

      <RouterLink class="list-row" :to="{ name: 'propose' }">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">add_circle</span>
        <span class="list-row-main"><span class="list-row-title">Proponer un debate</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
      </RouterLink>

      <RouterLink class="list-row" :to="{ name: 'settings' }">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">settings</span>
        <span class="list-row-main"><span class="list-row-title">Ajustes</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">chevron_right</span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--tdd-line);
}

.profile-stat-value {
  font-family: "Bitter", Georgia, serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--tdd-primary);
}

.profile-stat-label {
  font-size: 0.76rem;
  color: var(--tdd-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
