import { defineStore } from "pinia";

/**
 * Active-wallet session store.
 *
 * Invariant: either `address` is null (locked) or it's a valid
 * `0x…` 20-byte hex. `chainId` reflects the chain selected in the
 * current session.
 */
export const useSessionStore = defineStore("session", {
  state: () => ({
    address: null as string | null,
    chainId: 1 as number,
    email: null as string | null,
    // Last time the user was seen active. Useful for auto-lock logic.
    lastActivityMs: 0 as number,
  }),
  getters: {
    isUnlocked: (s) => s.address !== null,
  },
  actions: {
    unlock(payload: { address: string; chainId: number; email?: string | null }) {
      this.address = payload.address.toLowerCase();
      this.chainId = payload.chainId;
      this.email = payload.email ?? this.email;
      this.lastActivityMs = Date.now();
    },
    lock() {
      this.address = null;
      // Preserve `email` so the unlock UI can show "welcome back, X".
    },
    touch() {
      this.lastActivityMs = Date.now();
    },
    setChain(id: number) {
      this.chainId = id;
    },
  },
});

/**
 * Pure idle check — exposed for unit tests so we don't need fake timers
 * to assert auto-lock behaviour.
 */
export function shouldAutoLock(lastActivityMs: number, nowMs: number, idleMs: number): boolean {
  return lastActivityMs > 0 && nowMs - lastActivityMs >= idleMs;
}
