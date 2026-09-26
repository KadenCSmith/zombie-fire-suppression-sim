#!/bin/zsh
set -euo pipefail
app_path="$HOME/Applications/Zombie Fire Suppression Sim.app"
if [[ ! -d "$app_path" ]]; then
  app_path="/Applications/Zombie Fire Suppression Sim.app"
fi
if [[ ! -d "$app_path" ]]; then
  echo 'Install the app from the Mac DMG first. See docs/INSTALL.md.'
  exit 1
fi
open -na "$app_path" --args "$@"
