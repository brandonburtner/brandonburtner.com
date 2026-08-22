#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PIP="../awsenv/bin/pip"
PLAT=(--platform manylinux2014_x86_64 --implementation cp --python-version 3.12 --only-binary=:all:)

build_pkg () {
  local dir="$1"; shift
  rm -rf "$dir"; mkdir -p "$dir"
  echo "--- [$dir] pure-python resolve ---"
  $PIP install -q --target "$dir" "$@"
  echo "--- [$dir] swap native (cryptography, cffi) for linux x86_64 ---"
  # remove ALL mac-native artifacts + their metadata, then install linux wheels
  find "$dir" -name "*darwin*.so" -delete
  rm -rf "$dir"/cryptography "$dir"/cryptography-*.dist-info \
         "$dir"/cffi "$dir"/cffi-*.dist-info "$dir"/_cffi_backend* \
         "$dir"/pycparser "$dir"/pycparser-*.dist-info "$dir"/bin
  $PIP install -q "${PLAT[@]}" --upgrade --target "$dir" cryptography cffi
  # strip caches
  find "$dir" -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true
  find "$dir" -name "*.dist-info" -type d -prune -exec rm -rf {} + 2>/dev/null || true
}

build_pkg build_api google-auth requests "pywebpush==1.14.1"
build_pkg build_notifier "pywebpush==1.14.1" requests

echo "=== remaining darwin artifacts (should be NONE) ==="
find build_api build_notifier -name "*darwin*" | head
echo "=== rust binding arch ==="
file build_api/cryptography/hazmat/bindings/_rust*.so | sed 's/.*: //'
echo "API size: $(du -sh build_api | cut -f1) | NOTIFIER size: $(du -sh build_notifier | cut -f1)"
