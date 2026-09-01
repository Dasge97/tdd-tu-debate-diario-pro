import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

/**
 * Las pantallas de lectura son publicas, pero participar no lo es.
 *
 * exigeSesion() devuelve true si hay sesion. Si no la hay, avisa y lleva a la
 * pantalla de entrada guardando la direccion actual, para volver despues.
 *
 *   if (!exigeSesion("comentar")) return;
 */
export function useSesion() {
  const auth = useAuthStore();
  const ui = useUiStore();
  const router = useRouter();
  const route = useRoute();

  const exigeSesion = (accion = "participar") => {
    if (auth.isAuthenticated) return true;

    ui.notify(`Entra en tu cuenta para ${accion}.`);
    router.push({ name: "login", query: { destino: route.fullPath } });
    return false;
  };

  return { auth, exigeSesion };
}
