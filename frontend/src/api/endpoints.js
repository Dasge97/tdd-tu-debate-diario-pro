/** Rutas de la API Symfony. Espejo de mobile/lib/core/api/api_endpoints.dart. */

export const endpoints = {
  // Auth
  register: "/api/v1/auth/register",
  login: "/api/v1/auth/login",
  refresh: "/api/v1/auth/refresh",
  logout: "/api/v1/auth/logout",

  // Debates
  debates: "/api/v1/debates",
  debatesToday: "/api/v1/debates/today",
  debatesTrending: "/api/v1/debates/trending",
  debatesSearch: "/api/v1/debates/search",
  debatesTicker: "/api/v1/debates/ticker",
  debatesTopToday: "/api/v1/debates/top-today",
  debatesTopWeek: "/api/v1/debates/top-week",
  debatesRecent: "/api/v1/debates/recent",
  debateById: (id) => `/api/v1/debates/${id}`,
  debatePositions: (id) => `/api/v1/debates/${id}/positions`,
  debateComments: (id) => `/api/v1/debates/${id}/comments`,
  commentVote: (id) => `/api/v1/comments/${id}/vote`,
  debateReport: (id) => `/api/v1/debates/${id}/report`,
  commentReport: (id) => `/api/v1/comments/${id}/report`,

  // Usuarios
  me: "/api/v1/users/me",
  myAvatar: "/api/v1/users/me/avatar",
  myFavorites: "/api/v1/users/me/favorites",
  protagonistas: "/api/v1/users/protagonistas",
  userByUsername: (username) => `/api/v1/users/${encodeURIComponent(username)}`,

  // Personajes
  personas: "/api/v1/personas",
  personaDebates: (username) =>
    `/api/v1/personas/${encodeURIComponent(username)}/debates`,

  // Social
  friends: "/api/v1/friends",
  friendById: (userId) => `/api/v1/friends/${userId}`,
  friendAccept: (userId) => `/api/v1/friends/${userId}/accept`,
  favoriteDebate: (debateId) => `/api/v1/favorites/${debateId}`,

  // Chat
  conversations: "/api/v1/chat/conversations",
  conversationById: (id) => `/api/v1/chat/conversations/${id}`,
  conversationMessages: (id) => `/api/v1/chat/conversations/${id}/messages`,

  // Notificaciones
  notifications: "/api/v1/notifications",
  notificationRead: (id) => `/api/v1/notifications/${id}/read`,
  notificationsReadAll: "/api/v1/notifications/read-all"
};
