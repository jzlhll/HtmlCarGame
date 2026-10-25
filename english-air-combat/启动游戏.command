#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is required. Install Node.js 18 or later, then run this launcher again.'
  read -r -p 'Press Enter to close.'
  exit 1
fi
if [ ! -f node_modules/three/build/three.module.js ]; then
  npm ci || exit 1
fi
npm start -- --open
