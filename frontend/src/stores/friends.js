import { defineStore } from "pinia";
import { friendsService } from "@/services/friends.service";

export const useFriendsStore = defineStore("friends", {
  state: () => ({
    friends: [],
    requests: [],
    relationStatusByUserId: {},
    loading: false
  }),
  actions: {
    async fetchFriends() {
      this.loading = true;
      try {
        this.friends = await friendsService.list();
      } finally {
        this.loading = false;
      }
    },
    async fetchRequests() {
      this.requests = await friendsService.listRequests();
    },
    async fetchStatus(userId) {
      const data = await friendsService.getStatus(userId);
      this.relationStatusByUserId[userId] = data.status;
      return data.status;
    },
    async sendRequest(userId) {
      await friendsService.sendRequest(userId);
      this.relationStatusByUserId[userId] = "pending_sent";
    },
    async accept(userId) {
      await friendsService.accept(userId);
      this.relationStatusByUserId[userId] = "friends";
      await Promise.all([this.fetchFriends(), this.fetchRequests()]);
    },
    async reject(userId) {
      await friendsService.reject(userId);
      this.relationStatusByUserId[userId] = "rejected";
      await this.fetchRequests();
    },
    async remove(userId) {
      await friendsService.remove(userId);
      this.relationStatusByUserId[userId] = "none";
      this.friends = this.friends.filter((friend) => Number(friend.id) !== Number(userId));
    }
  }
});
