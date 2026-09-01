<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const showPassword = ref(false);

const submit = async () => {
  const ok = await auth.login(email.value.trim(), password.value);
  if (ok) {
    router.replace(route.query.destino || { name: "home" });
  }
};
</script>

<template>
  <section class="auth-page">
    <div class="auth-brand">
      <h1 class="auth-brand-title">TuDebateDiario</h1>
      <p class="auth-brand-sub">El debate de hoy, cada día.</p>
    </div>

    <form class="surface surface-pad" @submit.prevent="submit">
      <h2 class="section-title" style="margin-bottom: 16px">Entrar</h2>

      <p v-if="auth.error" class="form-error">{{ auth.error }}</p>

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
            autocomplete="current-password"
            required
            placeholder="Tu contraseña"
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
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="auth.loading">
        {{ auth.loading ? "Entrando…" : "Entrar" }}
      </button>
    </form>

    <p class="auth-switch">
      ¿Todavía no tienes cuenta?
      <RouterLink :to="{ name: 'register' }">Créala aquí</RouterLink>
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
  margin-bottom: 26px;
}

.auth-brand-title {
  font-size: 1.9rem;
  letter-spacing: 0.02em;
}

.auth-brand-sub {
  margin: 6px 0 0;
  color: var(--tdd-muted);
}

.auth-switch {
  margin-top: 20px;
  text-align: center;
  font-size: 0.92rem;
  color: var(--tdd-muted);
}
</style>
