#!/bin/sh
# Builds the deployable site into dist/
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M%S)
rm -rf dist && mkdir -p dist/icons
npx esbuild src/main.js --bundle --minify --format=esm --target=safari16 --outfile=dist/app.js
sed "s/__V__/$V/g" index.html > dist/index.html
sed "s/__V__/$V/g" sw.js.tpl > dist/sw.js
cp styles.css manifest.webmanifest dist/
cp icons/*.png dist/icons/
touch dist/.nojekyll
echo "built $V"
