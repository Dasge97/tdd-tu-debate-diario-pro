<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useFriendsStore } from "@/stores/friends";
import { useUsersStore } from "@/stores/users";
import { useChatStore } from "@/stores/chat";
import { usersService } from "@/services/users.service";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const friendsStore = useFriendsStore();
const usersStore = useUsersStore();
const chatStore = useChatStore();
const toastStore = useToastStore();

const activeTab = ref("friends");
const query = ref("");
const loadingUsers = ref(false);
const users = ref([]);
const page = ref(1);
const pageSize = ref(12);
const totalPages = ref(1);

onMounted(async () => {
  if (!usersStore.isAuthenticated) return;
  await Promise.all([friendsStore.fetchFriends(), friendsStore.fetchRequests(), fetchUsers("", 1)]);
});

const goProfile = (username) => {
  router.push({ name: "perfil", params: { username } });
};

const avatarLetter = (value) => (value || "?").slice(0, 1).toUpperCase();

const relationLabel = (userId) => {
  const status = friendsStore.relationStatusByUserId[userId] || "none";
  if (status === "friends") return "Amigos";
  if (status === "pending_sent") return "Solicitud enviada";
  if (status === "pending_received") return "Te envió solicitud";
  if (status === "rejected") return "Solicitud rechazada";
  return "Agregar amigo";
};

const canSendRequest = (userId) => {
  const status = friendsStore.relationStatusByUserId[userId] || "none";
  return status === "none";
};

const loadRelationStatuses = async () => {
  if (!usersStore.isAuthenticated) return;
  await Promise.all(
    users.value
      .filter((user) => Number(user.id) !== Number(usersStore.me?.id))
      .map((user) => friendsStore.fetchStatus(user.id))
  );
};

const fetchUsers = async (q = "", requestedPage = 1) => {
  loadingUsers.value = true;
  try {
    const data = await usersService.search(q, pageSize.value, requestedPage);
    users.value = data.items || [];
    page.value = Number(data.page || requestedPage || 1);
    totalPages.value = Number(data.totalPages || 1);
    await loadRelationStatuses();
  } catch (error) {
    toastStore.error(error?.response?.data?.error || "No se pudieron cargar usuarios.");
  } finally {
    loadingUsers.value = false;
  }
};

const searchUsers = async () => {
  activeTab.value = "add";
  await fetchUsers(query.value.trim(), 1);
};

const showAllUsers = async () => {
  activeTab.value = "all";
  query.value = "";
  await fetchUsers("", 1);
};

const onChangePage = async (nextPage) => {
  await fetchUsers(activeTab.value === "add" ? query.value.trim() : "", Number(nextPage) || 1);
};

const sendRequest = async (userId) => {
  if (!usersStore.isAuthenticated) {
    toastStore.info("Inicia sesión para agregar amigos.");
    return;
  }
  try {
    await friendsStore.sendRequest(userId);
    toastStore.success("Solicitud de amistad enviada.");
  } catch (error) {
    toastStore.error(error?.response?.data?.error || "No se pudo enviar la solicitud.");
  }
};

const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = page.value;
  const start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
});
</script>

