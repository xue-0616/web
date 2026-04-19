<script setup lang="ts">
import { ref } from "vue";

import { useSessionStore } from "@/stores/session";

const session = useSessionStore();
const email = ref("");

/**
 * Minimal unlock flow. Real implementation calls into
 * `@unipass/wallet-js` to open the Auth0 / zk-email flow and returns
 * the derived smart-account address.
 */
async function unlock() {
  if (!email.value) return;
  // TODO(phase6): call UniPass SDK here. The fake-unlock below lets
  // the scaffold boot so other views are reachable in dev.
  const fakeAddress = "0x" + "a".repeat(40);
  session.unlock({ address: fakeAddress, chainId: 1, email: email.value });
}
</script>

<template>
  <main style="max-width: 28rem;">
    <h1>Welcome to UniPass</h1>
    <p v-if="session.isUnlocked">
      Signed in as {{ session.email }} — <router-link to="/assets">view assets →</router-link>
    </p>
    <form v-else @submit.prevent="unlock">
      <label for="email" style="display: block; margin: 1rem 0 0.5rem;">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        required
        style="padding: 0.5rem 0.75rem; width: 100%; border: 1px solid #e5e7eb; border-radius: 0.5rem;"
      />
      <button
        type="submit"
        style="margin-top: 1rem; padding: 0.75rem 1rem; width: 100%; background: #6d28d9; color: white; border: none; border-radius: 0.5rem; font-weight: 600;"
      >
        Continue
      </button>
    </form>
  </main>
</template>
