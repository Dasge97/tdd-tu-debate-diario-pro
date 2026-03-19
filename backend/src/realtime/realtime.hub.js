const userConnections = new Map();

export function registerUserConnection(userId, ws) {
  const key = Number(userId);
  if (!userConnections.has(key)) {
    userConnections.set(key, new Set());
  }
  userConnections.get(key).add(ws);
}

export function unregisterUserConnection(userId, ws) {
  const key = Number(userId);
  if (!userConnections.has(key)) return;
  const set = userConnections.get(key);
  set.delete(ws);
  if (set.size === 0) userConnections.delete(key);
}

export function isUserOnline(userId) {
  const set = userConnections.get(Number(userId));
  return Boolean(set && set.size > 0);
}

export function emitToUser(userId, payload) {
  const set = userConnections.get(Number(userId));
  if (!set || set.size === 0) return;
  const encoded = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(encoded);
    }
  }
}

export function emitToUsers(userIds, payload) {
  for (const userId of userIds) {
    emitToUser(userId, payload);
  }
}

export function getOnlineUsersCount() {
  let total = 0;
  for (const connections of userConnections.values()) {
    total += connections.size > 0 ? 1 : 0;
  }
  return total;
}
