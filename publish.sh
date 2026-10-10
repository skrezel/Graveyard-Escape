#!/bin/bash
# Put the latest version of the game online (GitHub Pages).
#   ./publish.sh "added a new level"
set -e
cd "$(dirname "$0")"
git add -A
git commit -q -m "${1:-Update the game}" || echo "(nothing new to commit)"
git push -q
echo "🎃 Published! The phones get the new version next time they open the game online."
