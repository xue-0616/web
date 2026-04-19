import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

import "./design/tokens.css";
import App from "./App.vue";
import HomeView from "./views/HomeView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomeView },
    { path: "/assets", component: () => import("./views/AssetsView.vue") },
    { path: "/history", component: () => import("./views/HistoryView.vue") },
  ],
});

createApp(App).use(createPinia()).use(router).mount("#app");
