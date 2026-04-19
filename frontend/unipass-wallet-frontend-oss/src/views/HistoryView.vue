<script setup lang="ts">
import { onMounted, ref } from "vue";

import { shortAddr } from "@/lib/format";
import { useSessionStore } from "@/stores/session";

interface TxRow {
  hash: string;
  to: string;
  timestamp: number;
  status: "pending" | "success" | "failed";
}

const session = useSessionStore();
const rows = ref<TxRow[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

onMounted(async () => {
  if (!session.address) return;
  loading.value = true;
  try {
    const r = await fetch(`/api/tx-history/${session.address}?chain=${session.chainId}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    rows.value = (await r.json()) as TxRow[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "unknown";
  } finally {
    loading.value = false;
  }
});

function statusColor(s: TxRow["status"]): string {
  return s === "success" ? "#16a34a" : s === "failed" ? "#dc2626" : "#6b7280";
}
</script>

<template>
  <main>
    <h1>History</h1>
    <p v-if="loading">Loading…</p>
    <p v-else-if="error" role="alert" style="color: #dc2626;">{{ error }}</p>
    <p v-else-if="rows.length === 0" style="color: #6b7280;">No transactions yet.</p>
    <table v-else style="width: 100%; border-collapse: collapse;">
      <thead><tr style="text-align: left;"><th>Hash</th><th>To</th><th>Status</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.hash" style="border-top: 1px solid #e5e7eb;">
          <td style="font-family: monospace;">{{ shortAddr(r.hash) }}</td>
          <td>{{ shortAddr(r.to) }}</td>
          <td :style="{ color: statusColor(r.status) }">{{ r.status }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>
