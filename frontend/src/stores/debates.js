import { nextTick } from "vue";
import { defineStore } from "pinia";
import { debatesService } from "@/services/debates.service";

export const useDebatesStore = defineStore("debates", {
  state: () => ({
    today: [],
    byId: {},
    commentsByDebate: {},
    searchResults: [],
    trending: [],
    loadingToday: false,
    loadingDebate: false,
    loadingComments: false,
    loadingSearch: false,
    loadingTrending: false,
    error: ""
  }),
  actions: {
    async fetchToday() {
      this.loadingToday = true;
      this.error = "";
      try {
        this.today = await debatesService.getToday();
      } catch (error) {
        this.error = error?.response?.data?.error || "No se pudieron cargar los debates de hoy.";
      } finally {
        this.loadingToday = false;
      }
    },
    async fetchDebate(id) {
      this.loadingDebate = true;
      try {
        const debate = await debatesService.getById(id);
        this.byId[id] = debate;
      } finally {
        this.loadingDebate = false;
      }
    },
    async fetchComments(debateId) {
      this.loadingComments = true;
      try {
        this.commentsByDebate[debateId] = await debatesService.getComments(debateId);
      } finally {
        this.loadingComments = false;
      }
    },
    async createComment({ debateId, content, parentId = null }) {
      const created = await debatesService.postComment({ debateId, content, parentId });
      const current = this.commentsByDebate[debateId] || [];
      this.commentsByDebate[debateId] = [...current, created];
      return created;
    },
    async voteComment({ debateId, commentId, value = 1 }) {
      const current = this.commentsByDebate[debateId] || [];
      const previousComments = current.map((comment) => ({ ...comment }));
      const normalizedValue = Number(value) < 0 ? -1 : 1;

      this.commentsByDebate[debateId] = current.map((comment) => {
        if (Number(comment.id) !== Number(commentId)) return comment;

        const previousVote = Number(comment.currentUserVote || 0);
        if (previousVote === normalizedValue) {
          return comment;
        }

        let upvotes = Number(comment.upvotes || 0);
        let downvotes = Number(comment.downvotes || 0);
        let score = Number(comment.score || 0);

        if (previousVote > 0) upvotes = Math.max(0, upvotes - 1);
        if (previousVote < 0) downvotes = Math.max(0, downvotes - 1);

        if (normalizedValue > 0) upvotes += 1;
        if (normalizedValue < 0) downvotes += 1;

        score += normalizedValue - previousVote;

        return {
          ...comment,
          score,
          upvotes,
          downvotes,
          currentUserVote: normalizedValue
        };
      });

      await nextTick();

      try {
        const updated = await debatesService.voteComment(commentId, normalizedValue);
        this.commentsByDebate[debateId] = (this.commentsByDebate[debateId] || []).map((comment) =>
          Number(comment.id) === Number(commentId)
            ? {
                ...comment,
                score: Number(updated.score ?? comment.score ?? 0),
                upvotes: Number(updated.upvotes ?? comment.upvotes ?? 0),
                downvotes: Number(updated.downvotes ?? comment.downvotes ?? 0),
                currentUserVote: Number(updated.currentUserVote ?? normalizedValue)
              }
            : comment
        );
        return updated;
      } catch (error) {
        this.commentsByDebate[debateId] = previousComments;
        throw error;
      }
    },
    async setPosition({ debateId, position }) {
      await debatesService.postPosition({ debateId, position });
      await this.fetchDebate(debateId);
      await this.fetchToday();
    },
    async search(params) {
      this.loadingSearch = true;
      try {
        this.searchResults = await debatesService.search(params);
      } finally {
        this.loadingSearch = false;
      }
    },
    async fetchTrending(limit = 10) {
      this.loadingTrending = true;
      try {
        this.trending = await debatesService.getTrending(limit);
      } finally {
        this.loadingTrending = false;
      }
    }
  }
});
