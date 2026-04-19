# `backend-go/` — Go services from open-source upstreams

This tree holds the **maintainable source code** for the closed-source Go
binaries that used to live only under `backend-bin/` as deployed ELFs.

Each subdirectory is a *direct copy* of an open-source upstream (no local
modifications at seed time, see each project's `UPSTREAM.md`). Going
forward any local patches live here and are diffed against the upstream
repo in `upstream/<name>/`.

## Layout

| Directory | Replaces `backend-bin/` | Upstream |
|---|---|---|
| `stackup-bundler/`     | `stackup-bundler/stackup-bundler`                       | [`UniPassID/stackup-bundler`](https://github.com/UniPassID/stackup-bundler) |
| `substreams-sink-sql/` | `dexauto-data-center/substreams-sink-sql`               | [`streamingfast/substreams-sink-sql`](https://github.com/streamingfast/substreams-sink-sql) |

## Build convention

Every sub-project must answer `go build ./...` cleanly. The repo-level CI
script can exercise all of them:

```bash
scripts/ci-check.sh go        # (once the 'go' mode is added)
# or:
for d in backend-go/*/; do (cd "$d" && go build ./...); done
```

## Updating from upstream

```bash
NAME=stackup-bundler
# Pull the latest upstream state into the reference tree
git -C upstream/$NAME pull --ff-only
# Preview what would change in the working tree
diff -r --brief upstream/$NAME backend-go/$NAME | grep -v .git
# Apply (after reviewing)
rsync -a --delete --exclude='.git' --exclude='.github' \
      upstream/$NAME/ backend-go/$NAME/
# Commit the sync + any local patches that had to be reapplied
```

## Verifying against the deployed binary

The deployed ELFs under `backend-bin/` were compiled from specific (often
unknown) commits of these upstreams. Before overwriting a production
deployment, run a bytewise-agnostic differential check:

```bash
NAME=stackup-bundler
# Exported symbols
go tool nm -sort=name backend-bin/$NAME/$NAME | awk '{print $3}' | sort -u > /tmp/deployed.syms
# Build a fresh binary from source
(cd backend-go/$NAME && go build -o /tmp/rebuilt ./cmd/...)  # path varies per project
go tool nm -sort=name /tmp/rebuilt | awk '{print $3}' | sort -u > /tmp/rebuilt.syms
# Anything in the deployed binary not in ours is a missing feature/patch
diff /tmp/deployed.syms /tmp/rebuilt.syms | head -40
```
