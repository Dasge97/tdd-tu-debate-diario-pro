<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";

/**
 * Aviso para instalar la web como aplicacion.
 *
 * Chrome y Edge disparan beforeinstallprompt y permiten lanzar el dialogo del
 * navegador. Safari en iOS no lo hace, asi que ahi se explican los pasos
 * manuales (Compartir, Anadir a pantalla de inicio).
 */

const DISMISSED_KEY = "tdd.installDismissed";

const deferredPrompt = ref(null);
const visible = ref(false);
const isIos = ref(false);

const alreadyInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const onBeforeInstallPrompt = (event) => {
  event.preventDefault();
  deferredPrompt.value = event;
  if (!localStorage.getItem(DISMISSED_KEY)) {
    visible.value = true;
  }
};

const install = async () => {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  await deferredPrompt.value.userChoice;
  deferredPrompt.value = null;
  visible.value = false;
};

const dismiss = () => {
  visible.value = false;
  localStorage.setItem(DISMISSED_KEY, "1");
};

onMounted(() => {
  if (alreadyInstalled() || localStorage.getItem(DISMISSED_KEY)) return;

  const ua = window.navigator.userAgent;
  isIos.value = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  if (isIos.value) {
    visible.value = true;
  }

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
});
</script>

<template>
  <div v-if="visible" class="install-prompt">
    <span class="material-symbols-rounded" style="color: var(--tdd-primary)">
      install_mobile
    </span>

    <div style="flex: 1 1 auto; min-width: 0">
      <div style="font-weight: 600; font-size: 0.92rem">Instala TuDebateDiario</div>
      <div class="text-muted" style="font-size: 0.82rem">
        <template v-if="isIos">
          Pulsa Compartir y luego «Añadir a pantalla de inicio».
        </template>
        <template v-else>Se abre a pantalla completa, como una app.</template>
      </div>
    </div>

    <button v-if="!isIos" type="button" class="btn btn-primary btn-sm" @click="install">
      Instalar
    </button>
    <button type="button" class="icon-btn" aria-label="Cerrar aviso" @click="dismiss">
      <span class="material-symbols-rounded">close</span>
    </button>
  </div>
</template>
