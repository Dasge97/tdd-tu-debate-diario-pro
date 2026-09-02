<script setup>
import { ref } from "vue";
import HojaInferior from "@/components/HojaInferior.vue";
import { MOTIVOS_REPORTE } from "@/utils/reportes";
import { debatesService, participationService } from "@/services";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

/**
 * Pregunta el motivo antes de enviar un reporte.
 *
 * Sin este paso, un toque por error mandaba el reporte directamente.
 */
const props = defineProps({
  abierta: { type: Boolean, default: false },
  /** "debate" o "comentario". */
  tipo: { type: String, required: true },
  id: { type: [String, Number], required: true }
});

const emit = defineEmits(["cerrar"]);

const ui = useUiStore();
const enviando = ref(false);

const enviar = async (motivo) => {
  if (enviando.value) return;

  enviando.value = true;
  try {
    if (props.tipo === "debate") {
      await debatesService.report(props.id, motivo);
    } else {
      await participationService.reportComment(props.id, motivo);
    }
    ui.success("Gracias. Lo revisaremos.");
    emit("cerrar");
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido enviar el reporte."));
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <HojaInferior
    :abierta="abierta"
    :titulo="tipo === 'debate' ? 'Reportar debate' : 'Reportar comentario'"
    alto="auto"
    @cerrar="emit('cerrar')"
  >
    <p class="text-muted" style="margin: 0 0 8px; font-size: 0.88rem">
      Elige el motivo. Lo revisará una persona del equipo.
    </p>

    <button
      v-for="motivo in MOTIVOS_REPORTE"
      :key="motivo.valor"
      type="button"
      class="hoja-opcion"
      :disabled="enviando"
      @click="enviar(motivo.valor)"
    >
      <span class="material-symbols-rounded">{{ motivo.icono }}</span>
      {{ motivo.valor }}
    </button>
  </HojaInferior>
</template>
