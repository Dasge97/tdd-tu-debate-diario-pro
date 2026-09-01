<script setup>
import { ref, watch } from "vue";
import HojaInferior from "@/components/HojaInferior.vue";
import ListaComentarios from "@/components/ListaComentarios.vue";
import RedactorComentario from "@/components/RedactorComentario.vue";
import { participationService } from "@/services";
import { useUiStore } from "@/stores/ui";
import { errorMessage } from "@/api/client";

/**
 * Comentarios de un debate sin salir de la lista, como en Instagram.
 * Se abre desde la tarjeta y se cierra volviendo al mismo sitio.
 */

const props = defineProps({
  abierta: { type: Boolean, default: false },
  debateId: { type: [String, Number], required: true }
});

const emit = defineEmits(["cerrar", "comentado"]);

const ui = useUiStore();

const comentarios = ref([]);
const cargando = ref(false);
const enviando = ref(false);
const respondiendoA = ref(null);
const redactor = ref(null);

const total = () =>
  comentarios.value.reduce((suma, c) => suma + 1 + (c.replies?.length || 0), 0);

const cargar = async () => {
  cargando.value = true;
  try {
    comentarios.value = await participationService.getComments(props.debateId);
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido cargar los comentarios."));
  } finally {
    cargando.value = false;
  }
};

watch(
  () => props.abierta,
  (abierta) => {
    if (abierta) {
      respondiendoA.value = null;
      cargar();
    }
  }
);

const responder = async (comentario) => {
  respondiendoA.value = comentario;
  redactor.value?.enfocar();
};

const enviar = async (contenido) => {
  enviando.value = true;
  try {
    await participationService.addComment(
      props.debateId,
      contenido,
      respondiendoA.value?.id ?? null
    );
    respondiendoA.value = null;
    await cargar();
    emit("comentado", total());
  } catch (error) {
    ui.error(errorMessage(error, "No hemos podido publicar tu comentario."));
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <HojaInferior
    :abierta="abierta"
    :titulo="cargando ? 'Comentarios' : `Comentarios · ${total()}`"
    alto="78dvh"
    @cerrar="emit('cerrar')"
  >
    <ListaComentarios
      :comentarios="comentarios"
      :cargando="cargando"
      @responder="responder"
    />

    <template #pie>
      <RedactorComentario
        ref="redactor"
        modo="encaje"
        :respondiendo-a="respondiendoA"
        :enviando="enviando"
        @enviar="enviar"
        @cancelar-respuesta="respondiendoA = null"
      />
    </template>
  </HojaInferior>
</template>
