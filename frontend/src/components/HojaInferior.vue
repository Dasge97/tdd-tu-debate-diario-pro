<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

/**
 * Hoja que sube desde abajo y se superpone al contenido, como la de
 * comentarios de Instagram.
 *
 * Se cierra tocando el fondo, con la tecla Escape o arrastrandola hacia abajo.
 * En pantallas anchas se muestra centrada, como un dialogo.
 */

const props = defineProps({
  abierta: { type: Boolean, default: false },
  titulo: { type: String, default: "" },
  /** Alto de la hoja en movil, como parte de la pantalla. */
  alto: { type: String, default: "72dvh" }
});

const emit = defineEmits(["cerrar"]);

const panel = ref(null);
const arrastre = ref(0);
const arrastrando = ref(false);

/**
 * Con el teclado abierto, iOS encoge la ventana visible pero no la de
 * maquetado. Sin ajustar nada, la parte de abajo de la hoja queda tapada por
 * el teclado y aparecen huecos. visualViewport dice cuanto espacio queda.
 */
const altoVisible = ref(null);
const desplazamiento = ref(0);
const hayTeclado = ref(false);

const medirVentana = () => {
  const vv = window.visualViewport;
  if (!vv) return;

  altoVisible.value = vv.height;
  desplazamiento.value = vv.offsetTop;
  hayTeclado.value = window.innerHeight - vv.height > 120;
};

let inicioY = 0;
let scrollAlAbrir = 0;

/* Con la hoja abierta, el fondo no debe moverse. */
const bloquearFondo = () => {
  scrollAlAbrir = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollAlAbrir}px`;
  document.body.style.width = "100%";
};

const liberarFondo = () => {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollAlAbrir);
};

const alTeclado = (evento) => {
  if (evento.key === "Escape") emit("cerrar");
};

watch(
  () => props.abierta,
  (abierta) => {
    if (abierta) {
      arrastre.value = 0;
      bloquearFondo();
      window.addEventListener("keydown", alTeclado);
    } else {
      liberarFondo();
      window.removeEventListener("keydown", alTeclado);
    }
  }
);

onMounted(() => {
  medirVentana();
  window.visualViewport?.addEventListener("resize", medirVentana);
  window.visualViewport?.addEventListener("scroll", medirVentana);
});

onBeforeUnmount(() => {
  if (props.abierta) liberarFondo();
  window.removeEventListener("keydown", alTeclado);
  window.visualViewport?.removeEventListener("resize", medirVentana);
  window.visualViewport?.removeEventListener("scroll", medirVentana);
});

/* Arrastrar hacia abajo para cerrar. Solo cuenta si la lista esta arriba del
   todo; si no, el dedo esta desplazando el contenido. */
const alEmpezar = (evento) => {
  const lista = panel.value?.querySelector(".hoja-cuerpo");
  if (lista && lista.scrollTop > 0) return;

  inicioY = evento.touches[0].clientY;
  arrastrando.value = true;
};

const alMover = (evento) => {
  if (!arrastrando.value) return;

  const avance = evento.touches[0].clientY - inicioY;
  arrastre.value = Math.max(0, avance);
};

const alSoltar = () => {
  if (!arrastrando.value) return;

  arrastrando.value = false;

  // Un tercio de la altura basta para darlo por cerrado.
  if (arrastre.value > (panel.value?.offsetHeight ?? 400) / 3) {
    emit("cerrar");
  }

  arrastre.value = 0;
};
</script>

<template>
  <Teleport to="body">
    <Transition name="hoja">
      <div
        v-if="abierta"
        class="hoja-fondo"
        :style="
          altoVisible
            ? { height: `${altoVisible}px`, top: `${desplazamiento}px`, bottom: 'auto' }
            : {}
        "
        @click.self="emit('cerrar')"
      >
        <div
          ref="panel"
          class="hoja"
          role="dialog"
          aria-modal="true"
          :aria-label="titulo || 'Panel'"
          :class="{ 'con-teclado': hayTeclado }"
          :style="{
            '--hoja-alto': alto,
            transform: arrastre ? `translateY(${arrastre}px)` : '',
            transition: arrastrando ? 'none' : ''
          }"
        >
          <div
            class="hoja-asa"
            @touchstart.passive="alEmpezar"
            @touchmove.passive="alMover"
            @touchend="alSoltar"
          >
            <span />
          </div>

          <div v-if="titulo" class="hoja-cabecera">
            <h2 class="hoja-titulo">{{ titulo }}</h2>
            <button type="button" class="icon-btn" aria-label="Cerrar" @click="emit('cerrar')">
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="hoja-cuerpo">
            <slot />
          </div>

          <div v-if="$slots.pie" class="hoja-pie">
            <slot name="pie" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
