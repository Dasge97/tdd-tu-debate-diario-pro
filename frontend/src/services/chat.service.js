import { api } from "@/boot/axios";

export const chatService = {
  async listConversations() {
    const { data } = await api.get("/api/chat/conversations");
    return data;
  },
  async openConversation(userId) {
    const { data } = await api.post("/api/chat/conversations", { userId });
    return data;
  },
  async listMessages(conversationId, { beforeId, limit = 40 } = {}) {
    const { data } = await api.get(`/api/chat/conversations/${conversationId}/messages`, {
      params: {
        beforeId: beforeId || undefined,
        limit
      }
    });
    return data;
  },
  async sendMessage(conversationId, content) {
    const { data } = await api.post("/api/chat/messages", { conversationId, content });
    return data;
  },
  async markRead(conversationId, lastMessageId = null) {
    const { data } = await api.post(`/api/chat/conversations/${conversationId}/read`, {
      lastMessageId
    });
    return data;
  }
};
