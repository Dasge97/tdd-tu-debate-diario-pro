<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const username = ref("");
const email = ref("");
const password = ref("");
const repeat = ref("");
const showPassword = ref(false);
const touched = ref(false);

/* El servidor solo exige que no esten vacios; el minimo de 8 es cosa nuestra. */
const passwordTooShort = computed(() => password.value.length > 0 && password.value.length < 8);
const passwordsDiffer = computed(() => repeat.value.length > 0 && password.value !== repeat.value);
const canSubmit = computed(
  () =>
    username.value.trim().length >= 3 &&
    email.value.trim() !== "" &&
    password.value.length >= 8 &&
    password.value === repeat.value
);

const submit = async () => {
  touched.value = true;
  if (!canSubmit.value) return;

  const ok = await auth.register(username.value.trim(), email.value.trim(), password.value);
  if (ok) {
    router.replace({ name: "home" });
  }
};
</script>

<template>
  <section class="auth-page">
    <div class="auth-brand">
      <h1 class="auth-brand-title">Crea tu cuenta</h1>
      <p class="auth-brand-sub">Para votar, comentar y debatir.</p>
    </div>

    <form class="surface surface-pad" @submit.prevent="submit">
      <p v-if="auth.error" class="form-error">{{ auth.error }}</p>

      <label class="field">
        <span class="field-label">Nombre de usuario</span>
        <input
          v-model="username"
          class="input"
          type="text"
          autocomplete="username"
          required
          minlength="3"
          maxlength="30"
          placeholder="Cómo te verán en los debates"
        />
        <span v-if="touched && username.trim().length < 3" class="field-error">
          Usa al menos 3 caracteres.
        </span>
      </label>

      <label class="field">
        <span class="field-label">Correo electrónico</span>
        <input
          v-model="email"
          class="input"
          type="email"
          inputmode="email"
          autocomplete="email"
          required
          placeholder="tu@correo.com"
        />
      </label>

      <label class="field">
        <span class="field-label">Contraseña</span>
        <span style="position: relative; display: block">
          <input
            v-model="password"
            class="input"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            required
            minlength="8"
            placeholder="Mínimo 8 caracteres"
            style="padding-right: 52px"
          />
          <button
            type="button"
            class="icon-btn"
            style="position: absolute; right: 3px; top: 3px"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="showPassword = !showPassword"
          >
            <span class="material-symbols-rounded">
              {{ showPassword ? "visibility_off" : "visibility" }}
            </span>
          </button>
        </span>
        <span v-if="passwordTooShort" class="field-error">Mínimo 8 caracteres.</span>
      </label>

      <label class="field">
        <span class="field-label">Repite la contraseña</span>
        <input
          v-model="repeat"
          class="input"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          required
        />
        <span v-if="passwordsDiffer" class="field-error">Las contraseñas no coinciden.</span>
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="auth.loading">
        {{ auth.loading ? "Creando cuenta…" : "Crear cuenta" }}
      </button>

      <p class="legal-note">
        Al crear la cuenta aceptas los
        <a href="/legal/terminos">términos</a> y la
        <a href="/legal/privacidad">política de privacidad</a>.
      </p>
    </form>

    <p class="auth-switch">
      ¿Ya tienes cuenta?
      <RouterLink :to="{ name: 'login' }">Entra aquí</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.auth-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - 60px);
  padding: 20px 0;
}

.auth-brand {
  text-align: center;
  margin-bottom: 22px;
}

.auth-brand-title {
  font-size: 1.7rem;
}

.auth-brand-sub {
  margin: 6px 0 0;
  color: var(--tdd-muted);
}

.legal-note {
  margin: 14px 0 0;
  font-size: 0.8rem;
  color: var(--tdd-muted);
  text-align: center;
  line-height: 1.5;
}

.auth-switch {
  margin-top: 20px;
  text-align: center;
  font-size: 0.92rem;
  color: var(--tdd-muted);
}
</style>
