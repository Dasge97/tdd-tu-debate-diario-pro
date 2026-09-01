import { defineStore } from "pinia";

let nextId = 1;

/** Avisos flotantes y estado de conexion. */
export const useUiStore = defineStore("ui", {
  state: () => ({
    toasts: [],
    online: navigator.onLine
  }),

  actions: {
    notify(message, tone = "default", timeout = 3200) {
      const id = nextId++;
      this.toasts.push({ id, message, tone });
      window.setTimeout(() => this.dismiss(id), timeout);
      return id;
    },

    success(message) {
      return this.notify(message, "success");
    },

    error(message) {
      return this.notify(message, "error", 4200);
    },

    dismiss(id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    },

    watchConnection() {
      window.addEventListener("online", () => {
        this.online = true;
      });
      window.addEventListener("offline", () => {
        this.online = false;
      });
    }
  }
});
