/**
 * Pila de hojas abiertas.
 *
 * Una hoja puede abrir otra encima, como la de reportar sobre la de
 * comentarios. Hacen falta dos cosas para que se comporten bien:
 *
 * - El fondo solo se libera al cerrarse la ultima. Si no, al cerrar la de
 *   arriba la de abajo se quedaria con la pagina moviendose por detras.
 * - La tecla Escape solo cierra la de arriba, no todas a la vez.
 *
 * La pila vive aqui, fuera de los componentes, para que sea la misma para
 * todas las hojas.
 */

const pila = [];
let scrollBloqueado = 0;

/** Apila una hoja y bloquea el fondo si es la primera. Devuelve su marca. */
export const bloquearFondo = () => {
  if (pila.length === 0) {
    scrollBloqueado = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollBloqueado}px`;
    document.body.style.width = "100%";
  }

  const marca = Symbol("hoja");
  pila.push(marca);
  return marca;
};

/** Saca una hoja de la pila y suelta el fondo si no queda ninguna. */
export const liberarFondo = (marca) => {
  const posicion = pila.lastIndexOf(marca);
  if (posicion !== -1) pila.splice(posicion, 1);

  if (pila.length > 0) return;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollBloqueado);
};

/** true si la hoja es la que esta encima de todas. */
export const esLaDeArriba = (marca) => pila[pila.length - 1] === marca;
