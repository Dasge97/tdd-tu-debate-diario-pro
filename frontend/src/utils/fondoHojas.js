/**
 * Bloqueo del fondo mientras hay hojas abiertas.
 *
 * Una hoja puede abrir otra encima, como la de reportar sobre la de
 * comentarios. Por eso se cuentan las hojas abiertas y el fondo solo se libera
 * cuando se cierra la ultima; si no, al cerrar la de arriba la de abajo se
 * quedaria con el fondo suelto.
 *
 * El contador vive aqui, fuera de los componentes, para que sea el mismo para
 * todas las hojas.
 */

let abiertas = 0;
let scrollBloqueado = 0;

export const bloquearFondo = () => {
  if (abiertas === 0) {
    scrollBloqueado = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollBloqueado}px`;
    document.body.style.width = "100%";
  }

  abiertas += 1;
};

export const liberarFondo = () => {
  abiertas = Math.max(0, abiertas - 1);

  if (abiertas > 0) return;

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollBloqueado);
};
