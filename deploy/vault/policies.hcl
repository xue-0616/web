# HashiCorp Vault policies for the two services.
#
# Apply with:
#   vault policy write farm-sequencer   deploy/vault/policies.hcl
#   vault policy write relayer          deploy/vault/policies.hcl
# (each service reads only its own policy section via a separate
# Vault role bound to its ServiceAccount.)
#
# Pair with vault-agent-injector sidecar annotations on the
# Deployments — see deploy/k8s/*.yaml's annotations: block for
# the `vault.hashicorp.com/agent-*` keys to add when switching
# from kubectl Secrets to Vault-injected Secrets.
#
# -- If you're on AWS SSM / Google Secret Manager / Doppler --
# Use External Secrets Operator instead; the schema of what
# lives where is in deploy/k8s/secrets.example.yaml.  Vault is
# documented here because it's the default for self-hosted
# clusters.

# =======================================================================
# farm-sequencer
# =======================================================================
path "secret/data/huehub-backend/farm-sequencer/*" {
  capabilities = ["read"]
}

# Admin keys are derived from a Transit engine so the actual
# secp256k1 keys never touch the pod filesystem — the app
# requests sign operations via the Transit API.  Optional; flip
# once we wire the relayer's SecurePrivateKey to use it.
path "transit/sign/farm-admin" {
  capabilities = ["update"]
}

# =======================================================================
# relayer
# =======================================================================
path "secret/data/huehub-backend/relayer/*" {
  capabilities = ["read"]
}

# The relayer's EOA private key should live under a Transit key
# and sign-via-API, not be read into process memory.  When the
# real EthersBroadcaster lands (MED-RL-3 eth-broadcaster starter
# PR), wire it to call vault.transit.sign() instead of holding
# a LocalWallet.
path "transit/sign/relayer-eoa" {
  capabilities = ["update"]
}

# Dynamic DB credentials — the app's DB user is issued on-demand
# with a short TTL (e.g. 1h), rotated automatically.  Enable via:
#   vault secrets enable database
#   vault write database/config/huehub-mysql plugin_name=mysql-database-plugin ...
path "database/creds/huehub-mysql" {
  capabilities = ["read"]
}
