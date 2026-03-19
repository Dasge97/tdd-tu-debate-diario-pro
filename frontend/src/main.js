import { createApp } from "vue";
import { createPinia } from "pinia";
import { Quasar } from "quasar";
import {
  QLayout,
  QHeader,
  QToolbar,
  QBtn,
  QToolbarTitle,
  QInput,
  QIcon,
  QDrawer,
  QList,
  QItem,
  QItemLabel,
  QItemSection,
  QPageContainer,
  QDialog,
  QCard,
  QCardSection,
  QCardActions,
  QPage,
  QBanner,
  QSkeleton,
  QLinearProgress,
  QBtnToggle,
  QChip,
  QSelect,
  QAvatar,
  QFile,
  QPagination,
  QMenu,
  QBadge,
  QSeparator
} from "quasar";
import { Ripple, ClosePopup } from "quasar";
import { router } from "@/router";
import { runBoot } from "@/boot";
import App from "./App.vue";

import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/bitter/latin-500.css";
import "@fontsource/bitter/latin-700.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "quasar/src/css/index.sass";
import "@quasar/extras/material-icons/material-icons.css";
import "./css/app.scss";

const app = createApp(App);
const pinia = createPinia();

app.use(Quasar, {
  plugins: {},
  components: {
    QLayout,
    QHeader,
    QToolbar,
    QBtn,
    QToolbarTitle,
    QInput,
    QIcon,
    QDrawer,
    QList,
    QItem,
    QItemLabel,
    QItemSection,
    QPageContainer,
    QDialog,
    QCard,
    QCardSection,
    QCardActions,
    QPage,
    QBanner,
    QSkeleton,
    QLinearProgress,
    QBtnToggle,
    QChip,
    QSelect,
    QAvatar,
    QFile,
    QPagination,
    QMenu,
    QBadge,
    QSeparator
  },
  directives: {
    Ripple,
    ClosePopup
  }
});
app.use(pinia);
app.use(router);

runBoot({ app, pinia, router });

app.mount("#app");