<template>
  <q-page class="q-px-md q-pb-lg">
    <h1 class="section-title q-mt-md q-mb-md">Amigos</h1>

    <div v-if="!usersStore.isAuthenticated" class="alert alert-warning friends-alert" role="alert">
      Inicia sesión para ver y gestionar tus amistades.
    </div>

    <div v-else class="friends-page">
      <ul class="nav nav-tabs friends-tabs">
        <li class="nav-item">
          <button
            type="button"
            class="nav-link"
            :class="{ active: activeTab === 'friends' }"
            @click="activeTab = 'friends'"
          >
            Amigos
          </button>
        </li>
        <li class="nav-item">
          <button
            type="button"
            class="nav-link"
            :class="{ active: activeTab === 'add' }"
            @click="activeTab = 'add'"
          >
            Añadir amigo
          </button>
        </li>
        <li class="nav-item">
          <button
            type="button"
            class="nav-link"
            :class="{ active: activeTab === 'all' }"
            @click="showAllUsers"
          >
            Ver todos
          </button>
        </li>
      </ul>

      <div class="tab-content friends-tab-content">
        <div v-if="activeTab === 'friends'" class="tab-pane fade show active">
          <div class="row g-3">
            <div class="col-12 col-lg-5">
              <div class="card debate-surface friends-fixed-card">
                <div class="card-header friends-card-header">Solicitudes recibidas</div>
                <div class="card-body friends-table-body">
                  <div class="table-responsive friends-table-wrap">
                    <table class="table table-sm align-middle mb-0 friends-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Bio</th>
                          <th class="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="request in friendsStore.requests" :key="request.id">
                          <td>
                            <button type="button" class="friends-link-btn" @click="goProfile(request.user.username)">
                              <span class="friends-avatar">{{ avatarLetter(request.user.username) }}</span>
                              <span>@{{ request.user.username }}</span>
                            </button>
                          </td>
                          <td>{{ request.user.bio || "Sin bio" }}</td>
                          <td class="text-end">
                            <div class="btn-group btn-group-sm">
                              <button type="button" class="btn btn-outline-success" @click="friendsStore.accept(request.requesterId)">
                                Aceptar
                              </button>
                              <button type="button" class="btn btn-outline-danger" @click="friendsStore.reject(request.requesterId)">
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr v-if="friendsStore.requests.length === 0">
                          <td colspan="3" class="text-muted">No tienes solicitudes pendientes.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-12 col-lg-7">
              <div class="card debate-surface friends-fixed-card">
                <div class="card-header friends-card-header">Tus amigos</div>
                <div class="card-body friends-table-body">
                  <div class="table-responsive friends-table-wrap">
                    <table class="table table-sm align-middle mb-0 friends-table">
                      <thead>
                        <tr>
                          <th>Usuario</th>
                          <th>Bio</th>
                          <th>Estado</th>
                          <th class="text-end">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="friend in friendsStore.friends" :key="friend.id">
                          <td>
                            <button type="button" class="friends-link-btn" @click="goProfile(friend.username)">
                              <span class="friends-avatar">{{ avatarLetter(friend.username) }}</span>
                              <span>@{{ friend.username }}</span>
                            </button>
                          </td>
                          <td>{{ friend.bio || "Sin bio" }}</td>
                          <td>{{ friend.location || "Sin ubicación" }}</td>
                          <td class="text-end">
                            <div class="btn-group btn-group-sm">
                              <button type="button" class="btn btn-outline-primary" @click="chatStore.openConversationByUser(friend.id)">
                                Chatear
                              </button>
                              <button type="button" class="btn btn-outline-danger" @click="friendsStore.remove(friend.id)">
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr v-if="friendsStore.friends.length === 0">
                          <td colspan="4" class="text-muted">Aún no tienes amigos agregados.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'add'" class="tab-pane fade show active">
          <div class="card debate-surface friends-fixed-card">
            <div class="card-header friends-card-header">Añadir amigo</div>
            <div class="card-body friends-table-body">
              <div class="friends-toolbar">
                <input
                  v-model="query"
                  type="text"
                  class="form-control"
                  placeholder="Busca por username, bio o ubicación"
                  @keyup.enter="searchUsers"
                />
                <button type="button" class="btn btn-primary" @click="searchUsers">Buscar</button>
              </div>

              <div class="table-responsive friends-table-wrap friends-table-wrap-main">
                <table class="table table-hover align-middle mb-0 friends-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Bio</th>
                      <th>Ubicación</th>
                      <th>Criterio</th>
                      <th class="text-end">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loadingUsers">
                      <td colspan="5" class="text-muted">Cargando usuarios...</td>
                    </tr>
                    <tr v-for="user in users" :key="user.id">
                      <td>
                        <button type="button" class="friends-link-btn" @click="goProfile(user.username)">
                          <span class="friends-avatar">{{ avatarLetter(user.username) }}</span>
                          <span>@{{ user.username }}</span>
                        </button>
                      </td>
                      <td>{{ user.bio || "Sin bio" }}</td>
                      <td>{{ user.location || "Ubicación no disponible" }}</td>
                      <td>{{ user.reliabilityScore || 0 }}</td>
                      <td class="text-end">
                        <button
                          v-if="usersStore.me && Number(user.id) !== Number(usersStore.me.id)"
                          type="button"
                          class="btn btn-sm"
                          :class="canSendRequest(user.id) ? 'btn-primary' : 'btn-outline-secondary'"
                          :disabled="!canSendRequest(user.id)"
                          @click="sendRequest(user.id)"
                        >
                          {{ relationLabel(user.id) }}
                        </button>
                      </td>
                    </tr>
                    <tr v-if="!loadingUsers && users.length === 0">
                      <td colspan="5" class="text-muted">No se encontraron usuarios.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'all'" class="tab-pane fade show active">
          <div class="card debate-surface friends-fixed-card">
            <div class="card-header friends-card-header">Todos los usuarios</div>
            <div class="card-body friends-table-body">
              <div class="friends-toolbar">
                <div class="text-muted small">Listado general de usuarios disponibles</div>
                <button type="button" class="btn btn-outline-primary" @click="showAllUsers">Actualizar</button>
              </div>

              <div class="table-responsive friends-table-wrap friends-table-wrap-main">
                <table class="table table-hover align-middle mb-0 friends-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Bio</th>
                      <th>Ubicación</th>
                      <th>Criterio</th>
                      <th class="text-end">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="loadingUsers">
                      <td colspan="5" class="text-muted">Cargando usuarios...</td>
                    </tr>
                    <tr v-for="user in users" :key="user.id">
                      <td>
                        <button type="button" class="friends-link-btn" @click="goProfile(user.username)">
                          <span class="friends-avatar">{{ avatarLetter(user.username) }}</span>
                          <span>@{{ user.username }}</span>
                        </button>
                      </td>
                      <td>{{ user.bio || "Sin bio" }}</td>
                      <td>{{ user.location || "Ubicación no disponible" }}</td>
                      <td>{{ user.reliabilityScore || 0 }}</td>
                      <td class="text-end">
                        <button
                          v-if="usersStore.me && Number(user.id) !== Number(usersStore.me.id)"
                          type="button"
                          class="btn btn-sm"
                          :class="canSendRequest(user.id) ? 'btn-primary' : 'btn-outline-secondary'"
                          :disabled="!canSendRequest(user.id)"
                          @click="sendRequest(user.id)"
                        >
                          {{ relationLabel(user.id) }}
                        </button>
                      </td>
                    </tr>
                    <tr v-if="!loadingUsers && users.length === 0">
                      <td colspan="5" class="text-muted">No hay usuarios disponibles.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <nav v-if="totalPages > 1" class="friends-pagination">
                <ul class="pagination pagination-sm mb-0">
                  <li class="page-item" :class="{ disabled: page <= 1 }">
                    <button type="button" class="page-link" @click="onChangePage(page - 1)">Anterior</button>
                  </li>
                  <li v-for="pageNumber in visiblePages" :key="pageNumber" class="page-item" :class="{ active: pageNumber === page }">
                    <button type="button" class="page-link" @click="onChangePage(pageNumber)">{{ pageNumber }}</button>
                  </li>
                  <li class="page-item" :class="{ disabled: page >= totalPages }">
                    <button type="button" class="page-link" @click="onChangePage(page + 1)">Siguiente</button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>
