import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Carga la pagina siguiente cuando el final de la lista se acerca a la pantalla.
 *
 * alCargarMas debe devolver cuantos elementos ha traido. Si devuelve cero, se
 * entiende que no queda nada y se deja de pedir.
 */
export function useCargaContinua(alCargarMas) {
  const centinela = ref(null);
  const cargando = ref(false);
  const seAcabo = ref(false);

  let observador = null;

  const cargar = async () => {
    if (cargando.value || seAcabo.value) return;

    cargando.value = true;
    try {
      const traidos = await alCargarMas();
      if (!traidos) seAcabo.value = true;
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
        if (entradas[0].isIntersecting) cargar();
      },
      // Empieza a pedir antes de llegar al final, para que no se note el corte.
      { rootMargin: "400px 0px" }
    );

    observador.observe(centinela.value);
  });

  onBeforeUnmount(() => observador?.disconnect());

  return { centinela, cargando, seAcabo };
}
