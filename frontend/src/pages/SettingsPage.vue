<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const installed = ref(false);
const notificationsAllowed = ref(false);

onMounted(() => {
  installed.value =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  notificationsAllowed.value =
    "Notification" in window && Notification.permission === "granted";
});

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
          <span class="list-row-title">Instalada como app</span>
          <span class="list-row-sub">
            {{ installed ? "Sí, se abre a pantalla completa" : "Aún no; instálala desde el navegador" }}
          </span>
        </span>
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
