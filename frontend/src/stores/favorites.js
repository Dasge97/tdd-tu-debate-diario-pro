import { defineStore } from "pinia";
import { socialService, usersService } from "@/services";

/**
 * Debates marcados como favoritos.
 *
 * POST /favorites/{id} es un conmutador en el servidor y devuelve
 * {favorited: bool}, asi que aqui basta con reflejar esa respuesta.
 */
export const useFavoritesStore = defineStore("favorites", {
  state: () => ({
    ids: new Set(),
    items: [],
    loaded: false
  }),

  getters: {
    isFavorite: (state) => (debateId) => state.ids.has(Number(debateId))
  },

  actions: {
    async load(force = false) {
      if (this.loaded && !force) return this.items;
      const favorites = await usersService.favorites();
      this.items = favorites;
      this.ids = new Set(favorites.map((favorite) => Number(favorite.debate.id)));
      this.loaded = true;
      return favorites;
    },

    async toggle(debateId) {
      const id = Number(debateId);
      const { favorited } = await socialService.addFavorite(id);

      if (favorited) {
        this.ids.add(id);
      } else {
        this.ids.delete(id);
        this.items = this.items.filter((favorite) => Number(favorite.debate.id) !== id);
      }

      this.ids = new Set(this.ids);
      this.loaded = false;
      return favorited;
    },

    reset() {
      this.ids = new Set();
      this.items = [];
      this.loaded = false;
    }
  }
});
