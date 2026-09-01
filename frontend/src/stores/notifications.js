import { defineStore } from "pinia";
import { notificationsService } from "@/services";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    loading: false,
    loaded: false
  }),

  getters: {
    unreadCount: (state) => state.items.filter((item) => !item.isRead).length
  },

  actions: {
    async load(force = false) {
      if (this.loaded && !force) return this.items;
      this.loading = true;
      try {
        this.items = await notificationsService.list();
        this.loaded = true;
        return this.items;
      } finally {
        this.loading = false;
      }
    },

    async markRead(id) {
      await notificationsService.markRead(id);
      const notification = this.items.find((item) => item.id === id);
      if (notification) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
      }
    },

    async markAllRead() {
      await notificationsService.markAllRead();
      this.items.forEach((item) => {
        item.isRead = true;
      });
    },

    reset() {
      this.items = [];
      this.loaded = false;
    }
  }
});
