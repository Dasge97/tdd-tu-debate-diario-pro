import { api } from "@/api/client";
import { endpoints } from "@/api/endpoints";

/** Servicios de la API. Una funcion por endpoint, sin logica de presentacion. */

export const authService = {
  login: (email, password) =>
    api.post(endpoints.login, { email, password }).then((r) => r.data),
  register: (username, email, password) =>
    api.post(endpoints.register, { username, email, password }).then((r) => r.data),
  logout: (refreshToken) =>
    api.post(endpoints.logout, refreshToken ? { refreshToken } : {}).then((r) => r.data)
};

export const debatesService = {
  today: () => api.get(endpoints.debatesToday).then((r) => r.data),
  trending: () => api.get(endpoints.debatesTrending).then((r) => r.data),
  ticker: () => api.get(endpoints.debatesTicker).then((r) => r.data),
  topToday: () => api.get(endpoints.debatesTopToday).then((r) => r.data),
  topWeek: () => api.get(endpoints.debatesTopWeek).then((r) => r.data),
  recent: (page = 1, persona = null) =>
    api
      .get(endpoints.debatesRecent, { params: { page, ...(persona ? { persona } : {}) } })
      .then((r) => r.data),
  byId: (id) => api.get(endpoints.debateById(id)).then((r) => r.data),
  search: (q, page = 1) =>
    api.get(endpoints.debatesSearch, { params: { q, page } }).then((r) => r.data),
  propose: (payload) => api.post(endpoints.debates, payload).then((r) => r.data),
  report: (id, reason) => api.post(endpoints.debateReport(id), { reason })
};

export const participationService = {
  getPositions: (debateId) =>
    api.get(endpoints.debatePositions(debateId)).then((r) => r.data),
  setPosition: (debateId, position) =>
    api.post(endpoints.debatePositions(debateId), { position }).then((r) => r.data),
  getComments: (debateId) =>
    api.get(endpoints.debateComments(debateId)).then((r) => r.data),
  addComment: (debateId, content, parentId = null) =>
    api
      .post(endpoints.debateComments(debateId), {
        content,
        ...(parentId ? { parentId } : {})
      })
      .then((r) => r.data),
  voteComment: (commentId, value) =>
    api.post(endpoints.commentVote(commentId), { value }).then((r) => r.data),
  reportComment: (commentId, reason) =>
    api.post(endpoints.commentReport(commentId), { reason })
};

export const usersService = {
  me: () => api.get(endpoints.me).then((r) => r.data),
  updateMe: (payload) => api.put(endpoints.me, payload).then((r) => r.data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("avatar", file);
    return api
      .post(endpoints.myAvatar, form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      .then((r) => r.data);
  },
  favorites: (page = 1) =>
    api.get(endpoints.myFavorites, { params: { page } }).then((r) => r.data),
  protagonistas: (limit = 20) =>
    api.get(endpoints.protagonistas, { params: { limit } }).then((r) => r.data),
  byUsername: (username) =>
    api.get(endpoints.userByUsername(username)).then((r) => r.data)
};

export const personasService = {
  list: () => api.get(endpoints.personas).then((r) => r.data),
  debates: (username, page = 1) =>
    api.get(endpoints.personaDebates(username), { params: { page } }).then((r) => r.data)
};

export const socialService = {
  friends: () => api.get(endpoints.friends).then((r) => r.data),
  requestByUsername: (username) =>
    api.post(endpoints.friends, { username }).then((r) => r.data),
  requestById: (userId) => api.post(endpoints.friendById(userId)).then((r) => r.data),
  accept: (userId) => api.put(endpoints.friendAccept(userId)).then((r) => r.data),
  remove: (userId) => api.delete(endpoints.friendById(userId)).then((r) => r.data),
  addFavorite: (debateId) =>
    api.post(endpoints.favoriteDebate(debateId)).then((r) => r.data),
  removeFavorite: (debateId) =>
    api.delete(endpoints.favoriteDebate(debateId)).then((r) => r.data)
};

export const chatService = {
  conversations: () => api.get(endpoints.conversations).then((r) => r.data),
  openWith: (userId) =>
    api.post(endpoints.conversations, { userId }).then((r) => r.data),
  conversation: (id) => api.get(endpoints.conversationById(id)).then((r) => r.data),
  messages: (id, page = 1) =>
    api.get(endpoints.conversationMessages(id), { params: { page } }).then((r) => r.data),
  send: (id, content) =>
    api.post(endpoints.conversationMessages(id), { content }).then((r) => r.data)
};

export const notificationsService = {
  list: (unreadOnly = false) =>
    api.get(endpoints.notifications, { params: { unreadOnly } }).then((r) => r.data),
  markRead: (id) => api.put(endpoints.notificationRead(id)).then((r) => r.data),
  markAllRead: () => api.put(endpoints.notificationsReadAll).then((r) => r.data)
};
