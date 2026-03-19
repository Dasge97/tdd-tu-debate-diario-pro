<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { adminService } from "@/services/admin.service";
import { useUsersStore } from "@/stores/users";
import { useModalStore } from "@/stores/modal";
import { useToastStore } from "@/stores/toast";

const router = useRouter();
const usersStore = useUsersStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const opsBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const loading = ref(false);
const error = ref("");
const activeTab = ref("overview");
const overview = ref(null);
const recentActivity = ref([]);

const usersState = reactive({ items: [], page: 1, pageSize: 8, total: 0, q: "" });
const debatesState = reactive({ items: [], page: 1, pageSize: 6, total: 0, q: "" });
const commentsState = reactive({ items: [], page: 1, pageSize: 8, total: 0, q: "" });
const conversationsState = reactive({ items: [], page: 1, pageSize: 6, total: 0, q: "" });
const notificationsState = reactive({ items: [], page: 1, pageSize: 8, total: 0 });
const auditState = reactive({ items: [], page: 1, pageSize: 8, total: 0 });

const tabs = [
  { id: "overview", label: "Resumen" },
  { id: "users", label: "Usuarios" },
  { id: "debates", label: "Debates" },
  { id: "comments", label: "Comentarios" },
  { id: "chat", label: "Chat" },
  { id: "notifications", label: "Notificaciones" },
  { id: "audit", label: "Auditoría" }
];

const totalPages = (state) => Math.max(1, Math.ceil(Number(state.total || 0) / Number(state.pageSize || 1)));

const metricCards = computed(() => {
  if (!overview.value) return [];
  return [
    { label: "Usuarios", value: overview.value.totalUsers, detail: `${overview.value.totalAdmins} admins` },
    { label: "Suspendidos", value: overview.value.totalSuspendedUsers, detail: `+${overview.value.newUsers24h} nuevos / 24h` },
    { label: "Debates", value: overview.value.totalDebates, detail: `${overview.value.debatesToday} hoy` },
    { label: "Comentarios", value: overview.value.totalComments, detail: `${overview.value.comments24h} / 24h` },
    { label: "Mensajes", value: overview.value.totalMessages, detail: `${overview.value.messages24h} / 24h` },
    { label: "Sockets", value: overview.value.activeSocketUsers, detail: `${overview.value.totalConversations} conversaciones` },
    { label: "Notificaciones", value: overview.value.totalNotifications, detail: `${overview.value.unreadNotifications} sin leer` },
    { label: "Amistades", value: overview.value.acceptedFriendships, detail: `${overview.value.pendingFriendships} pendientes` }
  ];
});

const loadOverview = async () => {
  const [overviewData, activityData] = await Promise.all([
    adminService.getOverview(),
    adminService.getActivity(12)
  ]);
  overview.value = overviewData;
  recentActivity.value = activityData;
};

const loadUsers = async () => {
  const data = await adminService.getUsers({
    q: usersState.q || undefined,
    page: usersState.page,
    limit: usersState.pageSize
  });
  Object.assign(usersState, data, { q: usersState.q });
};

const loadDebates = async () => {
  const data = await adminService.getDebates({
    q: debatesState.q || undefined,
    page: debatesState.page,
    limit: debatesState.pageSize
  });
  Object.assign(debatesState, data, { q: debatesState.q });
};

const loadComments = async () => {
  const data = await adminService.getComments({
    q: commentsState.q || undefined,
    page: commentsState.page,
    limit: commentsState.pageSize
  });
  Object.assign(commentsState, data, { q: commentsState.q });
};

const loadConversations = async () => {
  const data = await adminService.getConversations({
    q: conversationsState.q || undefined,
    page: conversationsState.page,
    limit: conversationsState.pageSize
  });
  Object.assign(conversationsState, data, { q: conversationsState.q });
};

const loadNotifications = async () => {
  const data = await adminService.getNotifications({
    page: notificationsState.page,
    limit: notificationsState.pageSize
  });
  Object.assign(notificationsState, data);
};

const loadAuditLogs = async () => {
  const data = await adminService.getAuditLogs({
    page: auditState.page,
    limit: auditState.pageSize
  });
  Object.assign(auditState, data);
};

