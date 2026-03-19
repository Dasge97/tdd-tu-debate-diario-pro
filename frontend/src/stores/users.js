import { defineStore } from "pinia";
import { usersService } from "@/services/users.service";

const tokenStorageKey = "tdd_token";

export const useUsersStore = defineStore("users", {
  state: () => ({
    token: localStorage.getItem(tokenStorageKey) || "",
    me: null,
    profile: null,
    topUsers: [],
    loadingTopUsers: false,
    authError: ""
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    isAdmin: (state) => Boolean(state.me?.isAdmin || state.me?.role === "admin")
  },
  actions: {
    setToken(token) {
      this.token = token || "";
      if (token) localStorage.setItem(tokenStorageKey, token);
      else localStorage.removeItem(tokenStorageKey);
    },
    async fetchTopUsers(limit = 5) {
      this.loadingTopUsers = true;
      try {
        this.topUsers = await usersService.getTop(limit);
      } catch (_error) {
        this.topUsers = [];
      } finally {
        this.loadingTopUsers = false;
      }
    },
    async fetchMe() {
      if (!this.token) {
        this.me = null;
        return;
      }
      try {
        this.me = await usersService.getMe();
      } catch (_error) {
        this.setToken("");
        this.me = null;
      }
    },
    async updateMe(payload) {
      this.me = await usersService.updateMe(payload);
      return this.me;
    },
    async uploadAvatar(file) {
      this.me = await usersService.uploadAvatar(file);
      return this.me;
    },
    async fetchProfileByUsername(username) {
      this.profile = await usersService.getByUsername(username);
      return this.profile;
    },
    async register(payload) {
      this.authError = "";
      try {
        const data = await usersService.register(payload);
        this.setToken(data.token);
        this.me = data.user;
      } catch (error) {
        this.authError = error?.response?.data?.error || "No se pudo registrar la cuenta.";
        throw error;
      }
    },
    async login(payload) {
      this.authError = "";
      try {
        const data = await usersService.login(payload);
        this.setToken(data.token);
        this.me = data.user;
      } catch (error) {
        this.authError = error?.response?.data?.error || "No se pudo iniciar sesión.";
        throw error;
      }
    },
    async logout() {
      try {
        if (this.token) await usersService.logout();
      } catch (_error) {
        // limpiar sesión local siempre
      } finally {
        this.setToken("");
        this.me = null;
      }
    }
  }
});
