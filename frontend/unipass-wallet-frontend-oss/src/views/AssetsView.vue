<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { chainLabel, formatAmount, shortAddr } from "@/lib/format";
import { filterAssets, sortAssets, useAssetsStore, type Asset, type AssetsProvider } from "@/stores/assets";
import { useSessionStore } from "@/stores/session";

/**
 * Main asset list. Currently uses a stub `AssetsProvider` that reads
 * `/api/assets/:address` from the host app's backend. Swap in the
 * real `@unipass/wallet-js` indexer client when linked.
 */
const stubProvider: AssetsProvider = {
  async fetchAll(address) {
    const r = await fetch(`/api/assets/${address}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as Asset[];
  },
};

const session = useSessionStore();
const assets = useAssetsStore();
const query = ref("");

onMounted(() => {
  if (session.address) assets.load(stubProvider, session.address);
});

const visible = computed(() => {
  const chainFiltered = filterAssets(assets.all, session.chainId, query.value);
  return sortAssets(chainFiltered);
});
</script>

<template>
  <main>
    <h1>Assets</h1>
    <p v-if="session.address" style="color: #6b7280;">
      {{ shortAddr(session.address) }} · {{ chainLabel(session.chainId) }}
    </p>
    <p v-else style="color: #dc2626;">Wallet locked. <router-link to="/">Unlock</router-link></p>

    <div style="margin: 1rem 0;">
      <input
        v-model="query"
        type="search"
        placeholder="Search by symbol"
        aria-label="Search assets"
        style="padding: 0.5rem 0.75rem; width: 100%; max-width: 24rem; border: 1px solid #e5e7eb; border-radius: 0.5rem;"
      />
    </div>

    <p v-if="assets.loading">Loading…</p>
    <p v-else-if="assets.error" role="alert" style="color: #dc2626;">{{ assets.error }}</p>
    <p v-else-if="visible.length === 0" style="color: #6b7280;">No assets.</p>

    <ul v-else style="list-style: none; padding: 0;">
      <li
        v-for="a in visible"
        :key="`${a.chainId}:${a.token ?? 'native'}`"
        style="display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #e5e7eb;"
      >
        <span><strong>{{ a.symbol }}</strong></span>
        <span>{{ formatAmount(a.balanceSmallest, a.decimals) }}</span>
      </li>
    </ul>
  </main>
</template>