const loadAll = async () => {
  loading.value = true;
  error.value = "";
  try {
    await Promise.all([
      loadOverview(),
      loadUsers(),
      loadDebates(),
      loadComments(),
      loadConversations(),
      loadNotifications(),
      loadAuditLogs()
    ]);
  } catch (err) {
    error.value = err?.response?.data?.error || "No se pudo cargar el panel de administración.";
    toastStore.error(error.value);
  } finally {
    loading.value = false;
  }
};

const changePage = async (state, nextPage, loader) => {
  const max = totalPages(state);
  state.page = Math.min(Math.max(nextPage, 1), max);
  await loader();
};

const saveUser = async (user) => {
  await adminService.updateUser(user.id, {
    role: user.role,
    status: user.status,
    reliabilityScore: user.reliabilityScore
  });
  await Promise.all([loadUsers(), loadOverview(), loadAuditLogs()]);
  toastStore.success("Usuario actualizado.");
};

const saveDebate = async (debate) => {
  const title = window.prompt("Nuevo título del debate", debate.title);
  if (!title) return;
  const context = window.prompt("Nuevo contexto", debate.context);
  if (!context) return;
  const dayDate = window.prompt("Nueva fecha (YYYY-MM-DD)", debate.dayDate);
  if (!dayDate) return;
  await adminService.updateDebate(debate.id, { title, context, dayDate });
  await Promise.all([loadDebates(), loadOverview(), loadAuditLogs()]);
  toastStore.success("Debate actualizado.");
};

const removeDebate = async (debateId) => {
  const confirmed = await modalStore.confirm({
    title: "Eliminar debate",
    message: "Se eliminará el debate y su contenido asociado. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    cancelLabel: "Cancelar"
  });
  if (!confirmed) return;
  await adminService.deleteDebate(debateId);
  await Promise.all([loadDebates(), loadOverview(), loadAuditLogs()]);
  toastStore.success("Debate eliminado.");
};

const saveComment = async (comment) => {
  const content = window.prompt("Editar comentario", comment.content);
  if (!content) return;
  await adminService.updateComment(comment.id, { content });
  await Promise.all([loadComments(), loadOverview(), loadAuditLogs()]);
  toastStore.success("Comentario actualizado.");
};

const removeComment = async (commentId) => {
  const confirmed = await modalStore.confirm({
    title: "Eliminar comentario",
    message: "Se eliminará el comentario seleccionado. Esta acción no se puede deshacer.",
    confirmLabel: "Eliminar",
    cancelLabel: "Cancelar"
  });
  if (!confirmed) return;
  await adminService.deleteComment(commentId);
  await Promise.all([loadComments(), loadOverview(), loadAuditLogs()]);
  toastStore.success("Comentario eliminado.");
};

onMounted(async () => {
  if (!usersStore.isAuthenticated) {
    router.push({ name: "home" });
    return;
  }
  if (!usersStore.me) {
    await usersStore.fetchMe();
  }
  if (!usersStore.isAdmin) {
    router.push({ name: "home" });
    return;
  }
  await loadAll();
});
</script>

