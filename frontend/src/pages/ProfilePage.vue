<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUsersStore } from "@/stores/users";
import { useFriendsStore } from "@/stores/friends";
import { useToastStore } from "@/stores/toast";

const route = useRoute();
const router = useRouter();
const usersStore = useUsersStore();
const friendsStore = useFriendsStore();
const toastStore = useToastStore();

const form = reactive({ bio: "", avatarUrl: "", location: "", profileTagline: "", profileTraitsText: "" });
const avatarInput = ref(null);
const avatarPreviewUrl = ref("");
const uploadingAvatar = ref(false);

const profile = computed(() => usersStore.profile);
const displayedAvatarUrl = computed(() => avatarPreviewUrl.value || profile.value?.avatarUrl || "");
const isOwnProfile = computed(
  () => usersStore.isAuthenticated && usersStore.me?.username === String(route.params.username || "").toLowerCase()
);

const relationStatus = computed(() => {
  if (!profile.value || isOwnProfile.value) return "none";
  return friendsStore.relationStatusByUserId[profile.value.id] || "none";
});

const loadProfile = async () => {
  const username = String(route.params.username || "").trim().toLowerCase();
  if (!username) return;
  await usersStore.fetchProfileByUsername(username);

  if (isOwnProfile.value && usersStore.me) {
    form.bio = usersStore.me.bio || "";
    form.avatarUrl = usersStore.me.avatarUrl || "";
    form.location = usersStore.me.location || "";
    form.profileTagline = usersStore.me.profileTagline || "";
    form.profileTraitsText = Array.isArray(usersStore.me.profileTraits) ? usersStore.me.profileTraits.join(", ") : "";
  }

  if (usersStore.isAuthenticated && profile.value && !isOwnProfile.value) {
    await friendsStore.fetchStatus(profile.value.id);
  }
};

const saveProfile = async () => {
  await usersStore.updateMe({
    bio: form.bio,
    avatarUrl: form.avatarUrl,
    location: form.location,
    profileTagline: form.profileTagline,
    profileTraits: form.profileTraitsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8)
  });
  await loadProfile();
};

const triggerAvatarPicker = () => {
  avatarInput.value?.click?.();
};

const onAvatarSelected = async (event) => {
  const file = event?.target?.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    toastStore.error("Solo se permiten imágenes JPG, PNG o WEBP.");
    event.target.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    toastStore.error("La imagen no puede superar 2 MB.");
    event.target.value = "";
    return;
  }

  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
  }
  avatarPreviewUrl.value = URL.createObjectURL(file);
  uploadingAvatar.value = true;

  try {
    await usersStore.uploadAvatar(file);
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value);
      avatarPreviewUrl.value = "";
    }
    toastStore.success("Avatar actualizado.");
    await loadProfile();
  } catch (error) {
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value);
      avatarPreviewUrl.value = "";
    }
    toastStore.error(error?.response?.data?.error || "No se pudo subir el avatar.");
  } finally {
    uploadingAvatar.value = false;
    event.target.value = "";
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: "home" });
};

const sendRequest = async () => {
  if (!profile.value) return;
  await friendsStore.sendRequest(profile.value.id);
};

const acceptRequest = async () => {
  if (!profile.value) return;
  await friendsStore.accept(profile.value.id);
};

const rejectRequest = async () => {
  if (!profile.value) return;
  await friendsStore.reject(profile.value.id);
};

const removeFriend = async () => {
  if (!profile.value) return;
  await friendsStore.remove(profile.value.id);
};

