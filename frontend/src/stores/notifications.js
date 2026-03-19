import { defineStore } from "pinia";
import { notificationsService } from "@/services/notifications.service";

export const useNotificationsStore = defineStore("notifications", {
  state: () => ({
    items: [],
    unreadCount: 0,
    loading: false
  }),
  actions: {
    reset() {
      this.items = [];
      this.unreadCount = 0;
      this.loading = false;
    },
    async fetchList(limit = 20) {
      this.loading = true;
      try {
        this.items = await notificationsService.list(limit);
      } finally {
        this.loading = false;
      }
    },
    async fetchUnreadCount() {
      this.unreadCount = await notificationsService.unreadCount();
    },
    pushIncoming(notification) {
      if (!notification?.id) return;
      const exists = this.items.some((item) => Number(item.id) === Number(notification.id));
      if (!exists) {
        this.items = [notification, ...this.items].slice(0, 50);
      }
      this.unreadCount += 1;
    },
    async markAllRead() {
      await notificationsService.markAllRead();
      this.unreadCount = 0;
      this.items = this.items.map((item) => ({ ...item, isRead: true }));
    }
  }
});
