<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { instalacion } from "@/utils/instalacion";

/**
 * Aviso para instalar la web como aplicacion.
 *
 * Chrome y Edge disparan beforeinstallprompt y dejan abrir el dialogo del
 * navegador. Safari en iOS no lo hace: alli hay que usar Compartir y luego
 * «Anadir a pantalla de inicio», asi que se explican los pasos.
 *
 * Los mismos pasos estan siempre disponibles en Ajustes, para quien cierre
 * este aviso.
 */

const DESCARTADO = "tdd.installDismissed";

const visible = ref(false);
const esIos = ref(false);

/* El evento ya lo guarda main.js; aqui solo decide si se ensena el aviso. */
const alInstalar = () => {
  if (!instalacion.yaInstalada() && !localStorage.getItem(DESCARTADO)) {
    visible.value = true;
  }
};

const instalar = async () => {
  const instalada = await instalacion.lanzarDialogo();
  if (instalada !== null) {
    visible.value = false;
  }
};

const cerrar = () => {
  visible.value = false;
  localStorage.setItem(DESCARTADO, "1");
};

onMounted(() => {
  esIos.value = instalacion.esIos();

  if (instalacion.yaInstalada() || localStorage.getItem(DESCARTADO)) return;

  // En iOS no hay evento del navegador: el aviso se muestra directamente.
  if (esIos.value && instalacion.esSafari()) {
    visible.value = true;
  }

  window.addEventListener("beforeinstallprompt", alInstalar);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeinstallprompt", alInstalar);
});
</script>

<template>
  <div v-if="visible" class="install-prompt">
    <span class="material-symbols-rounded" style="color: var(--tdd-primary)">
      install_mobile
    </span>

    <div class="install-prompt-texto">
      <div class="install-prompt-titulo">Instala TuDebateDiario</div>
      <div class="install-prompt-detalle">
        <template v-if="esIos">
          Pulsa <strong>Compartir</strong> y luego «Añadir a pantalla de inicio».
        </template>
        <template v-else>Se abre a pantalla completa, como una app.</template>
      </div>
    </div>

    <button v-if="!esIos" type="button" class="btn btn-primary btn-sm" @click="instalar">
      Instalar
    </button>

    <button type="button" class="icon-btn" aria-label="Cerrar aviso" @click="cerrar">
      <span class="material-symbols-rounded">close</span>
    </button>
  </div>
</template>
