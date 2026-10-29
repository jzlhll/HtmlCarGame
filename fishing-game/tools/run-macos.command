#!/bin/bash
set -euo pipefail
game_root="$(cd "$(dirname "$0")/.." && pwd)"
engine_path="${GODOT_BIN:-$game_root/.tools/Godot.app/Contents/MacOS/Godot}"
if [[ ! -x "$engine_path" ]]; then
  echo "Godot 4.5.1 not found. Set GODOT_BIN or download the official macOS editor into .tools/."
  exit 1
fi
exec "$engine_path" --path "$game_root" "$@"
