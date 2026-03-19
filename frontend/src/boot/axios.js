import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  timeout: 10000
});

export function bootAxios({ app }) {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("tdd_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  app.config.globalProperties.$api = api;
  app.provide("api", api);
}
