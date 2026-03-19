import { defineStore } from "pinia";

let toastId = 1;

export const useToastStore = defineStore("toast", {
  state: () => ({
    items: []
  }),
  actions: {
    show({ message, type = "info", title = "", timeout = 3200 }) {
      const id = toastId++;
      const item = {
        id,
        title,
        message,
        type,
        timeout
      };
      this.items = [...this.items, item];

      if (timeout > 0) {
        window.setTimeout(() => {
          this.dismiss(id);
        }, timeout);
      }

      return id;
    },
    success(message, title = "Correcto") {
      return this.show({ message, title, type: "success" });
    },
    error(message, title = "Error") {
      return this.show({ message, title, type: "error", timeout: 4200 });
    },
    info(message, title = "Información") {
      return this.show({ message, title, type: "info" });
    },
    warning(message, title = "Atención") {
      return this.show({ message, title, type: "warning", timeout: 3800 });
    },
    dismiss(id) {
      this.items = this.items.filter((item) => Number(item.id) !== Number(id));
    },
    clear() {
      this.items = [];
    }
  }
});
