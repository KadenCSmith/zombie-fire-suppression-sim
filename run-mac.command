#!/bin/zsh
set -euo pipefail
script_dir="${0:A:h}"
package_version=$(/usr/bin/plutil -extract version raw -o - "$script_dir/package.json")
minor_version="${package_version%.*}"
app_path=''
for candidate in \
  "$HOME/Applications/Zombie Fire Suppression Sim $minor_version.app" \
  "/Applications/Zombie Fire Suppression Sim $minor_version.app" \
  "$HOME/Applications/Zombie Fire Suppression Sim.app" \
  "/Applications/Zombie Fire Suppression Sim.app"; do
  [[ -d "$candidate" ]] || continue
  installed_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$candidate/Contents/Info.plist" 2>/dev/null || true)
  if [[ "${installed_version%.*}" == "$minor_version" ]]; then
    app_path="$candidate"
    break
  fi
done
if [[ -z "$app_path" ]]; then
  echo "Install Zombie Fire Suppression Sim $minor_version from its Mac release first. See docs/INSTALL.md."
  exit 1
fi
open -na "$app_path" --args "$@"
