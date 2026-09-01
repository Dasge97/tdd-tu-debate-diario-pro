<script setup>
import { ref } from "vue";
import HojaInferior from "@/components/HojaInferior.vue";
import { debatesService } from "@/services";
import { useUiStore } from "@/stores/ui";
import { useFavoritesStore } from "@/stores/favorites";
import { useSesion } from "@/composables/useSesion";
import { errorMessage } from "@/api/client";

/** Menu de opciones de un debate: compartir, guardar, copiar enlace, reportar. */

const props = defineProps({
  abierta: { type: Boolean, default: false },
  debate: { type: Object, required: true }
});

const emit = defineEmits(["cerrar"]);

const ui = useUiStore();
const favorites = useFavoritesStore();
const { exigeSesion } = useSesion();

const pidiendoMotivo = ref(false);

const MOTIVOS = [
  "Contenido ofensivo o de odio",
  "Información falsa",
  "Spam o publicidad",
  "Otro motivo"
];

const enlace = () => `${window.location.origin}/app/debate/${props.debate.id}`;

/* navigator.share abre el menu del sistema; si no existe, se copia el enlace. */
const compartir = async () => {
  const datos = {
    title: props.debate.title,
    text: props.debate.cardSummary || props.debate.question || props.debate.title,
    url: enlace()
  };

  try {
    if (navigator.share) {
      await navigator.share(datos);
      emit("cerrar");
      return;
    }
  } catch (_) {
    // La persona ha cancelado el menu del sistema: no hay nada que avisar.
    emit("cerrar");
    return;
  }

  copiarEnlace();
};

const copiarEnlace = async () => {
  try {
    await navigator.clipboard.writeText(enlace());
    ui.success("Enlace copiado.");
  } catch (_) {
    ui.error("No hemos podido copiar el enlace.");
  }
  emit("cerrar");
};

const guardar = async () => {
  if (!exigeSesion("guardar debates")) return;

  try {
    const guardado = await favorites.toggle(props.debate.id);
    ui.success(guardado ? "Guardado en favoritos" : "Quitado de favoritos");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido guardar el favorito."));
  }
  emit("cerrar");
};

const abrirMotivos = () => {
  if (!exigeSesion("reportar")) return;
  pidiendoMotivo.value = true;
};

const reportar = async (motivo) => {
  try {
    await debatesService.report(props.debate.id, motivo);
    ui.success("Debate reportado. Gracias.");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar el reporte."));
  }
  pidiendoMotivo.value = false;
  emit("cerrar");
};

const cerrar = () => {
  pidiendoMotivo.value = false;
  emit("cerrar");
};
</script>

<template>
  <HojaInferior
    :abierta="abierta"
    :titulo="pidiendoMotivo ? 'Motivo del reporte' : ''"
    alto="auto"
    @cerrar="cerrar"
  >
    <template v-if="pidiendoMotivo">
      <button
        v-for="motivo in MOTIVOS"
        :key="motivo"
        type="button"
        class="hoja-opcion"
        @click="reportar(motivo)"
      >
        <span class="material-symbols-rounded">flag</span>
        {{ motivo }}
      </button>
    </template>

    <template v-else>
      <button type="button" class="hoja-opcion" @click="compartir">
        <span class="material-symbols-rounded">ios_share</span>
        Compartir
      </button>

      <button type="button" class="hoja-opcion" @click="copiarEnlace">
        <span class="material-symbols-rounded">link</span>
        Copiar enlace
      </button>

      <button type="button" class="hoja-opcion" @click="guardar">
        <span class="material-symbols-rounded">favorite</span>
        {{ favorites.isFavorite(debate.id) ? "Quitar de favoritos" : "Guardar" }}
      </button>

      <button type="button" class="hoja-opcion hoja-opcion-peligro" @click="abrirMotivos">
        <span class="material-symbols-rounded">flag</span>
        Reportar debate
      </button>
    </template>
  </HojaInferior>
</template>
