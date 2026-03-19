import { defineStore } from "pinia";
import { activityService } from "@/services/activity.service";

export const useActivityStore = defineStore("activity", {
  state: () => ({
    items: [],
    loading: false,
    error: ""
  }),
  actions: {
    async fetchRecent(limit = 8) {
      this.loading = true;
      this.error = "";

      try {
        this.items = await activityService.getRecent(limit);
      } catch (error) {
        this.items = [];
        this.error = error?.response?.data?.error || "No se pudo cargar la actividad reciente.";
      } finally {
        this.loading = false;
      }
    }
  }
});
