#!/usr/bin/env bash
# Signs the release bundle that CI puts on the android-build branch with the upload key kept in the
# project files (never in git), and checks the signature. Google Play re-signs it with the app key.
#
#   scripts/sign-android.sh <unsigned.aab> <signed.aab> <upload-key.jks> <password file>
set -euo pipefail
in="$1"; out="$2"; key="$3"; pass="$4"
cp "$in" "$out"
jarsigner -keystore "$key" -storepass:file "$pass" -keypass:file "$pass" \
  -sigalg SHA256withRSA -digestalg SHA-256 "$out" upload > /dev/null
jarsigner -verify "$out" | tail -1
keytool -printcert -jarfile "$out" | grep -m1 "SHA256:"
