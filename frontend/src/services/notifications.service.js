import { api } from "@/boot/axios";

export const notificationsService = {
  async list(limit = 20) {
    const { data } = await api.get("/api/notifications", { params: { limit } });
    return data;
  },
  async unreadCount() {
    const { data } = await api.get("/api/notifications/unread-count");
    return data?.unreadCount || 0;
  },
  async markAllRead() {
    const { data } = await api.post("/api/notifications/read-all");
    return data;
  }
};
