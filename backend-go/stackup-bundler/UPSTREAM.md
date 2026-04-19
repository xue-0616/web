# Origin

Copied from `upstream/stackup-bundler/` which is
[`UniPassID/stackup-bundler`](https://github.com/UniPassID/stackup-bundler)
(a fork of the canonical
[`stackup-wallet/stackup-bundler`](https://github.com/stackup-wallet/stackup-bundler)).

## Seed revision

- Upstream branch: `main`
- Seed commit: `ee65197` — "Reject userOp if sigFailed is true during simulation (#120)"
- Seed date: when the `upstream/` shallow clone was last pulled

## Replaces deployed binary

`backend-bin/stackup-bundler/stackup-bundler` — 26 MB Go binary, built with
`go1.19.7`, `mod path = github.com/stackup-wallet/stackup-bundler` (module
name preserved by the fork).

The deployed binary's exact commit is unknown (`go version -m` shows
`(devel)` — it was built without a tag). Before redeploying, diff the
exported symbols of a freshly-built binary against the deployed one
(see `backend-go/README.md` § Verifying against the deployed binary).

## Build

```bash
go build -o bundler .
./bundler --help
```

Matches the deployed ELF's command-line interface.

## Run (example)

```bash
export ERC4337_BUNDLER_ETH_CLIENT_URL=https://rpc.example.com
export ERC4337_BUNDLER_PRIVATE_KEY=0x…
./bundler start --mode=private
```

See `README.md` (upstream) for the full env-var surface.

## Maintainer notes

- If you patch locally, document the patch at the bottom of this file
  (date, intent, files touched) so the next person can reason about
  drift from upstream.
- Local patches (none yet):
