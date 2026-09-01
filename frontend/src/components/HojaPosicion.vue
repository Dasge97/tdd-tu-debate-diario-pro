<script setup>
import HojaInferior from "@/components/HojaInferior.vue";
import PositionBar from "@/components/PositionBar.vue";
import { useDebatesStore } from "@/stores/debates";
import { useUiStore } from "@/stores/ui";
import { useSesion } from "@/composables/useSesion";
import { errorMessage } from "@/api/client";
import { computed, ref } from "vue";

/** Fijar la posicion sin entrar al debate. */

const props = defineProps({
  abierta: { type: Boolean, default: false },
  debateId: { type: [String, Number], required: true },
  titulo: { type: String, default: "" }
});

const emit = defineEmits(["cerrar"]);

const debates = useDebatesStore();
const ui = useUiStore();
const { exigeSesion } = useSesion();

const CLAVE = "tdd.myPositions";

const leerPosiciones = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}");
  } catch (_) {
    return {};
  }
};

const miPosicion = ref(leerPosiciones()[props.debateId] || null);
const guardando = ref(false);

const porcentajes = computed(() => debates.percentagesFor(props.debateId));

const opciones = [
  { valor: "support", texto: "A favor", icono: "thumb_up", clase: "is-active-support" },
  { valor: "neutral", texto: "Neutral", icono: "drag_handle", clase: "is-active-neutral" },
  { valor: "oppose", texto: "En contra", icono: "thumb_down", clase: "is-active-oppose" }
];

const elegir = async (valor) => {
  if (!exigeSesion("fijar tu posición")) return;

  const anterior = miPosicion.value;
  miPosicion.value = valor;
  guardando.value = true;

  try {
    await debates.setPosition(props.debateId, valor);

    const guardadas = leerPosiciones();
    guardadas[props.debateId] = valor;
    localStorage.setItem(CLAVE, JSON.stringify(guardadas));

    ui.success("Posición registrada.");
    emit("cerrar");
  } catch (error) {
    miPosicion.value = anterior;
    ui.error(errorMessage(error, "No hemos podido registrar tu posición."));
  } finally {
    guardando.value = false;
  }
};
</script>

<template>
  <HojaInferior
    :abierta="abierta"
    titulo="Tu posición"
    alto="auto"
    @cerrar="emit('cerrar')"
  >
    <p v-if="titulo" class="posicion-debate">{{ titulo }}</p>

    <PositionBar :percentages="porcentajes" />

    <div class="position-picker" style="margin-top: 16px">
      <button
        v-for="opcion in opciones"
        :key="opcion.valor"
        type="button"
        class="position-btn"
        :class="{ [opcion.clase]: miPosicion === opcion.valor }"
        :disabled="guardando"
        @click="elegir(opcion.valor)"
      >
        <span class="material-symbols-rounded">{{ opcion.icono }}</span>
        {{ opcion.texto }}
      </button>
    </div>

    <p class="text-muted" style="margin: 14px 0 0; font-size: 0.84rem">
      Puedes cambiarla cuando quieras.
    </p>
  </HojaInferior>
</template>

<style scoped>
.posicion-debate {
  margin: 0 0 16px;
  font-family: "Bitter", Georgia, serif;
  font-size: 1rem;
  line-height: 1.35;
}
</style>
