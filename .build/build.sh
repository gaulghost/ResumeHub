#!/bin/bash

# ResumeHub Build Script
# Located in .build/ directory
# Run via: npm run build  (or bash .build/build.sh)
#
# Outputs (all under .build/):
#   .build/extension/              — unpacked Chrome extension (Load unpacked)
#   .build/resumehub-extension.zip — packaged zip for distribution

set -euo pipefail

# Ensure we are in the directory of the script
cd "$(dirname "$0")"

EXTENSION_DIR="./extension"
ZIP_FILE="resumehub-extension.zip"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting ResumeHub Build Process...${NC}"

# 1. Clean previous build artifacts (keep build.sh)
echo -e "${YELLOW}Cleaning previous build artifacts...${NC}"
rm -rf "$EXTENSION_DIR"
rm -f "$ZIP_FILE"
mkdir -p "$EXTENSION_DIR"

# 2. Copy static files and directories from Project Root (..)
echo -e "${YELLOW}Copying files from project root...${NC}"

FILES_TO_COPY=(
    "manifest.json"
    "popup.html"
    "popup.js"
    "popup"
    "background.js"
    "assets"
    "content-scripts"
    "core"
    "css"
    "lib"
    "utils"
)

for item in "${FILES_TO_COPY[@]}"; do
    if [ -e "../$item" ]; then
        cp -R "../$item" "$EXTENSION_DIR/"
    else
        echo -e "${RED}Warning: ../$item not found!${NC}"
    fi
done

# 3. Compile content scripts using esbuild to bundle imports
echo -e "${GREEN}Compiling content scripts with esbuild...${NC}"

if command -v npx &> /dev/null; then
    echo -e "   📦 Bundling linkedin-controller.js..."
    npx esbuild ../content-scripts/linkedin/linkedin-controller.js --bundle --minify --platform=browser --outfile="$EXTENSION_DIR/content-scripts/linkedin/linkedin-controller.js"

    echo -e "   📦 Bundling naukri-controller.js..."
    npx esbuild ../content-scripts/naukri/naukri-controller.js --bundle --minify --platform=browser --outfile="$EXTENSION_DIR/content-scripts/naukri/naukri-controller.js"

    echo -e "   📦 Bundling instahyre-controller.js..."
    npx esbuild ../content-scripts/instahyre/instahyre-controller.js --bundle --minify --platform=browser --outfile="$EXTENSION_DIR/content-scripts/instahyre/instahyre-controller.js"
else
    echo -e "${RED}Error: npx / Node.js not found. Cannot run esbuild compilation!${NC}"
    exit 1
fi

# 4. Optional minification for popup / background
if command -v terser &> /dev/null; then
    echo -e "${GREEN}Minifying background and popup JS...${NC}"
    terser "$EXTENSION_DIR/background.js" --compress --mangle --output "$EXTENSION_DIR/background.js"
    terser "$EXTENSION_DIR/popup.js" --compress --mangle --output "$EXTENSION_DIR/popup.js"
else
    echo -e "${YELLOW}Terser not found. Skipping JS minification for popup/background.${NC}"
fi

if command -v cleancss &> /dev/null; then
    echo -e "${GREEN}Minifying CSS files...${NC}"
    find "$EXTENSION_DIR" -name "*.css" | while read -r file; do
        cleancss -o "$file" "$file"
    done
else
    echo -e "${YELLOW}clean-css not found. Skipping CSS minification.${NC}"
fi

# 5. Create Zip package next to the unpacked build
echo -e "${GREEN}Creating ZIP package...${NC}"
(
    cd "$EXTENSION_DIR"
    zip -r "../$ZIP_FILE" ./* > /dev/null
)

echo -e "${GREEN}Build Complete!${NC}"
echo -e "Unpacked extension (Load unpacked): ${YELLOW}$(cd "$EXTENSION_DIR" && pwd)${NC}"
echo -e "Extension package: ${YELLOW}$(pwd)/$ZIP_FILE${NC}"
