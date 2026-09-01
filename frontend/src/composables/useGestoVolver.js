import { onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";

/**
 * Volver atras deslizando desde el borde izquierdo.
 *
 * Instalada en la pantalla de inicio no hay boton de atras del navegador, asi
 * que sin este gesto solo queda la flecha de la cabecera. Safari en iOS ya trae
 * el gesto en su pestana normal, pero no en una aplicacion instalada.
 */

const BORDE = 28; // ancho de la zona sensible, en pixeles
const MINIMO = 70; // recorrido necesario para dar el gesto por hecho

export function useGestoVolver() {
  const router = useRouter();

  let inicioX = 0;
  let inicioY = 0;
  let activo = false;

  const alEmpezar = (evento) => {
    if (evento.touches.length !== 1) return;

    const toque = evento.touches[0];
    activo = toque.clientX <= BORDE;
    inicioX = toque.clientX;
    inicioY = toque.clientY;
  };

  const alTerminar = (evento) => {
    if (!activo) return;
    activo = false;

    const toque = evento.changedTouches[0];
    const avanceX = toque.clientX - inicioX;
    const avanceY = Math.abs(toque.clientY - inicioY);

    // Horizontal de verdad: si el dedo sube o baja mucho, es un scroll.
    if (avanceX > MINIMO && avanceY < avanceX) {
      if (window.history.state?.back) {
        router.back();
      }
    }
  };

  onMounted(() => {
    window.addEventListener("touchstart", alEmpezar, { passive: true });
    window.addEventListener("touchend", alTerminar, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener("touchstart", alEmpezar);
    window.removeEventListener("touchend", alTerminar);
  });
}
