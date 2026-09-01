import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Carga la pagina siguiente cuando el final de la lista se acerca a la pantalla.
 *
 * alCargarMas devuelve cuantos elementos ha traido. Si devuelve cero, se
 * entiende que no queda nada y se deja de pedir. Si devuelve null significa
 * que todavia no se puede pedir, porque la primera carga sigue en marcha; en
 * ese caso se reintenta mientras el final de la lista siga a la vista.
 */
export function useCargaContinua(alCargarMas) {
  const centinela = ref(null);
  const cargando = ref(false);
  const seAcabo = ref(false);

  let observador = null;
  let visible = false;
  let reintento = null;

  const cargar = async () => {
    if (cargando.value || seAcabo.value) return;

    cargando.value = true;
    try {
      const traidos = await alCargarMas();

      if (traidos === null) {
        // La lista aun no esta lista: se vuelve a mirar en un momento.
        if (visible) {
          reintento = window.setTimeout(cargar, 400);
        }
        return;
      }

      if (!traidos) {
        seAcabo.value = true;
        return;
      }

      // Si el final sigue a la vista tras anadir, se pide otra tanda.
      if (visible) {
        reintento = window.setTimeout(cargar, 150);
      }
    } catch (_) {
      seAcabo.value = true;
    } finally {
      cargando.value = false;
    }
  };

  onMounted(() => {
    if (!centinela.value) return;

    observador = new IntersectionObserver(
      (entradas) => {
        visible = entradas[0].isIntersecting;
        if (visible) cargar();
      },
      // Empieza a pedir antes de llegar al final, para que no se note el corte.
      { rootMargin: "400px 0px" }
    );

    observador.observe(centinela.value);
  });

  onBeforeUnmount(() => {
    observador?.disconnect();
    window.clearTimeout(reintento);
  });

  return { centinela, cargando, seAcabo };
}
