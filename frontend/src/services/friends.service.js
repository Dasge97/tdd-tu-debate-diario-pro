import { api } from "@/boot/axios";

export const friendsService = {
  async list() {
    const { data } = await api.get("/api/friends");
    return data;
  },
  async listRequests() {
    const { data } = await api.get("/api/friends/requests");
    return data;
  },
  async getStatus(userId) {
    const { data } = await api.get(`/api/friends/status/${userId}`);
    return data;
  },
  async sendRequest(userId) {
    const { data } = await api.post("/api/friends/request", { userId });
    return data;
  },
  async accept(userId) {
    const { data } = await api.post(`/api/friends/${userId}/accept`);
    return data;
  },
  async reject(userId) {
    const { data } = await api.post(`/api/friends/${userId}/reject`);
    return data;
  },
  async remove(userId) {
    await api.delete(`/api/friends/${userId}`);
  }
};
