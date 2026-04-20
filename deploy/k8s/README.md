# Kubernetes manifests

Minimal, reviewable manifests for the two services whose scaffold
lives on `origin/main`.  Not a Helm chart — just the smallest set
of resources a cluster needs to run these pods safely.

```
deploy/k8s/
├── README.md                     <- this file
├── namespace.yaml                <- one namespace for both services
├── farm-sequencer.yaml           <- Deployment + Service + ConfigMap + PDB
├── unipass-wallet-relayer.yaml   <- Deployment + Service + ConfigMap + PDB
├── secrets.example.yaml          <- documents the required Secrets
└── servicemonitor.yaml           <- Prometheus Operator scrape config
```

## Before applying

1. **Create the real Secrets** (never commit these):

   ```bash
   kubectl create secret generic farm-sequencer-secrets \
     --namespace=huehub-backend \
     --from-literal=DATABASE_URL='mysql://user:pass@mysql/farm' \
     --from-literal=JWT_SECRET="$(openssl rand -hex 32)"

   kubectl create secret generic relayer-secrets \
     --namespace=huehub-backend \
     --from-literal=DATABASE_URL='mysql://user:pass@mysql/relayer' \
     --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
     --from-literal=KEYBLOB_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
     --from-literal=RELAYER_PRIVATE_KEY='0x...'  # from HSM/Vault
   ```

   Better: use SealedSecrets / External Secrets Operator /
   Vault-injector.  `secrets.example.yaml` documents the exact
   keys each service expects; don't drift from that.

2. **Push the images** (referenced in the manifests as
   `ghcr.io/huehub/<service>:<version>` — change the registry
   to your own).

3. **Validate before applying**:

   ```bash
   kubectl apply --dry-run=client -f deploy/k8s/
   ```

## Design choices documented

* **`replicas: 1` on farm-sequencer.**  HIGH-FM-3's atomic claim
  is safe against racing replicas (the `FarmClaimRaceChronic`
  alert would catch a chronic race), but wasted work is still
  work.  Keep it to 1 until the consumer-group-sharded variant
  ships.  The `FarmProcessingStalled` alert plus the liveness
  probe keep availability roughly equivalent to a hot-standby.

* **`replicas: 2` on relayer.**  The consumer loop reads via
  `XREADGROUP` with distinct consumer names (pod name as the
  Redis consumer id — scaffold will wire this when the real
  consume_once lands).  Until then, both replicas just observe
  `XLEN`; the `MaxUnavailable: 0` PDB prevents drains from
  taking both at once.

* **`readinessProbe: /readyz`, `livenessProbe: /health`.**
  Both endpoints are implemented in the service already.
  `/readyz` aggregates downstream deps (DB, Redis); a failed
  readinessProbe removes the pod from Service endpoints so
  traffic drains gracefully.  `/health` is a cheap process-
  liveness check.

* **`resources.requests` set but no `limits.cpu`.**  CPU limits
  cause throttling pain with tokio's work-stealing runtime; we
  set `limits.memory` to prevent OOM, and let CPU burst.

* **`securityContext` is non-root + read-only FS + no privileged.**
  The service images don't need to write to disk (logs go to
  stdout).  If a future feature needs scratch space, add
  `emptyDir` volume rather than relaxing the root-FS lock.

* **`envFrom.secretRef`** instead of `env[].valueFrom`.  Adding
  a new secret key doesn't require editing the Deployment —
  just update the Secret and rollout-restart.

## Observability integration

`servicemonitor.yaml` configures Prometheus Operator to scrape
`/metrics` on port 8080 every 30s.  Paired with
`deploy/prometheus/alerts.yml`, this brings up the full SLO
dashboard as soon as both are applied.

## What this doesn't cover

* **Ingress / TLS**.  Add a `huehub-backend-ingress.yaml` with
  your cluster's IngressClass (cert-manager ACME, or
  externally-managed certificates).  The services speak plain
  HTTP; TLS terminates at the Ingress.
* **DB / Redis**.  Assumed already running.  The manifests
  reference them by Kubernetes Service DNS (`mysql.storage.svc`,
  `redis.storage.svc`); adjust to your topology.
* **HorizontalPodAutoscaler**.  Neither service is a good HPA
  target yet — farm-sequencer is pinned at 1 replica; relayer's
  consumer is bottlenecked on RPC latency, not CPU.  Add HPA
  after MED-RL-3 part 3 (the real broadcaster) lands, when
  scaling actually helps.
