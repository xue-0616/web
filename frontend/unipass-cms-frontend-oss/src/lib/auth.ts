/**
 * JWT-based `authProvider` for react-admin.
 *
 * Login flow:
 *   1. POST {username, password} → /api/admin/login
 *   2. Response: { token, role }
 *   3. Token is stored in localStorage and sent as `Authorization:
 *      Bearer <token>` on every subsequent request (the `dataProvider`
 *      built below honours it).
 *
 * Permission model (recovered by convention from typical ops CMS's):
 *   * `admin`    — full CRUD
 *   * `operator` — CRUD on users + transactions; read-only on tokens
 *   * `viewer`   — read-only everywhere
 */

import type { AuthProvider } from "react-admin";

const TOKEN_KEY = "unipass.cms.token";
const ROLE_KEY = "unipass.cms.role";

export type Role = "admin" | "operator" | "viewer";

const ROLES: Role[] = ["admin", "operator", "viewer"];

export function isValidRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

export interface AuthBackend {
  login(username: string, password: string): Promise<{ token: string; role: Role }>;
}

/** Permission set a role is allowed on a given resource. */
export function permissionsFor(role: Role, resource: string): ReadonlySet<"list" | "create" | "edit" | "delete"> {
  if (role === "admin") return new Set(["list", "create", "edit", "delete"]);
  if (role === "operator") {
    if (resource === "tokens") return new Set(["list"]);
    return new Set(["list", "create", "edit"]);
  }
  return new Set(["list"]);
}

/** Build a react-admin authProvider against an injected backend. */
export function buildAuthProvider(
  backend: AuthBackend,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
): AuthProvider {
  return {
    async login({ username, password }: { username: string; password: string }) {
      const { token, role } = await backend.login(username, password);
      storage.setItem(TOKEN_KEY, token);
      storage.setItem(ROLE_KEY, role);
    },
    async logout() {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(ROLE_KEY);
    },
    async checkAuth() {
      if (!storage.getItem(TOKEN_KEY)) throw new Error("unauthenticated");
    },
    async checkError(error: unknown) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 401 || status === 403) {
        storage.removeItem(TOKEN_KEY);
        storage.removeItem(ROLE_KEY);
        throw new Error("session expired");
      }
    },
    async getPermissions() {
      const raw = storage.getItem(ROLE_KEY);
      return isValidRole(raw) ? raw : "viewer";
    },
    async getIdentity() {
      // Real backend would expose a /me endpoint; we return the role
      // as the display name so the CMS UI still shows *something*.
      const raw = storage.getItem(ROLE_KEY);
      const role = isValidRole(raw) ? raw : "viewer";
      return { id: role, fullName: role };
    },
  };
}

export { TOKEN_KEY, ROLE_KEY };
