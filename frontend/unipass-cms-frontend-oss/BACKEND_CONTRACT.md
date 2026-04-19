# CMS Backend Contract

`unipass-cms-frontend-oss` expects a REST backend that speaks the
**`ra-data-simple-rest`** dialect (the default react-admin convention).
This document captures the exact shape so any backend team can wire it up
without reading react-admin source.

Base URL comes from `VITE_CMS_API_URL` (defaults to `http://localhost:3000/api`).

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/admin/login` | none | `{username, password}` | `{token, role}` where `role ∈ {admin, operator, viewer}` |

All subsequent requests carry `Authorization: Bearer <token>`.
On 401/403 the frontend clears the session and redirects to the login screen.

## CRUD convention (per resource)

For each resource `<name>` ∈ {`users`, `transactions`, `tokens`}:

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET  | `/<name>?sort=...&range=...&filter=...` | list page | `[Record, …]` + `Content-Range` header |
| GET  | `/<name>/:id` | detail | `Record` |
| POST | `/<name>` | create | `Record` (with server-assigned id) |
| PUT  | `/<name>/:id` | full update | `Record` |
| DELETE | `/<name>/:id` | delete | `{}` or `204` |

**Mandatory `Content-Range` header** on list responses:
```
Content-Range: <name> 0-9/100
```
react-admin uses it to compute pagination; omit → infinite scroll breaks.

**Record shape**: `{ "id": string | number, …fields }`. The `id` field is
mandatory and unique.

### Query params (list)

| Param | Format | Example |
|---|---|---|
| `sort` | `["<field>", "<"ASC"|"DESC">"]` | `["createdAt","DESC"]` |
| `range` | `[start, end]` (inclusive) | `[0,9]` |
| `filter` | object, JSON-encoded | `{"status":"active"}` |

These are URL-encoded JSON strings per `ra-data-simple-rest`.

## Permission model

Enforced on the **backend** — the frontend merely hides UI. Expected
server-side checks:

| Role | `users` | `transactions` | `tokens` |
|---|---|---|---|
| admin    | CRUD | CRUD | CRUD |
| operator | list/create/edit, NO delete | list/create/edit, NO delete | list only |
| viewer   | list only | list only | list only |

See `src/lib/auth.ts::permissionsFor` for the canonical matrix + the
24-assertion test that locks it in.

## Smoke test

```bash
curl -X POST http://localhost:3000/api/admin/login \
     -H 'content-type: application/json' \
     -d '{"username":"admin","password":"admin"}'
# expect: {"token":"…","role":"admin"}

curl -H "Authorization: Bearer <token>" \
     'http://localhost:3000/api/users?range=[0,9]&sort=["id","ASC"]'
# expect: 200 + `Content-Range: users 0-9/N`
```
