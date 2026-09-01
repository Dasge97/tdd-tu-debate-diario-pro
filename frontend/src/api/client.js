import axios from "axios";

/**
 * Cliente HTTP contra la API Symfony.
 * Guarda los tokens en localStorage y renueva el de acceso cuando la API
 * responde 401, reintentando una sola vez la peticion original.
 */

const ACCESS_KEY = "tdd.accessToken";
const REFRESH_KEY = "tdd.refreshToken";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: { "Content-Type": "application/json" },
  timeout: 20000
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Se llama cuando la sesion ya no se puede recuperar; lo enlaza el store de auth. */
let onSessionExpired = () => {};
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

/* Una sola renovacion en vuelo: las peticiones que fallen mientras tanto esperan a la misma. */
let refreshPromise = null;

const refreshAccessToken = async () => {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;

  const { data } = await axios.post(
    `${api.defaults.baseURL}/api/v1/auth/refresh`,
    { refreshToken },
    { headers: { "Content-Type": "application/json" } }
  );

  tokenStorage.set(data.accessToken, data.refreshToken);
  return data.accessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const isRefreshCall = original?.url?.includes("/auth/refresh");

    if (status === 401 && original && !original._retried && !isRefreshCall) {
      original._retried = true;

      try {
        refreshPromise = refreshPromise || refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;

        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch (_) {
        refreshPromise = null;
      }

      tokenStorage.clear();
      onSessionExpired();
    }

    return Promise.reject(error);
  }
);

/**
 * La API devuelve los errores de negocio con un prefijo tipo
 * "UNAUTHORIZED: invalid credentials". Aqui se queda solo el texto legible.
 */
export const errorMessage = (error, fallback = "Algo ha ido mal. Inténtalo de nuevo.") => {
  if (error?.code === "ERR_NETWORK") {
    return "Sin conexión con el servidor.";
  }

  const raw =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    "";

  if (typeof raw === "string" && raw.trim() !== "") {
    const cleaned = raw.replace(/^[A-Z_]+:\s*/, "").trim();
    return cleaned || fallback;
  }

  return fallback;
};
