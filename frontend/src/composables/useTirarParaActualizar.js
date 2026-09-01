import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Deslizar hacia abajo estando arriba del todo para recargar la lista.
 *
 * El navegador no lo hace solo: la pagina usa overscroll-behavior contain para
 * evitar la recarga del propio navegador, que sacaria a la persona de la
 * aplicacion. Asi que el gesto se implementa aqui.
 */

const UMBRAL = 70; // recorrido necesario para lanzar la recarga
const TOPE = 110; // hasta donde llega el indicador

export function useTirarParaActualizar(alRecargar) {
  const avance = ref(0);
  const recargando = ref(false);

  let inicioY = 0;
  let activo = false;

  const alEmpezar = (evento) => {
    if (recargando.value || window.scrollY > 0 || evento.touches.length !== 1) return;

    inicioY = evento.touches[0].clientY;
    activo = true;
  };

  const alMover = (evento) => {
    if (!activo) return;

    const recorrido = evento.touches[0].clientY - inicioY;

    if (recorrido <= 0 || window.scrollY > 0) {
      avance.value = 0;
      activo = false;
      return;
    }

    // Va frenando: cuanto mas tiras, menos avanza el indicador.
    avance.value = Math.min(TOPE, recorrido * 0.45);
  };

  const alSoltar = async () => {
    if (!activo) return;
    activo = false;

    if (avance.value < UMBRAL) {
      avance.value = 0;
      return;
    }

    recargando.value = true;
    avance.value = UMBRAL;

    try {
      await alRecargar();
    } finally {
      recargando.value = false;
      avance.value = 0;
    }
  };

  onMounted(() => {
    window.addEventListener("touchstart", alEmpezar, { passive: true });
    window.addEventListener("touchmove", alMover, { passive: true });
    window.addEventListener("touchend", alSoltar, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("touchstart", alEmpezar);
    window.removeEventListener("touchmove", alMover);
    window.removeEventListener("touchend", alSoltar);
  });

  return { avance, recargando };
}
