#!/usr/bin/env bash
# Package a single skill folder as a zip suitable for upload (e.g. Claude skills).
# Usage: ./scripts/package-skill.sh <skill-name>
# Example: ./scripts/package-skill.sh idea-to-architecture

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_NAME="${1:-}"

if [[ -z "$SKILL_NAME" ]]; then
  echo "Usage: $0 <skill-name>" >&2
  echo "Example: $0 idea-to-architecture" >&2
  exit 1
fi

SRC="${ROOT}/skills/${SKILL_NAME}"
if [[ ! -d "$SRC" ]]; then
  echo "Error: no skill at ${SRC}" >&2
  exit 1
fi

if [[ ! -f "${SRC}/SKILL.md" ]]; then
  echo "Error: ${SRC}/SKILL.md is required" >&2
  exit 1
fi

OUT_DIR="${ROOT}/dist"
mkdir -p "$OUT_DIR"
ZIP_PATH="${OUT_DIR}/${SKILL_NAME}.zip"

rm -f "$ZIP_PATH"
# Zip contents so SKILL.md is at archive root (not skills/idea-to-architecture/...)
( cd "$SRC" && zip -r "$ZIP_PATH" . -x "*.DS_Store" )

echo "Wrote ${ZIP_PATH}"