<template>
  <q-page class="admin-page q-pa-md">
    <div class="container-fluid px-0">
      <div class="admin-hero rounded-4 border p-4 mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div class="text-uppercase admin-kicker">Panel de administración</div>
            <h1 class="admin-title mb-2">Control operativo de TDD</h1>
            <p class="admin-subtitle mb-0">
              Supervisión de actividad, usuarios, debates, comentarios, chat y auditoría.
            </p>
          </div>
          <div class="d-flex gap-2">
            <a class="btn btn-outline-secondary btn-sm" :href="`${opsBaseUrl}/imports.html`" target="_blank" rel="noreferrer">Stacks</a>
            <a class="btn btn-outline-secondary btn-sm" :href="`${opsBaseUrl}/jobs.html`" target="_blank" rel="noreferrer">Jobs</a>
            <button class="btn btn-outline-dark btn-sm" @click="loadAll">Actualizar</button>
            <button class="btn btn-dark btn-sm" @click="router.push({ name: 'home' })">Volver</button>
          </div>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <div v-if="loading" class="alert alert-secondary py-2">Cargando panel...</div>

      <ul class="nav nav-pills admin-nav mb-4">
        <li v-for="tab in tabs" :key="tab.id" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>

      <section v-if="activeTab === 'overview'">
        <div class="row g-3 mb-4">
          <div v-for="metric in metricCards" :key="metric.label" class="col-6 col-md-4 col-xl-3">
            <div class="card h-100 border-0 shadow-sm admin-metric-card">
              <div class="card-body py-3">
                <div class="small text-uppercase admin-metric-label">{{ metric.label }}</div>
                <div class="admin-metric-value">{{ metric.value }}</div>
                <div class="small text-secondary">{{ metric.detail }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3">
            <strong>Actividad reciente</strong>
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Detalle</th>
                  <th class="text-end">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in recentActivity" :key="`${item.kind}-${item.itemId}`">
                  <td><span class="badge text-bg-light">{{ item.kind }}</span></td>
                  <td>{{ item.title }}</td>
                  <td class="text-secondary">{{ item.detail }}</td>
                  <td class="text-end small text-secondary">{{ item.createdAt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'users'">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center gap-2">
            <strong>Usuarios</strong>
            <input v-model="usersState.q" class="form-control form-control-sm admin-search" placeholder="Buscar usuario o email" @keyup.enter="usersState.page = 1; loadUsers()" />
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Índice</th>
                  <th class="text-end">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in usersState.items" :key="user.id">
                  <td>@{{ user.username }}</td>
                  <td class="small">{{ user.email }}</td>
                  <td>
                    <select v-model="user.role" class="form-select form-select-sm">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="user.status" class="form-select form-select-sm">
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                    </select>
                  </td>
                  <td>
                    <input v-model.number="user.reliabilityScore" type="number" class="form-control form-control-sm" />
                  </td>
                  <td class="text-end">
                    <button class="btn btn-dark btn-sm" @click="saveUser(user)">Guardar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-white d-flex justify-content-between align-items-center">
            <small class="text-secondary">{{ usersState.total }} usuarios</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="usersState.page <= 1" @click="changePage(usersState, usersState.page - 1, loadUsers)">Anterior</button>
              <button class="btn btn-outline-secondary disabled">Página {{ usersState.page }} / {{ totalPages(usersState) }}</button>
              <button class="btn btn-outline-secondary" :disabled="usersState.page >= totalPages(usersState)" @click="changePage(usersState, usersState.page + 1, loadUsers)">Siguiente</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'debates'">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center gap-2">
            <strong>Debates</strong>
            <input v-model="debatesState.q" class="form-control form-control-sm admin-search" placeholder="Buscar debate" @keyup.enter="debatesState.page = 1; loadDebates()" />
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Fecha</th>
                  <th>Comentarios</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="debate in debatesState.items" :key="debate.id">
                  <td>
                    <div class="fw-semibold">{{ debate.title }}</div>
                    <div class="small text-secondary admin-truncate">{{ debate.context }}</div>
                  </td>
                  <td>{{ debate.dayDate }}</td>
                  <td>{{ debate.commentCount }}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-dark" @click="saveDebate(debate)">Editar</button>
                      <button class="btn btn-outline-danger" @click="removeDebate(debate.id)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-white d-flex justify-content-between align-items-center">
            <small class="text-secondary">{{ debatesState.total }} debates</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="debatesState.page <= 1" @click="changePage(debatesState, debatesState.page - 1, loadDebates)">Anterior</button>
              <button class="btn btn-outline-secondary disabled">Página {{ debatesState.page }} / {{ totalPages(debatesState) }}</button>
              <button class="btn btn-outline-secondary" :disabled="debatesState.page >= totalPages(debatesState)" @click="changePage(debatesState, debatesState.page + 1, loadDebates)">Siguiente</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'comments'">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center gap-2">
            <strong>Comentarios</strong>
            <input v-model="commentsState.q" class="form-control form-control-sm admin-search" placeholder="Buscar comentario" @keyup.enter="commentsState.page = 1; loadComments()" />
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Debate</th>
                  <th>Contenido</th>
                  <th>Score</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="comment in commentsState.items" :key="comment.id">
                  <td>@{{ comment.username }}</td>
                  <td class="small">{{ comment.debateTitle }}</td>
                  <td class="small admin-truncate">{{ comment.content }}</td>
                  <td>{{ comment.score }}</td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-dark" @click="saveComment(comment)">Editar</button>
                      <button class="btn btn-outline-danger" @click="removeComment(comment.id)">Eliminar</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-white d-flex justify-content-between align-items-center">
            <small class="text-secondary">{{ commentsState.total }} comentarios</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="commentsState.page <= 1" @click="changePage(commentsState, commentsState.page - 1, loadComments)">Anterior</button>
              <button class="btn btn-outline-secondary disabled">Página {{ commentsState.page }} / {{ totalPages(commentsState) }}</button>
              <button class="btn btn-outline-secondary" :disabled="commentsState.page >= totalPages(commentsState)" @click="changePage(commentsState, commentsState.page + 1, loadComments)">Siguiente</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'chat'" class="row g-3">
        <div class="col-12 col-xl-7">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center gap-2">
              <strong>Conversaciones</strong>
              <input v-model="conversationsState.q" class="form-control form-control-sm admin-search" placeholder="Buscar participante" @keyup.enter="conversationsState.page = 1; loadConversations()" />
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Participantes</th>
                    <th>Mensajes</th>
                    <th>Último mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="conversation in conversationsState.items" :key="conversation.id">
                    <td>{{ conversation.participants }}</td>
                    <td>{{ conversation.messageCount }}</td>
                    <td class="small admin-truncate">{{ conversation.lastMessage }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="card-footer bg-white d-flex justify-content-between align-items-center">
              <small class="text-secondary">{{ conversationsState.total }} conversaciones</small>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" :disabled="conversationsState.page <= 1" @click="changePage(conversationsState, conversationsState.page - 1, loadConversations)">Anterior</button>
                <button class="btn btn-outline-secondary disabled">Página {{ conversationsState.page }} / {{ totalPages(conversationsState) }}</button>
                <button class="btn btn-outline-secondary" :disabled="conversationsState.page >= totalPages(conversationsState)" @click="changePage(conversationsState, conversationsState.page + 1, loadConversations)">Siguiente</button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-header bg-white py-3"><strong>Observabilidad rápida</strong></div>
            <div class="card-body">
              <div class="admin-observability-grid">
                <div><span>Usuarios conectados</span><strong>{{ overview?.activeSocketUsers || 0 }}</strong></div>
                <div><span>Mensajes 24h</span><strong>{{ overview?.messages24h || 0 }}</strong></div>
                <div><span>Solicitudes pendientes</span><strong>{{ overview?.pendingFriendships || 0 }}</strong></div>
                <div><span>Notificaciones sin leer</span><strong>{{ overview?.unreadNotifications || 0 }}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'notifications'">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3"><strong>Notificaciones del sistema</strong></div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Estado</th>
                  <th class="text-end">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="notification in notificationsState.items" :key="notification.id">
                  <td>@{{ notification.username }}</td>
                  <td>{{ notification.type }}</td>
                  <td>{{ notification.title }}</td>
                  <td>
                    <span class="badge" :class="notification.isRead ? 'text-bg-light' : 'text-bg-dark'">
                      {{ notification.isRead ? "Leída" : "Pendiente" }}
                    </span>
                  </td>
                  <td class="text-end small text-secondary">{{ notification.createdAt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-white d-flex justify-content-between align-items-center">
            <small class="text-secondary">{{ notificationsState.total }} notificaciones</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="notificationsState.page <= 1" @click="changePage(notificationsState, notificationsState.page - 1, loadNotifications)">Anterior</button>
              <button class="btn btn-outline-secondary disabled">Página {{ notificationsState.page }} / {{ totalPages(notificationsState) }}</button>
              <button class="btn btn-outline-secondary" :disabled="notificationsState.page >= totalPages(notificationsState)" @click="changePage(notificationsState, notificationsState.page + 1, loadNotifications)">Siguiente</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'audit'">
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-white py-3"><strong>Auditoría administrativa</strong></div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Payload</th>
                  <th class="text-end">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in auditState.items" :key="log.id">
                  <td>@{{ log.adminUsername }}</td>
                  <td>{{ log.actionType }}</td>
                  <td>{{ log.entityType }}<span v-if="log.entityId"> #{{ log.entityId }}</span></td>
                  <td class="small admin-truncate">{{ log.payload ? JSON.stringify(log.payload) : "-" }}</td>
                  <td class="text-end small text-secondary">{{ log.createdAt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="card-footer bg-white d-flex justify-content-between align-items-center">
            <small class="text-secondary">{{ auditState.total }} eventos</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" :disabled="auditState.page <= 1" @click="changePage(auditState, auditState.page - 1, loadAuditLogs)">Anterior</button>
              <button class="btn btn-outline-secondary disabled">Página {{ auditState.page }} / {{ totalPages(auditState) }}</button>
              <button class="btn btn-outline-secondary" :disabled="auditState.page >= totalPages(auditState)" @click="changePage(auditState, auditState.page + 1, loadAuditLogs)">Siguiente</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </q-page>
</template>
