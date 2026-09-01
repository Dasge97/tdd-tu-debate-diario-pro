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
    today: [],
    // true cuando en today no hay debates de hoy y se muestran los ultimos.
    todayEsReciente: false,
    // Pagina ya pedida en la carga continua de la pestana Hoy.
    paginaHoy: 1,
    topWeek: [],
    ticker: [],
    byId: {},
    positions: {},
    loadingToday: false,
    loadingWeek: false,
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

    async fetchToday(force = false) {
      if (this.today.length && !force) return this.today;
      this.loadingToday = true;
      this.error = null;
      try {
        let data = await debatesService.today();

        // Algunos dias el worker todavia no ha publicado. En vez de dejar la
        // pantalla vacia, se muestran los ultimos debates que haya.
        if (!data.length) {
          data = await debatesService.recent();
          this.todayEsReciente = data.length > 0;
        } else {
          this.todayEsReciente = false;
        }

        this.paginaHoy = 1;

        this.today = data;
        this.cache(data);
        this.loadPositionsFor(data);
        return data;
      } catch (error) {
        this.error = errorMessage(error, "No hemos podido cargar los debates de hoy.");
        return [];
      } finally {
        this.loadingToday = false;
      }
    },

    async fetchTopWeek(force = false) {
      if (this.topWeek.length && !force) return this.topWeek;
      this.loadingWeek = true;
      try {
        const data = await debatesService.topWeek();
        this.topWeek = data;
        this.cache(data);
        this.loadPositionsFor(data);
        return data;
      } catch (error) {
        this.error = errorMessage(error, "No hemos podido cargar los debates de la semana.");
        return [];
      } finally {
        this.loadingWeek = false;
      }
    },

    /**
     * Trae la pagina siguiente de la pestana Hoy y devuelve cuantos debates ha
     * anadido. Solo tiene sentido cuando se estan mostrando los ultimos
     * debates: la lista de hoy no se pagina.
     */
    async cargarMasHoy() {
      // Todavia no se sabe: la primera carga sigue en marcha.
      if (this.loadingToday || !this.today.length) return null;

      // La lista de hoy no se pagina; solo la de los ultimos debates.
      if (!this.todayEsReciente) return 0;

      const siguiente = this.paginaHoy + 1;
      const data = await debatesService.recent(siguiente);

      const conocidos = new Set(this.today.map((d) => d.id));
      const nuevos = data.filter((d) => !conocidos.has(d.id));

      if (nuevos.length) {
        this.today = [...this.today, ...nuevos];
        this.cache(nuevos);
        this.loadPositionsFor(nuevos);
      }

      this.paginaHoy = siguiente;
      return nuevos.length;
    },

    async fetchTicker() {
      try {
        const data = await debatesService.ticker();
        this.ticker = data;
        this.cache(data);
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
