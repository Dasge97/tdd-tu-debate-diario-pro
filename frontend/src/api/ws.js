import { tokenStorage } from "@/api/client";

/**
 * Cliente del websocket de chat.
 *
 * El servidor (backend, comando app:websocket-server) autentica por el
 * parametro token de la URL y emite mensajes {type, ...}. Se reconecta con
 * espera creciente, igual que mobile/lib/core/websocket/ws_client.dart.
 */
class WsClient {
  constructor() {
    this.socket = null;
    this.handlers = new Map();
    this.shouldReconnect = false;
    this.retryAttempt = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
  }

  get url() {
    const configured = import.meta.env.VITE_WS_URL;
    if (configured) return configured;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//ws.${window.location.host.replace(/^www\./, "")}`;
  }

  connect() {
    const token = tokenStorage.getAccess();
    if (!token) return;

    this.shouldReconnect = true;
    this.open(token);
  }

  open(token) {
    try {
      this.socket = new WebSocket(`${this.url}?token=${encodeURIComponent(token)}`);
    } catch (_) {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.retryAttempt = 0;
      this.pingTimer = window.setInterval(() => this.send({ type: "ping" }), 30000);
    };

    this.socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (_) {
        return;
      }

      const listeners = this.handlers.get(data.type);
      if (listeners) {
        listeners.forEach((listener) => listener(data));
      }
    };

    this.socket.onclose = () => {
      this.clearPing();
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.socket?.close();
    };
  }

  scheduleReconnect() {
    if (!this.shouldReconnect) return;

    window.clearTimeout(this.reconnectTimer);
    this.retryAttempt = Math.min(this.retryAttempt + 1, 6);
    const delay = 2 ** (this.retryAttempt - 1) * 1000;

    this.reconnectTimer = window.setTimeout(() => {
      const token = tokenStorage.getAccess();
      if (token) this.open(token);
    }, delay);
  }

  clearPing() {
    window.clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  on(type, handler) {
    const listeners = this.handlers.get(type) || [];
    listeners.push(handler);
    this.handlers.set(type, listeners);

    return () => {
      this.handlers.set(
        type,
        (this.handlers.get(type) || []).filter((item) => item !== handler)
      );
    };
  }

  send(payload) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    window.clearTimeout(this.reconnectTimer);
    this.clearPing();
    this.socket?.close();
    this.socket = null;
  }
}

export const wsClient = new WsClient();