watch(() => route.params.username, loadProfile);
onMounted(async () => {
  if (usersStore.isAuthenticated && !usersStore.me) await usersStore.fetchMe();
  await loadProfile();
});
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <div class="profile-back-row q-mt-md q-mb-sm">
      <button type="button" class="debate-inline-back" @click="goBack">
        <span class="material-icons">arrow_back</span>
        <span>Volver</span>
      </button>
    </div>

    <div class="row q-col-gutter-lg q-mt-md">
      <div class="col-12 col-lg-8">
        <q-card flat bordered class="debate-surface profile-hero-card">
          <q-card-section>
            <div class="profile-hero-panel">
              <div class="profile-hero-top">
                <q-avatar class="profile-hero-avatar" size="74px" color="primary" text-color="white">
                  <img v-if="displayedAvatarUrl" :src="displayedAvatarUrl" :alt="`Avatar de ${profile?.username || 'usuario'}`" />
                  <span v-else>{{ (profile?.username || '?').slice(0, 1).toUpperCase() }}</span>
                </q-avatar>

                <div class="profile-hero-main">
                  <div class="profile-hero-kicker">
                    {{ isOwnProfile ? 'Tu voz en la comunidad' : 'Perfil público' }}
                  </div>
                  <div class="profile-hero-name">@{{ profile?.username }}</div>
                  <div class="profile-hero-tagline">
                    {{ profile?.profileTagline || 'Sin enfoque definido' }}
                  </div>
                </div>

                <div v-if="!isOwnProfile && usersStore.isAuthenticated" class="profile-hero-actions">
                  <q-btn
                    v-if="relationStatus === 'none'"
                    color="primary"
                    unelevated
                    label="Agregar amigo"
                    @click="sendRequest"
                  />
                  <q-btn
                    v-else-if="relationStatus === 'pending_received'"
                    color="positive"
                    unelevated
                    label="Aceptar solicitud"
                    @click="acceptRequest"
                  />
                  <q-btn
                    v-if="relationStatus === 'pending_received'"
                    flat
                    color="negative"
                    label="Rechazar"
                    @click="rejectRequest"
                  />
                  <q-btn
                    v-else-if="relationStatus === 'pending_sent'"
                    color="grey-7"
                    unelevated
                    disable
                    label="Solicitud enviada"
                  />
                  <q-btn
                    v-else-if="relationStatus === 'friends'"
                    flat
                    color="negative"
                    label="Eliminar amigo"
                    @click="removeFriend"
                  />
                  <q-btn
                    v-else-if="relationStatus === 'rejected'"
                    color="grey-7"
                    unelevated
                    disable
                    label="Solicitud rechazada"
                  />
                </div>
                <div v-else-if="isOwnProfile" class="profile-hero-actions">
                  <q-btn
                    color="primary"
                    unelevated
                    no-caps
                    :loading="uploadingAvatar"
                    label="Cambiar avatar"
                    @click="triggerAvatarPicker"
                  />
                  <input
                    ref="avatarInput"
                    class="hidden"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    @change="onAvatarSelected"
                  />
                </div>
              </div>

              <div class="profile-hero-focus">
                {{ profile?.bio || 'Todavía no ha definido una presentación pública.' }}
              </div>

              <div v-if="profile?.profileTraits?.length" class="profile-hero-traits">
                <span v-for="trait in profile.profileTraits" :key="trait" class="profile-hero-trait">
                  {{ trait }}
                </span>
              </div>

              <div class="profile-hero-meta">
                <span>Índice {{ profile?.reliabilityScore || 0 }}</span>
                <span>{{ profile?.location || 'Ubicación no especificada' }}</span>
                <span>{{ isOwnProfile ? 'Perfil editable' : 'Miembro visible' }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-lg-4">
        <q-card flat bordered class="debate-surface side-panel">
          <q-card-section>
            <div class="text-overline text-grey-7 q-mb-sm panel-heading">Resumen del perfil</div>
            <div class="profile-summary-list">
              <div class="profile-summary-item">
                <span class="profile-summary-label">Firma</span>
                <span class="profile-summary-value">{{ profile?.profileTagline || 'Sin definir' }}</span>
              </div>
              <div class="profile-summary-item">
                <span class="profile-summary-label">Ubicación</span>
                <span class="profile-summary-value">{{ profile?.location || 'No indicada' }}</span>
              </div>
              <div class="profile-summary-item">
                <span class="profile-summary-label">Criterio</span>
                <span class="profile-summary-value">{{ profile?.reliabilityScore || 0 }}</span>
              </div>
              <div class="profile-summary-item">
                <span class="profile-summary-label">Rasgos</span>
                <span class="profile-summary-value">{{ profile?.profileTraits?.length || 0 }}</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card v-if="isOwnProfile" flat bordered class="debate-surface q-mt-md">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium q-mb-sm">Editar perfil</div>
        <q-input v-model="form.bio" outlined type="textarea" autogrow label="Bio" maxlength="280" class="q-mb-sm" />
        <q-input v-model="form.profileTagline" outlined label="Enfoque o firma del perfil" maxlength="160" class="q-mb-sm" />
        <q-input
          v-model="form.profileTraitsText"
          outlined
          type="textarea"
          autogrow
          label="Aptitudes o rasgos (separados por comas)"
          hint="Ejemplo: analítico, sereno, economía, regulación"
          class="q-mb-sm"
        />
        <q-input v-model="form.location" outlined label="Ubicación" class="q-mb-sm" />
        <q-input v-model="form.avatarUrl" outlined label="URL de avatar" class="q-mb-sm" />
        <q-btn color="primary" unelevated label="Guardar cambios" @click="saveProfile" />
      </q-card-section>
    </q-card>
  </q-page>
</template>
