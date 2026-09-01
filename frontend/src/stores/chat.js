import { defineStore } from "pinia";
import { chatService } from "@/services";
import { wsClient } from "@/api/ws";

/**
 * Conversaciones y mensajes.
 *
 * Los mensajes se envian por HTTP (la respuesta trae el mensaje ya guardado) y
 * los que llegan del websocket se anaden si no estaban ya en la lista.
 */
export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    messagesByConversation: {},
    loading: false,
    loaded: false,
    listening: false
  }),

  getters: {
    unreadTotal: (state) =>
      state.conversations.reduce(
        (total, conversation) => total + Number(conversation.unreadCount || 0),
        0
      ),
    messagesOf: (state) => (conversationId) =>
      state.messagesByConversation[conversationId] || []
  },

  actions: {
    async loadConversations(force = false) {
      if (this.loaded && !force) return this.conversations;
      this.loading = true;
      try {
        this.conversations = await chatService.conversations();
        this.loaded = true;
        return this.conversations;
      } finally {
        this.loading = false;
      }
    },

    async loadMessages(conversationId, page = 1) {
      const messages = await chatService.messages(conversationId, page);
      // La API devuelve la pagina mas reciente primero; se pinta en orden temporal.
      const ordered = [...messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      this.messagesByConversation[conversationId] = ordered;
      this.markConversationRead(conversationId);
      return ordered;
    },

    async send(conversationId, content) {
      const message = await chatService.send(conversationId, content);
      this.appendMessage(message);
      return message;
    },

    appendMessage(message) {
      const list = this.messagesByConversation[message.conversationId] || [];
      if (list.some((existing) => existing.id === message.id)) return;

      this.messagesByConversation[message.conversationId] = [...list, message];

      const conversation = this.conversations.find(
        (item) => item.id === message.conversationId
      );
      if (conversation) {
        conversation.lastMessage = message;
      }
    },

    markConversationRead(conversationId) {
      const conversation = this.conversations.find((item) => item.id === conversationId);
      if (conversation) {
        conversation.unreadCount = 0;
      }
    },

    /** Escucha una sola vez los mensajes entrantes del websocket. */
    listen() {
      if (this.listening) return;
      this.listening = true;

      wsClient.on("chat_message", (payload) => {
        const message = payload.message || payload;
        if (!message?.conversationId) return;

        this.appendMessage(message);

        const conversation = this.conversations.find(
          (item) => item.id === message.conversationId
        );
        if (conversation) {
          conversation.unreadCount = Number(conversation.unreadCount || 0) + 1;
        } else {
          this.loadConversations(true).catch(() => {});
        }
      });
    },

    async openWith(userId) {
      const conversation = await chatService.openWith(userId);
      const existing = this.conversations.find((item) => item.id === conversation.id);
      if (!existing) {
        this.conversations = [conversation, ...this.conversations];
      }
      return conversation;
    },

    reset() {
      this.conversations = [];
      this.messagesByConversation = {};
      this.loaded = false;
    }
  }
});
