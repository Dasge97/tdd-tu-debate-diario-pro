<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { instalacion } from "@/utils/instalacion";

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const installed = ref(false);
const notificationsAllowed = ref(false);
const puedeInstalar = ref(false);
const esIos = ref(false);
const verPasos = ref(false);

onMounted(() => {
  installed.value = instalacion.yaInstalada();
  puedeInstalar.value = instalacion.sePuedeInstalar();
  esIos.value = instalacion.esIos();

  notificationsAllowed.value =
    "Notification" in window && Notification.permission === "granted";
});

/* Si el navegador ofrece dialogo propio se usa; si no, se explican los pasos. */
const instalar = async () => {
  const instalada = await instalacion.lanzarDialogo();

  if (instalada === null) {
    verPasos.value = true;
    return;
  }

  if (instalada) {
    installed.value = true;
    ui.success("Aplicación instalada.");
  }
};

const askNotifications = async () => {
  if (!("Notification" in window)) {
    ui.error("Este navegador no admite notificaciones.");
    return;
  }

  const permission = await Notification.requestPermission();
  notificationsAllowed.value = permission === "granted";

  if (permission === "granted") {
    ui.success("Notificaciones activadas.");
  } else {
    ui.error("Has bloqueado las notificaciones.");
  }
};

const logout = async () => {
  if (!window.confirm("¿Cerrar sesión?")) return;
  await auth.logout();
  router.replace({ name: "login" });
};
</script>

<template>
  <section>
    <div class="surface list-card">
      <div class="setting-row">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">person</span>
        <span class="list-row-main">
          <span class="list-row-title">{{ auth.user?.username }}</span>
          <span class="list-row-sub">{{ auth.user?.email }}</span>
        </span>
      </div>

      <div class="setting-row">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">
          install_mobile
        </span>
        <span class="list-row-main">
          <span class="list-row-title">Instalar la aplicación</span>
          <span class="list-row-sub">
            {{ installed ? "Ya está instalada" : "Se abre a pantalla completa, con su icono" }}
          </span>
        </span>
        <button
          v-if="!installed"
          class="btn btn-outline btn-sm"
          type="button"
          @click="instalar"
        >
          {{ puedeInstalar ? "Instalar" : "Cómo" }}
        </button>
      </div>

      <div v-if="verPasos && !installed" class="pasos-instalacion">
        <template v-if="esIos">
          <p>En iPhone y iPad, con Safari:</p>
          <ol>
            <li>Toca el botón <strong>Compartir</strong>, el cuadrado con la flecha hacia arriba.</li>
            <li>Baja y elige <strong>Añadir a pantalla de inicio</strong>.</li>
            <li>Confirma con <strong>Añadir</strong>.</li>
          </ol>
          <p class="text-muted">
            Solo funciona desde Safari. Chrome y Firefox en iPhone no ofrecen la opción.
          </p>
        </template>
        <template v-else>
          <p>En Android con Chrome:</p>
          <ol>
            <li>Abre el menú de los tres puntos.</li>
            <li>Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li>
          </ol>
          <p>En el ordenador, pulsa el icono de instalar de la barra de direcciones.</p>
        </template>
      </div>

      <div class="setting-row">
        <span class="material-symbols-rounded" style="color: var(--tdd-primary)">
          notifications_active
        </span>
        <span class="list-row-main">
          <span class="list-row-title">Notificaciones del navegador</span>
          <span class="list-row-sub">
            {{ notificationsAllowed ? "Permitidas" : "No permitidas" }}
          </span>
        </span>
        <button
          v-if="!notificationsAllowed"
          class="btn btn-outline btn-sm"
          type="button"
          @click="askNotifications"
        >
          Permitir
        </button>
      </div>
    </div>

    <div class="surface list-card" style="margin-top: 18px">
      <a class="list-row" href="/legal/privacidad">
        <span class="list-row-main"><span class="list-row-title">Privacidad</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">open_in_new</span>
      </a>
      <a class="list-row" href="/legal/terminos">
        <span class="list-row-main"><span class="list-row-title">Términos de uso</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">open_in_new</span>
      </a>
      <a class="list-row" href="/legal/ia">
        <span class="list-row-main"><span class="list-row-title">Política de IA</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">open_in_new</span>
      </a>
      <a class="list-row" href="/soporte">
        <span class="list-row-main"><span class="list-row-title">Soporte</span></span>
        <span class="material-symbols-rounded" style="color: #b9c0ca">open_in_new</span>
      </a>
    </div>

    <button class="btn btn-danger btn-block" type="button" style="margin-top: 22px" @click="logout">
      Cerrar sesión
    </button>
  </section>
</template>

<style scoped>
.pasos-instalacion {
  padding: 4px 16px 16px;
  font-size: 0.9rem;
  line-height: 1.6;
  color: #3f4753;
  border-bottom: 1px solid rgba(217, 211, 200, 0.6);
}

.pasos-instalacion p {
  margin: 8px 0;
}

.pasos-instalacion ol {
  margin: 0;
  padding-left: 20px;
}

.pasos-instalacion li + li {
  margin-top: 5px;
}
</style>
