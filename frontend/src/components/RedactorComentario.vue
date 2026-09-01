<script setup>
import { nextTick, ref } from "vue";
import { useSesion } from "@/composables/useSesion";

/**
 * Caja para escribir un comentario. La usan la pagina del debate, donde va
 * anclada abajo, y la hoja de comentarios, donde va en su pie.
 */

defineProps({
  /** Comentario al que se responde, si lo hay. */
  respondiendoA: { type: Object, default: null },
  enviando: { type: Boolean, default: false },
  /** "fijo" se ancla sobre la barra inferior; "encaje" se queda donde esta. */
  modo: { type: String, default: "fijo" }
});

const emit = defineEmits(["enviar", "cancelar-respuesta"]);

const { auth, exigeSesion } = useSesion();

const texto = ref("");
const campo = ref(null);

const enviar = () => {
  if (!exigeSesion("comentar")) return;

  const contenido = texto.value.trim();
  if (!contenido) return;

  emit("enviar", contenido);
  texto.value = "";

  if (campo.value) campo.value.style.height = "auto";
};

/* El campo crece con el texto hasta el maximo que fija el CSS. */
const crecer = (evento) => {
  const el = evento.target;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const enfocar = async () => {
  await nextTick();
  campo.value?.focus();
};

defineExpose({ enfocar });
</script>

<template>
  <div>
    <div v-if="respondiendoA" class="composer-reply-hint" :class="{ 'en-encaje': modo === 'encaje' }">
      <span>Respondiendo a {{ respondiendoA.user?.username }}</span>
      <button type="button" class="btn btn-ghost btn-sm" @click="emit('cancelar-respuesta')">
        Cancelar
      </button>
    </div>

    <div class="composer" :class="{ 'en-encaje': modo === 'encaje' }">
      <textarea
        ref="campo"
        v-model="texto"
        rows="1"
        :placeholder="auth.isAuthenticated ? 'Escribe tu argumento…' : 'Entra para comentar'"
        aria-label="Escribe tu comentario"
        @input="crecer"
      />
      <button
        type="button"
        class="composer-send"
        aria-label="Publicar comentario"
        :disabled="auth.isAuthenticated && (!texto.trim() || enviando)"
        @click="enviar"
      >
        <span class="material-symbols-rounded">send</span>
      </button>
    </div>
  </div>
</template>
