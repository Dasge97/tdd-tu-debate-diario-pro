import MainLayout from "@/layouts/MainLayout.vue";
import HomePage from "@/pages/HomePage.vue";
import DebatePage from "@/pages/DebatePage.vue";
import SearchPage from "@/pages/SearchPage.vue";
import FavoritesPage from "@/pages/FavoritesPage.vue";
import TrendingPage from "@/pages/TrendingPage.vue";
import FriendsPage from "@/pages/FriendsPage.vue";
import ProfilePage from "@/pages/ProfilePage.vue";
import ProposeDebatePage from "@/pages/ProposeDebatePage.vue";
import CommunityPage from "@/pages/CommunityPage.vue";
import AdminPage from "@/pages/AdminPage.vue";

export const routes = [
  {
    path: "/",
    component: MainLayout,
    children: [
      { path: "", name: "home", component: HomePage },
      { path: "debate/:id", name: "debate", component: DebatePage, props: true },
      { path: "buscar", name: "buscar", component: SearchPage },
      { path: "favoritos", name: "favoritos", component: FavoritesPage },
      { path: "tendencias", name: "tendencias", component: TrendingPage },
      { path: "comunidad", name: "comunidad", component: CommunityPage },
      { path: "amigos", name: "amigos", component: FriendsPage },
      { path: "proponer-debate", name: "proponer-debate", component: ProposeDebatePage },
      { path: "perfil/:username", name: "perfil", component: ProfilePage, props: true },
      { path: "admin", name: "admin", component: AdminPage, meta: { requiresAdmin: true } }
    ]
  }
];
