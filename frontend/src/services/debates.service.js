import { api } from "@/boot/axios";

export const debatesService = {
  async getToday() {
    const { data } = await api.get("/api/debates/today");
    return data;
  },
  async getById(id) {
    const { data } = await api.get(`/api/debates/${id}`);
    return data;
  },
  async getComments(debateId) {
    const { data } = await api.get(`/api/comments/${debateId}`);
    return data;
  },
  async postComment(payload) {
    const { data } = await api.post("/api/comments", payload);
    return data;
  },
  async voteComment(commentId, value = 1) {
    const { data } = await api.post(`/api/comments/${commentId}/vote`, { value });
    return data;
  },
  async postPosition(payload) {
    const { data } = await api.post("/api/positions", payload);
    return data;
  },
  async search(params) {
    const { data } = await api.get("/api/debates/search", { params });
    return data;
  },
  async getTrending(limit = 10) {
    const { data } = await api.get("/api/debates/trending", { params: { limit } });
    return data;
  },
  async getCategories() {
    const { data } = await api.get("/api/debates/categories");
    return data;
  },
  async createProposal(payload) {
    const { data } = await api.post("/api/debates/proposals", payload);
    return data;
  }
};
