import { api } from "@/boot/axios";

export const favoritesService = {
  async list() {
    const { data } = await api.get("/api/favorites");
    return data;
  },
  async add(debateId) {
    const { data } = await api.post(`/api/favorites/${debateId}`);
    return data;
  },
  async remove(debateId) {
    await api.delete(`/api/favorites/${debateId}`);
  }
};
