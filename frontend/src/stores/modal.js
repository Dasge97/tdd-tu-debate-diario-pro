import { defineStore } from "pinia";

export const useModalStore = defineStore("modal", {
  state: () => ({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Aceptar",
    cancelLabel: "Cancelar",
    variant: "confirm",
    persistent: false,
    _resolver: null
  }),
  actions: {
    open(config = {}) {
      this.isOpen = true;
      this.title = config.title || "Confirmar";
      this.message = config.message || "";
      this.confirmLabel = config.confirmLabel || "Aceptar";
      this.cancelLabel = config.cancelLabel || "Cancelar";
      this.variant = config.variant || "confirm";
      this.persistent = Boolean(config.persistent);

      return new Promise((resolve) => {
        this._resolver = resolve;
      });
    },
    confirm(config = {}) {
      return this.open({
        variant: "confirm",
        ...config
      });
    },
    alert(config = {}) {
      return this.open({
        variant: "alert",
        cancelLabel: "",
        ...config
      });
    },
    resolve(value) {
      if (typeof this._resolver === "function") {
        this._resolver(value);
      }
      this.reset();
    },
    reset() {
      this.isOpen = false;
      this.title = "";
      this.message = "";
      this.confirmLabel = "Aceptar";
      this.cancelLabel = "Cancelar";
      this.variant = "confirm";
      this.persistent = false;
      this._resolver = null;
    }
  }
});
