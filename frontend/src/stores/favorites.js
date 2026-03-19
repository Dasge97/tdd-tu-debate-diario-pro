import { defineStore } from "pinia";
import { favoritesService } from "@/services/favorites.service";

export const useFavoritesStore = defineStore("favorites", {
  state: () => ({
    items: [],
    loading: false
  }),
  getters: {
    favoriteIds: (state) => new Set(state.items.map((item) => Number(item.id)))
  },
  actions: {
    async fetchFavorites() {
      this.loading = true;
      try {
        this.items = await favoritesService.list();
      } catch (_error) {
        this.items = [];
      } finally {
        this.loading = false;
      }
    },
    async add(debateId) {
      await favoritesService.add(debateId);
      await this.fetchFavorites();
    },
    async remove(debateId) {
      await favoritesService.remove(debateId);
      this.items = this.items.filter((item) => Number(item.id) !== Number(debateId));
    },
    async toggle(debateId) {
      if (this.favoriteIds.has(Number(debateId))) {
        await this.remove(debateId);
      } else {
        await this.add(debateId);
      }
    }
  }
});
