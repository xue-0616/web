#!/usr/bin/env bash
# Probe each candidate URL with curl HEAD (HTTPS GitHub returns 200/301 if exists, 404 if not).
> upstream/_probe.tsv
while IFS='|' read -r name url note; do
  [[ "$name" =~ ^# ]] && continue
  [[ -z "$name" ]] && continue
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 6 -L -I "${url%.git}" 2>/dev/null || echo "000")
  printf '%-32s %-3s %s\n' "$name" "$code" "$url" | tee -a upstream/_probe.tsv
done < upstream/_candidates.txt
