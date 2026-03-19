import { api } from "@/boot/axios";

export const adminService = {
  async getOverview() {
    const { data } = await api.get("/api/admin/overview");
    return data;
  },
  async runDailyCycle(payload = {}) {
    const { data } = await api.post("/api/admin/daily-cycle/run", payload);
    return data;
  },
  async getGenerationJob(jobId) {
    const { data } = await api.get(`/generation/jobs/${jobId}`);
    return data;
  },
  async getActivity(limit = 12) {
    const { data } = await api.get("/api/admin/activity", { params: { limit } });
    return data;
  },
  async getUsers(params) {
    const { data } = await api.get("/api/admin/users", { params });
    return data;
  },
  async updateUser(userId, payload) {
    const { data } = await api.patch(`/api/admin/users/${userId}`, payload);
    return data;
  },
  async getDebates(params) {
    const { data } = await api.get("/api/admin/debates", { params });
    return data;
  },
  async updateDebate(debateId, payload) {
    const { data } = await api.patch(`/api/admin/debates/${debateId}`, payload);
    return data;
  },
  async deleteDebate(debateId) {
    await api.delete(`/api/admin/debates/${debateId}`);
  },
  async getComments(params) {
    const { data } = await api.get("/api/admin/comments", { params });
    return data;
  },
  async updateComment(commentId, payload) {
    const { data } = await api.patch(`/api/admin/comments/${commentId}`, payload);
    return data;
  },
  async deleteComment(commentId) {
    await api.delete(`/api/admin/comments/${commentId}`);
  },
  async getConversations(params) {
    const { data } = await api.get("/api/admin/conversations", { params });
    return data;
  },
  async getNotifications(params) {
    const { data } = await api.get("/api/admin/notifications", { params });
    return data;
  },
  async getAuditLogs(params) {
    const { data } = await api.get("/api/admin/audit-logs", { params });
    return data;
  }
};
