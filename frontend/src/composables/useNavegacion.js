import { ref } from "vue";

/**
 * Direccion de la ultima navegacion, para elegir la animacion.
 *
 * Al entrar en una pantalla, la nueva llega desde la derecha. Al volver, se va
 * hacia la derecha y la anterior reaparece por la izquierda, como en una app.
 */

export const direccion = ref("adelante");

/** Profundidad de cada ruta: cuanto mas larga, mas adentro esta. */
const nivel = (ruta) => {
  if (ruta.name === "home") return 0;
  return ruta.fullPath.split("/").filter(Boolean).length;
};

export const calcularDireccion = (hacia, desde) => {
  // Al pulsar atras del navegador, el historial retrocede.
  if (window.history.state?.forward === desde.fullPath) {
    return "atras";
  }

  return nivel(hacia) < nivel(desde) ? "atras" : "adelante";
};
