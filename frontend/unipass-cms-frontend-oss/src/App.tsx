import { Admin, Resource, ListGuesser, EditGuesser } from "react-admin";

import { buildAuthProvider, permissionsFor, type Role } from "./lib/auth";
import { buildDataProvider } from "./lib/dataProvider";

const API_URL = import.meta.env.VITE_CMS_API_URL ?? "http://localhost:3000/api";

const backend = {
  async login(username: string, password: string) {
    const r = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error("login_failed");
    const body = (await r.json()) as { token: string; role: Role };
    return body;
  },
};

const authProvider = buildAuthProvider(backend);
const dataProvider = buildDataProvider(API_URL);

export function App() {
  return (
    <Admin dataProvider={dataProvider} authProvider={authProvider}>
      {(permissions: Role) => (
        <>
          <Resource
            name="users"
            list={permissionsFor(permissions, "users").has("list") ? ListGuesser : undefined}
            edit={permissionsFor(permissions, "users").has("edit") ? EditGuesser : undefined}
          />
          <Resource
            name="transactions"
            list={permissionsFor(permissions, "transactions").has("list") ? ListGuesser : undefined}
            edit={permissionsFor(permissions, "transactions").has("edit") ? EditGuesser : undefined}
          />
          <Resource
            name="tokens"
            list={permissionsFor(permissions, "tokens").has("list") ? ListGuesser : undefined}
            edit={permissionsFor(permissions, "tokens").has("edit") ? EditGuesser : undefined}
          />
        </>
      )}
    </Admin>
  );
}
