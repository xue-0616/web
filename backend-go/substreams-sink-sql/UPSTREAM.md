# Origin

Copied from `upstream/substreams-sink-sql/` which is
[`streamingfast/substreams-sink-sql`](https://github.com/streamingfast/substreams-sink-sql).
This is the **canonical open-source project** — the deployed binary is a
plain build of this repository, no UniPass/HueHub fork involved.

## Seed revision

- Upstream branch: `develop`
- Seed commit: `c05b15e` — "Preparing release v4.13.1"
- So this seed tracks **v4.13.1** (or very close).

## Replaces deployed binary

`backend-bin/dexauto-data-center/substreams-sink-sql` — 67 MB Go binary,
built with `go1.22.10`, `mod path = github.com/streamingfast/substreams-sink-sql`.

Because this binary is a direct build of the open-source project (no
proprietary fork exists), rebuilding from this tree is trivial: the only
unknown is the **exact version tag** the deployed binary was built from.
If you need pin-point version parity, pick the closest tag by diffing
`CHANGELOG.md` against features/bugs observed in production.

## Build

```bash
go build -o substreams-sink-sql ./cmd/substreams-sink-sql
./substreams-sink-sql --help
```

## Typical usage (HueHub deployment)

The deployed binary consumes `backend-bin/dexauto-data-center/*.spkg`
(TopLedger's `solana-dex-trades-extended` or similar) and sinks into a
PostgreSQL schema matching `backend-bin/dexauto-data-center/schema.sql`.

Example:

```bash
./substreams-sink-sql run \
  "psql://user:pass@host:5432/db?sslmode=disable" \
  ./solana-dex-trades-extended-vX.Y.Z.spkg \
  map_dex_trades
```

## Maintainer notes

- StreamingFast ships frequent releases; keep this tree within one minor
  version of `develop` unless a breaking change lands.
- Local patches (none yet):
