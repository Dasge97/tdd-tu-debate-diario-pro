/**
 * Estado de la instalacion como aplicacion.
 *
 * El evento beforeinstallprompt solo se dispara una vez y hay que guardarlo
 * para poder abrir el dialogo del navegador mas tarde. Aqui se guarda en un
 * unico sitio, para que lo puedan usar tanto el aviso flotante como Ajustes.
 */

let eventoGuardado = null;

export const instalacion = {
  guardarEvento(evento) {
    eventoGuardado = evento;
  },

  /** true si el navegador puede abrir el dialogo de instalacion. */
  sePuedeInstalar() {
    return eventoGuardado !== null;
  },

  /**
   * Abre el dialogo del navegador. Devuelve true si la persona acepta,
   * false si la rechaza, y null si el navegador no ofrece el dialogo.
   */
  async lanzarDialogo() {
    if (!eventoGuardado) return null;

    eventoGuardado.prompt();
    const { outcome } = await eventoGuardado.userChoice;
    eventoGuardado = null;

    return outcome === "accepted";
  },

  /** true si la pagina ya se esta viendo como aplicacion instalada. */
  yaInstalada() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  },

  esIos() {
    const ua = window.navigator.userAgent;
    // iPadOS se identifica como Mac, pero admite pantalla tactil.
    const esIpadNuevo = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || esIpadNuevo;
  },

  /**
   * En iOS solo Safari puede anadir a la pantalla de inicio. Chrome, Firefox y
   * Edge en iPhone usan el motor de Safari pero no ofrecen la opcion.
   */
  esSafari() {
    const ua = window.navigator.userAgent;
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }
};
