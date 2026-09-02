import { defineStore } from "pinia";
import { debatesService, participationService } from "@/services";
import { errorMessage } from "@/api/client";

/**
 * Debates y sus posiciones.
 *
 * La API no devuelve las posiciones dentro del debate: hay que pedirlas aparte
 * a /debates/{id}/positions, que responde {support, oppose, neutral}. Aqui se
 * cachean por id de debate y se convierten a los porcentajes que pinta la barra.
 */
export const useDebatesStore = defineStore("debates", {
  state: () => ({
    // Feed unico de la pantalla de inicio.
    feed: [],
    // Personaje por el que se filtra, o null para verlos todos.
    personaFiltro: null,
    // Ultima pagina pedida en la carga continua.
    paginaFeed: 1,
    cargandoFeed: false,
    ticker: [],
    byId: {},
    positions: {},
    error: null
  }),

  getters: {
    /** Porcentajes redondeados para la barra de posiciones. */
    percentagesFor: (state) => (debateId) => {
      const counts = state.positions[debateId];
      if (!counts) return null;

      const total =
        Number(counts.support || 0) +
        Number(counts.oppose || 0) +
        Number(counts.neutral || 0);

      if (total === 0) {
        return { favor: 0, contra: 0, neutral: 0, total: 0 };
      }

      return {
        favor: Math.round((counts.support / total) * 100),
        contra: Math.round((counts.oppose / total) * 100),
        neutral: Math.round((counts.neutral / total) * 100),
        total
      };
    }
  },

  actions: {
    cache(debates) {
      debates.forEach((debate) => {
        this.byId[debate.id] = { ...this.byId[debate.id], ...debate };
      });
    },

    /**
     * Carga el feed de la pantalla de inicio.
     *
     * Sin filtro se piden los debates recientes, que vienen del mas nuevo al
     * mas viejo. Con filtro se piden solo los de ese personaje.
     */
    async cargarFeed({ persona = null, forzar = false } = {}) {
      const cambiaFiltro = persona !== this.personaFiltro;

      if (this.feed.length && !forzar && !cambiaFiltro) return this.feed;

      this.cargandoFeed = true;
      this.error = null;
      this.personaFiltro = persona;

      try {
        const data = persona
          ? await debatesService.recent(1, persona)
          : await debatesService.recent(1);

        this.paginaFeed = 1;
        this.feed = data;
        this.cache(data);
        this.loadPositionsFor(data);
        return data;
      } catch (error) {
        this.error = errorMessage(error, "No hemos podido cargar los debates.");
        this.feed = [];
        return [];
      } finally {
        this.cargandoFeed = false;
      }
    },

    /**
     * Trae la pagina siguiente del feed y devuelve cuantos debates ha anadido.
     * Devuelve null mientras la primera carga sigue en marcha, para que la
     * carga continua no de la lista por agotada antes de tiempo.
     */
    async cargarMasFeed() {
      if (this.cargandoFeed || !this.feed.length) return null;

      const siguiente = this.paginaFeed + 1;
      const data = await debatesService.recent(siguiente, this.personaFiltro);

      const conocidos = new Set(this.feed.map((d) => d.id));
      const nuevos = data.filter((d) => !conocidos.has(d.id));

      if (nuevos.length) {
        this.feed = [...this.feed, ...nuevos];
        this.cache(nuevos);
        this.loadPositionsFor(nuevos);
      }

      this.paginaFeed = siguiente;
      return nuevos.length;
    },

    async fetchTicker() {
      try {
        const data = await debatesService.ticker();
        this.ticker = data;
        this.cache(data);
        this.loadPositionsFor(data);
        return data;
      } catch (_) {
        return [];
      }
    },

    async fetchDebate(id) {
      const debate = await debatesService.byId(id);
      this.byId[debate.id] = debate;
      return debate;
    },

    async fetchPositions(debateId) {
      const counts = await participationService.getPositions(debateId);
      this.positions[debateId] = counts;
      return counts;
    },

    /** Carga en paralelo las posiciones de una lista, sin bloquear el pintado. */
    loadPositionsFor(debates) {
      debates
        .filter((debate) => !this.positions[debate.id])
        .forEach((debate) => {
          this.fetchPositions(debate.id).catch(() => {});
        });
    },

    async setPosition(debateId, position) {
      await participationService.setPosition(debateId, position);
      await this.fetchPositions(debateId);
    }
  }
});
