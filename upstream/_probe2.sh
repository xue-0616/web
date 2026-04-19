#!/usr/bin/env bash
set -e
> upstream/_probe.tsv
while IFS='|' read -r name url; do
  case "$name" in '#'*|'') continue ;; esac
  if [ -z "$url" ]; then
    printf '%s\tNONE\t-\n' "$name" >> upstream/_probe.tsv
    continue
  fi
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 -L "${url%.git}" 2>/dev/null || echo "000")
  printf '%s\t%s\t%s\n' "$name" "$code" "$url" >> upstream/_probe.tsv
done < upstream/_candidates.txt
column -t -s $'\t' upstream/_probe.tsv
