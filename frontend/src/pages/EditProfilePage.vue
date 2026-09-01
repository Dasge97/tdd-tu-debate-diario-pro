<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import UserAvatar from "@/components/UserAvatar.vue";
import { usersService } from "@/services";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const form = ref({
  bio: auth.user?.bio || "",
  location: auth.user?.location || "",
  profileTagline: auth.user?.profileTagline || ""
});

const saving = ref(false);
const uploading = ref(false);
const fileInput = ref(null);

const save = async () => {
  saving.value = true;
  try {
    const user = await usersService.updateMe(form.value);
    auth.persistUser(user);
    ui.success("Perfil actualizado.");
    router.back();
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar los cambios."));
  } finally {
    saving.value = false;
  }
};

/* El servidor acepta JPG, PNG y WebP hasta 5 MB. */
const pickAvatar = () => fileInput.value?.click();

const uploadAvatar = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    ui.error("La imagen supera los 5 MB.");
    return;
  }

  uploading.value = true;
  try {
    const { avatarUrl } = await usersService.uploadAvatar(file);
    auth.persistUser({ ...auth.user, avatarUrl });
    ui.success("Foto actualizada.");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido subir la foto."));
  } finally {
    uploading.value = false;
    event.target.value = "";
  }
};
</script>

<template>
  <section>
    <div class="surface surface-pad" style="text-align: center; margin-bottom: 18px">
      <UserAvatar :user="auth.user" size="lg" />

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        @change="uploadAvatar"
      />

      <button
        class="btn btn-outline btn-sm"
        type="button"
        style="margin-top: 12px"
        :disabled="uploading"
        @click="pickAvatar"
      >
        {{ uploading ? "Subiendo…" : "Cambiar foto" }}
      </button>

      <p class="text-muted" style="margin: 10px 0 0; font-size: 0.78rem">
        JPG, PNG o WebP. Máximo 5 MB.
      </p>
    </div>

    <form class="surface surface-pad" @submit.prevent="save">
      <label class="field">
        <span class="field-label">Frase de presentación</span>
        <input
          v-model="form.profileTagline"
          class="input"
          type="text"
          maxlength="120"
          placeholder="Cómo te describirías en una línea"
        />
      </label>

      <label class="field">
        <span class="field-label">Sobre ti</span>
        <textarea
          v-model="form.bio"
          class="textarea"
          rows="5"
          maxlength="500"
          placeholder="Tus intereses, tu punto de vista, lo que quieras contar."
        />
      </label>

      <label class="field">
        <span class="field-label">Ubicación</span>
        <input
          v-model="form.location"
          class="input"
          type="text"
          maxlength="80"
          placeholder="Ciudad o región"
        />
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="saving">
        {{ saving ? "Guardando…" : "Guardar cambios" }}
      </button>
    </form>
  </section>
</template>
