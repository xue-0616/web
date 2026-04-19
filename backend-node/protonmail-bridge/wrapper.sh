#!/bin/sh
/usr/bin/checkAppend /usr/bin/dockerd
/usr/bin/dockerd
exec "bash" "/protonmail/entrypoint.sh"  "$@"
