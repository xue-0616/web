import { describe, expect, it, vi } from "vitest";

import {
  buildAuthProvider,
  isValidRole,
  permissionsFor,
  ROLE_KEY,
  TOKEN_KEY,
} from "./auth";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    _dump: () => Object.fromEntries(m),
  };
}

describe("isValidRole", () => {
  it.each(["admin", "operator", "viewer"])("accepts %s", (r) => {
    expect(isValidRole(r)).toBe(true);
  });
  it.each(["root", "", null, undefined, 42, {}])("rejects %j", (v) => {
    expect(isValidRole(v)).toBe(false);
  });
});

describe("permissionsFor", () => {
  it("admin gets CRUD on everything", () => {
    const p = permissionsFor("admin", "users");
    expect(p.has("list")).toBe(true);
    expect(p.has("create")).toBe(true);
    expect(p.has("edit")).toBe(true);
    expect(p.has("delete")).toBe(true);
  });
  it("operator cannot delete", () => {
    const p = permissionsFor("operator", "users");
    expect(p.has("delete")).toBe(false);
    expect(p.has("list")).toBe(true);
  });
  it("operator can only read tokens", () => {
    const p = permissionsFor("operator", "tokens");
    expect(p.has("list")).toBe(true);
    expect(p.has("create")).toBe(false);
    expect(p.has("edit")).toBe(false);
  });
  it("viewer is always read-only", () => {
    for (const r of ["users", "transactions", "tokens"]) {
      const p = permissionsFor("viewer", r);
      expect(Array.from(p)).toEqual(["list"]);
    }
  });
});

describe("buildAuthProvider", () => {
  const mkBackend = (fn: (u: string, p: string) => Promise<{ token: string; role: "admin" | "operator" | "viewer" }>) => ({
    login: vi.fn(fn),
  });

  it("login stores token + role", async () => {
    const storage = memoryStorage();
    const backend = mkBackend(async () => ({ token: "T123", role: "admin" as const }));
    const ap = buildAuthProvider(backend, storage);
    await ap.login!({ username: "u", password: "p" });
    expect(storage.getItem(TOKEN_KEY)).toBe("T123");
    expect(storage.getItem(ROLE_KEY)).toBe("admin");
    expect(backend.login).toHaveBeenCalledWith("u", "p");
  });

  it("logout clears storage", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, "x");
    storage.setItem(ROLE_KEY, "admin");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    await ap.logout!({});
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(storage.getItem(ROLE_KEY)).toBeNull();
  });

  it("checkAuth rejects when no token", async () => {
    const storage = memoryStorage();
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    await expect(ap.checkAuth!({})).rejects.toThrow(/unauth/);
  });

  it("checkAuth resolves when token present", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, "T");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    await expect(ap.checkAuth!({})).resolves.toBeUndefined();
  });

  it("checkError clears session on 401/403", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, "T");
    storage.setItem(ROLE_KEY, "admin");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    await expect(ap.checkError!({ status: 401 })).rejects.toThrow();
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("checkError ignores non-auth errors", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, "T");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    await expect(ap.checkError!({ status: 500 })).resolves.toBeUndefined();
    expect(storage.getItem(TOKEN_KEY)).toBe("T"); // not cleared
  });

  it("getPermissions falls back to viewer on garbage", async () => {
    const storage = memoryStorage();
    storage.setItem(ROLE_KEY, "root");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    expect(await ap.getPermissions!({})).toBe("viewer");
  });

  it("getPermissions returns stored role", async () => {
    const storage = memoryStorage();
    storage.setItem(ROLE_KEY, "operator");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    expect(await ap.getPermissions!({})).toBe("operator");
  });

  it("getIdentity exposes role", async () => {
    const storage = memoryStorage();
    storage.setItem(ROLE_KEY, "admin");
    const ap = buildAuthProvider(mkBackend(async () => ({ token: "", role: "viewer" })), storage);
    const id = await ap.getIdentity!();
    expect(id).toEqual({ id: "admin", fullName: "admin" });
  });
});
