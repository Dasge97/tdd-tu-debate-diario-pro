import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "@/App.vue";
import { router } from "@/router";
import { setSessionExpiredHandler } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { wsClient } from "@/api/ws";
import { instalacion } from "@/utils/instalacion";
import "@/styles/app.scss";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const auth = useAuthStore(pinia);
const ui = useUiStore(pinia);

ui.watchConnection();

/* El navegador dispara beforeinstallprompt una sola vez. Se captura aqui, no en
   el aviso flotante, para que Ajustes pueda abrir el dialogo aunque el aviso
   este cerrado. */
window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  instalacion.guardarEvento(evento);
});

/* Si el refresco de token falla, se cierra la sesion y se vuelve a la entrada. */
setSessionExpiredHandler(() => {
  auth.clearSession();
  wsClient.disconnect();
  ui.error("Tu sesión ha caducado. Vuelve a entrar.");
  router.replace({ name: "login" });
});

app.mount("#app");
