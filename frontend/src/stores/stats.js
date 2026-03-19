import { defineStore } from "pinia";

export const useStatsStore = defineStore("stats", {
  state: () => ({
    comentariosHoy: 0,
    participantesHoy: 0,
    debatesActivos: 0,
    votosEmitidos: 0,
    promedioComentariosPorDebate: 0
  }),
  actions: {
    computeFromDebates(debates = [], topUsers = []) {
      this.debatesActivos = debates.length;
      this.comentariosHoy = debates.reduce((acc, d) => acc + Number(d.commentCount || 0), 0);
      this.votosEmitidos = debates.reduce((acc, d) => {
        const raw = d.positionsRaw || {};
        return acc + Number(raw.support || 0) + Number(raw.oppose || 0) + Number(raw.neutral || 0);
      }, 0);
      this.participantesHoy = Math.max(topUsers.length, Math.round(this.comentariosHoy * 0.35));
      this.promedioComentariosPorDebate =
        this.debatesActivos > 0 ? Number((this.comentariosHoy / this.debatesActivos).toFixed(1)) : 0;
    }
  }
});
