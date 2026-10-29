#!/bin/bash
set -euo pipefail
game_root="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 -I "$game_root/tools/package_macos.py" --install "$@"
