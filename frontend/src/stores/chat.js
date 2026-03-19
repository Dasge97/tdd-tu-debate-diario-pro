import { defineStore } from "pinia";
import { chatService } from "@/services/chat.service";
import { useNotificationsStore } from "@/stores/notifications";
import { useToastStore } from "@/stores/toast";

const normalizeMessage = (message) => ({
  id: Number(message.id),
  conversationId: Number(message.conversationId),
  senderId: Number(message.senderId),
  senderUsername: message.senderUsername,
  senderAvatarUrl: message.senderAvatarUrl || "",
  content: message.content,
  createdAt: message.createdAt
});

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    activeConversationId: null,
    messagesByConversation: {},
    connected: false,
    connecting: false,
    socket: null,
    error: "",
    panelOpen: false,
    panelMinimized: false,
    onlineByUserId: {},
    typingByConversationId: {},
    reconnectTimer: null
  }),
  getters: {
    activeConversation(state) {
      return state.conversations.find((c) => Number(c.id) === Number(state.activeConversationId)) || null;
    },
    activeMessages(state) {
      return state.messagesByConversation[state.activeConversationId] || [];
    }
  },
  actions: {
    reset() {
      if (this.socket) {
        this.socket.close();
      }
      this.conversations = [];
      this.activeConversationId = null;
      this.messagesByConversation = {};
      this.connected = false;
      this.connecting = false;
      this.socket = null;
      this.error = "";
      this.panelOpen = false;
      this.panelMinimized = false;
      this.onlineByUserId = {};
      this.typingByConversationId = {};
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    },

    async initSession() {
      this.error = "";
      await this.fetchConversations();
      this.connectSocket();
    },

    connectSocket() {
      const toastStore = useToastStore();
      const token = localStorage.getItem("tdd_token");
      if (!token || this.socket) return;

      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const parsed = new URL(apiBase, window.location.origin);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      const wsOrigin = `${wsProtocol}//${parsed.host}`;
      const url = `${wsOrigin}/ws/chat?token=${encodeURIComponent(token)}`;

      this.connecting = true;
      const socket = new WebSocket(url);

      socket.onopen = () => {
        this.connected = true;
        this.connecting = false;
      };

      socket.onclose = () => {
        this.connected = false;
        this.connecting = false;
        this.socket = null;
        const stillLoggedIn = Boolean(localStorage.getItem("tdd_token"));
        if (stillLoggedIn) {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectSocket();
          }, 1200);
        }
      };

      socket.onerror = () => {
        this.error = "Error de conexión del chat.";
        toastStore.error(this.error);
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data || "{}");
        if (payload.type === "connected") {
          const friendIds = Array.isArray(payload.onlineFriendIds) ? payload.onlineFriendIds : [];
          const map = {};
          for (const friendId of friendIds) {
            map[Number(friendId)] = true;
          }
          this.onlineByUserId = map;
          return;
        }

        if (payload.type === "friend:presence") {
          this.onlineByUserId = {
            ...this.onlineByUserId,
            [Number(payload.userId)]: Boolean(payload.isOnline)
          };
          return;
        }

        if (payload.type === "typing") {
          const key = Number(payload.conversationId);
          this.typingByConversationId = {
            ...this.typingByConversationId,
            [key]: Boolean(payload.isTyping)
          };
          return;
        }

        if (payload.type === "new_message" && payload.message) {
          const msg = normalizeMessage(payload.message);
          const key = Number(msg.conversationId);
          const list = this.messagesByConversation[key] || [];
          if (!list.some((m) => Number(m.id) === Number(msg.id))) {
            this.messagesByConversation[key] = [...list, msg];
          }
          this.fetchConversations();
          return;
        }

        if (payload.type === "notification:new" && payload.notification) {
          const notificationsStore = useNotificationsStore();
          notificationsStore.pushIncoming(payload.notification);
        }
      };

      this.socket = socket;
    },

    async fetchConversations() {
      this.conversations = await chatService.listConversations();
      if (!this.activeConversationId && this.conversations.length > 0) {
        this.activeConversationId = Number(this.conversations[0].id);
      }
    },

    async openConversationByUser(userId) {
      const conversation = await chatService.openConversation(userId);
      await this.fetchConversations();
      this.activeConversationId = Number(conversation.id);
      this.panelOpen = true;
      this.panelMinimized = false;
      await this.fetchMessages(conversation.id);
      return conversation;
    },

    async fetchMessages(conversationId) {
      const key = Number(conversationId);
      const messages = await chatService.listMessages(key, { limit: 50 });
      this.messagesByConversation[key] = messages.map(normalizeMessage);
      this.activeConversationId = key;
      await this.markActiveAsRead();
    },

    async sendMessage(content, userId) {
      const text = String(content || "").trim();
      if (!text) return;
      if (!this.activeConversationId) return;

      if (this.socket && this.connected) {
        this.socket.send(
          JSON.stringify({
            type: "send_message",
            conversationId: this.activeConversationId,
            content: text
          })
        );
      } else {
        const created = await chatService.sendMessage(this.activeConversationId, text);
        const key = Number(this.activeConversationId);
        const list = this.messagesByConversation[key] || [];
        this.messagesByConversation[key] = [...list, normalizeMessage(created)];
      }
      await this.fetchConversations();
      await this.markActiveAsRead(userId);
      this.sendTyping(false);
    },

    async markActiveAsRead(userId = null) {
      if (!this.activeConversationId) return;
      const key = Number(this.activeConversationId);
      const list = this.messagesByConversation[key] || [];
      const last = list[list.length - 1];
      if (!last) return;
      await chatService.markRead(key, last.id);
      this.conversations = this.conversations.map((conversation) =>
        Number(conversation.id) === key ? { ...conversation, unreadCount: 0 } : conversation
      );

      if (this.socket && this.connected) {
        this.socket.send(
          JSON.stringify({
            type: "mark_read",
            conversationId: key,
            lastMessageId: last.id,
            userId
          })
        );
      }
    },

    sendTyping(isTyping) {
      if (!this.socket || !this.connected || !this.activeConversationId) return;
      this.socket.send(
        JSON.stringify({
          type: "typing",
          conversationId: this.activeConversationId,
          isTyping: Boolean(isTyping)
        })
      );
    }
  }
});
