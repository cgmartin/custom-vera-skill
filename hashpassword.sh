#!/bin/bash
set -e
command -v openssl >/dev/null 2>&1 || { echo >&2 "I require openssl but it's not installed.  Aborting."; exit 1; }

# Pre-computes a SHA1 hash for storing Vera account passwords a tiny bit more safely.
userId=$1
userPassword=$2
# Usage: `./hashpassword.sh <userId> <password>`
[ -z "$userId" ] && { echo >&2 "Error: A userId parameter is required"; exit 1; }
[ -z "$userPassword" ] && { echo >&2 "Error: A password parameter is required"; exit 1; }

passwordSeed=oZ7QE6LcLJp6fiWzdqZc
shaPassword=$(echo -n "${userId}${userPassword}${passwordSeed}" | openssl dgst -sha1)

echo "VERA_PASSWORD_HASH=${shaPassword}"
