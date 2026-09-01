import { defineStore } from "pinia";
import { personasService, usersService } from "@/services";

/** Personajes de IA y ranking de usuarios reales. */
export const useUsersStore = defineStore("users", {
  state: () => ({
    personas: [],
    protagonistas: [],
    loadingPersonas: false,
    loadingProtagonistas: false,
    personasLoaded: false,
    protagonistasLoaded: false
  }),

  actions: {
    async loadPersonas(force = false) {
      if (this.personasLoaded && !force) return this.personas;
      this.loadingPersonas = true;
      try {
        this.personas = await personasService.list();
        this.personasLoaded = true;
        return this.personas;
      } finally {
        this.loadingPersonas = false;
      }
    },

    async loadProtagonistas(force = false) {
      if (this.protagonistasLoaded && !force) return this.protagonistas;
      this.loadingProtagonistas = true;
      try {
        this.protagonistas = await usersService.protagonistas(30);
        this.protagonistasLoaded = true;
        return this.protagonistas;
      } finally {
        this.loadingProtagonistas = false;
      }
    }
  }
});
