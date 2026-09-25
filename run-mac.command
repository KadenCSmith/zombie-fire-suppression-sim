#!/bin/zsh
set -euo pipefail

app_path="$HOME/Applications/Zombie Fire Suppression Sim.app"

if [[ ! -d "$app_path" ]]; then
  echo "The installed app is missing: $app_path"
  echo "Build the app with npm run package:mac, then extract its ZIP into ~/Applications."
  exit 1
fi

open -a "$app_path"
