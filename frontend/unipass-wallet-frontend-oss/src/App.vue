<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink> |
    <RouterLink to="/assets">Assets</RouterLink> |
    <RouterLink to="/history">History</RouterLink>
  </nav>
  <RouterView />
</template>
