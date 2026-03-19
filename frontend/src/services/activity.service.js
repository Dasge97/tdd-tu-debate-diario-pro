import { api } from "@/boot/axios";

export const activityService = {
  async getRecent(limit = 8) {
    const { data } = await api.get("/api/activity/recent", {
      params: { limit }
    });
    return data.items || [];
  }
};
