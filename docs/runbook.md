# On-call runbook

One page per alert from `deploy/prometheus/alerts.yml`.  Designed
to be read at 3am; every section answers three questions in order:

1. **Did anything break?**  (How to know the alert is real vs
   a noise-floor blip.)
2. **What do I do *right now*?**  (Unbreak the user-facing side.)
3. **Why did it happen?**  (What to file a follow-up ticket about
   so we don't see it again.)

---

## farm-sequencer

### `FarmBatchAllFailed` (critical)

#### Did anything break?

Yes.  Every attempted batch in the last 10–15 minutes came back
`BuildError::InvalidInput` and got terminally marked `Failed` in
`farm_intents`.  **User LP tokens do not get stuck** — they stay
in their intent cells on chain — but no one's deposits /
withdrawals are processing.

Confirm:

```bash
kubectl exec deploy/mysql -- \
  mysql -u $MYSQL_USER -p$MYSQL_PASS farm \
  -e "SELECT status, COUNT(*) FROM farm_intents
      WHERE created_at > NOW() - INTERVAL 30 MINUTE
      GROUP BY status"
```

Expect `Failed` to dominate.  `error_reason` JSON column holds
the specific `InvalidInput` message from the builder.

#### What do I do right now?

1. **Gate the service off** so failed rows don't keep piling up:
   ```bash
   kubectl set env deploy/farm-sequencer FARM_PROCESSING_ENABLED=false
   ```
   Submit endpoint now returns 503 — clients back off, nothing
   new enters `Pending`.
2. **Roll back** the most recent farm-sequencer deploy if one
   landed in the last hour:
   ```bash
   kubectl rollout undo deploy/farm-sequencer
   ```

#### Why did it happen?

Almost always one of:

- A new `impl BatchTxBuilder` was deployed with a bug in its
  molecule parsing — the on-chain format shifted and the
  deserializer now rejects every pool cell.  **Fix:**
  correlate deploy time with alert firing time; if they match,
  revert.
- The submit endpoint started accepting inputs the builder
  can't handle.  **Fix:** the `build_stream_fields_round_trips_
  through_parse` test pattern doesn't exist for farm yet —
  file a ticket to add an equivalent guard between
  `check_farm_intent` and the builder's input contract.

---

### `FarmClaimRaceChronic` (warning)

#### Did anything break?

No user impact.  The scaffold's `claim()` returns affected=0
when another replica raced us — we just skip the batch and
try again next tick.  Alert fires because repeated zero-claim
means **two replicas are running with the same DB**.

Confirm:

```bash
kubectl get pods -l app=farm-sequencer
```

If you see >1 pod, that's the bug.  The atomic `WHERE
status=Pending` guard in `intent_state_machine::claim` means
even two racing replicas are safe from double-spend, but the
wasted work shows up here.

#### What do I do right now?

Scale to 1 replica:

```bash
kubectl scale deploy/farm-sequencer --replicas=1
```

#### Why did it happen?

Most likely a manual `kubectl scale` bumped replicas in a
canary / debugging session and was not reverted.  File a ticket
to add a Kustomize / Helm lock (`maxReplicas=1`) until HIGH-FM-3
part 2 (consumer-group-based sharding) lands — see
`docs/scaffold-design.md` §HIGH-FM-3 for what that would look
like.

---

### `FarmBatchBuildSlow` (warning)

#### Did anything break?

No user-visible breakage.  Users' intents take longer to land
on chain.  Alert's `for: 10m` means this is a sustained issue,
not a one-off.

#### What do I do right now?

1. Check CKB RPC latency — `curl -w '%{time_total}' $CKB_RPC_URL`.
   If >1s, escalate to CKB infra on-call.
2. Confirm `max_batch_size` env hasn't been bumped recently:
   ```bash
   kubectl get deploy/farm-sequencer -o yaml | grep -A1 MAX_BATCH
   ```
   If >50, roll back.  The scaffold tests pinned 50 as the safe
   default.

#### Why did it happen?

Usually a CKB RPC provider issue.  Less commonly, a pool with
thousands of pending intents got added and the batch query is
slow.  File a ticket to add a `farm_batch_select_duration_
seconds` histogram if the latter is the cause.

---

### `FarmProcessingStalled` (warning)

#### Did anything break?

Maybe.  No batches processed in 30m — could be legitimate
(FARM_PROCESSING_ENABLED=false, awaiting a deploy) or a dead
loop (pools-manager panicked and got swallowed by its
task-join).

Confirm:

```bash
kubectl get deploy/farm-sequencer -o yaml | grep FARM_PROCESSING_ENABLED
# expect: value: "true"

kubectl logs deploy/farm-sequencer --tail=200 | grep -iE "panic|pools-manager"
```

#### What do I do right now?

If the env is `false`, **silence the alert** — this is the
fail-closed posture and is expected pre-launch.  Add a
Prometheus silence with reason "FARM_PROCESSING_ENABLED=false,
pre-launch".

If the env is `true` but logs show a panic, restart:

```bash
kubectl rollout restart deploy/farm-sequencer
```

#### Why did it happen?

Task-join failures from downstream libraries that swallow
panics (sea-orm has been known to do this on connection-pool
exhaustion).  File a ticket to add a panic hook that
`std::process::abort()`s instead of silently continuing —
crash-and-restart is a better failure mode than silent stall.

---

## unipass-wallet-relayer

### `RelayerStreamBacklogGrowing` (critical)

#### Did anything break?

Yes, user-visible.  Meta-txs are accepted by `/transactions/
relay` (200 OK) but never reach the chain.  Users see "queued"
status forever.

Confirm:

```bash
# Current backlog size:
redis-cli XLEN relayer:tx_stream

# What's failing downstream (the root cause):
curl prometheus:9090/api/v1/query?query=\
  'sum by (result) (rate(relayer_entry_result_total[5m]))'
```

If `retain_transient` dominates → RPC issue.  If `retain_notimpl`
dominates → `RELAYER_CONSUMER_ENABLED=true` was flipped without
a real broadcaster (expected during MED-RL-3 rollout; silence).
If `retain_` in general dominates but neither of the above,
inspect individual entries via `redis-cli XRANGE relayer:
tx_stream - + COUNT 10`.

#### What do I do right now?

1. If this is the MED-RL-3 rollout and `retain_notimpl` is
   the cause, **silence the alert** — you're expected to see
   the backlog pile up while the Noop broadcaster is wired.
2. If `retain_transient` dominates, fail over RPC:
   ```bash
   kubectl set env deploy/relayer \
     ETH_RPC_URL_1=$BACKUP_RPC_URL
   ```
3. **Do NOT manually XACK or XDEL entries** — every entry is
   a user's signed tx.  Dropping them would replay-protect the
   nonces but lose the user's intent.

#### Why did it happen?

Almost always an upstream Ethereum RPC provider incident.
Less commonly, the consumer loop has a bug that stalls on a
particular entry shape.  `RelayerConsumerDead` would fire in
parallel if that's the cause — escalate to `kubectl rollout
restart`.

---

### `RelayerPoisonedEntries` (warning)

#### Did anything break?

One or more user txs were XACKed with `poisoned` reason — lost.
These users will see their tx stuck at "queued" forever.

#### What do I do right now?

1. Identify the lost entries:
   ```bash
   kubectl logs deploy/relayer --tail=500 | \
     grep -i 'ack_poisoned\|InvalidInput'
   ```
2. Contact the affected users (the log lines include `wallet`
   and `stream_id`) and ask them to resubmit.
3. **If** the poisoned entries all share the same wallet: a
   malicious producer may be writing to the stream directly.
   Check for XADD operations not coming from the relayer pod
   IP:
   ```bash
   redis-cli MONITOR | grep XADD
   ```

#### Why did it happen?

`parse_stream_entry` should **never** reject an entry written
by our own submit handler — the
`build_stream_fields_round_trips_through_parse` test proves
round-trip round-trip safety.  A poisoned entry therefore
means one of:

- Someone bypassed CI and deployed a build where the producer
  and consumer schemas drifted.  Roll back.
- A non-sanctioned process has XADD access to the stream.
  Rotate Redis auth credentials.

---

### `RelayerTransientSustained` (warning)

Same root cause as `RelayerStreamBacklogGrowing` with
`retain_transient` dominant.  Action: fail over RPC.  If no
backup RPC is configured, file an urgent ticket — this is a
single-point-of-failure and will cause a critical the next
time the primary provider has an incident.

---

### `RelayerConsumerDead` (critical)

Backlog is growing AND no results are being produced → the
consumer task is wedged (panicked, deadlocked, or stuck on a
blocking call).

```bash
kubectl rollout restart deploy/relayer
```

File a post-mortem ticket — silent consumer death is a
class-of-bug we want to make impossible via a per-tick
watchdog.  See MED-RL-3 scaffold-design.md §consumer for
where such a watchdog would hook in.

---

## Generic

### `ServiceDown`

Prometheus can't scrape.  Either CrashLoopBackOff, evicted,
or node-down.

```bash
kubectl get pods -l app=<service>
kubectl describe pod <name>
kubectl logs <name> --previous
```

### `HighHttpErrorRate`

5xx > 5% for 10m.  Usually a dependency (DB, Redis, RPC) just
failed — check `/readyz` on the affected service to see which
dep it thinks is unhealthy:

```bash
kubectl port-forward svc/<service> 8080:80 &
curl localhost:8080/readyz
```
