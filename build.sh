#!/bin/bash

# Build script for ResumeHub extension

# Variables
DIST_DIR="dist"
BUILD_DIR="${DIST_DIR}/build_resumehub"
ZIP_FILE="${DIST_DIR}/ResumeHub-v1-production.zip"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Dependency Check
echo -e "${YELLOW}Checking for dependencies (jq, esbuild)...${NC}"
if ! command -v jq &> /dev/null || ! command -v esbuild &> /dev/null; then
    echo -e "${RED}jq and esbuild are required. Please install them.${NC}"
    echo "On macOS: brew install jq esbuild"
    echo "On Debian/Ubuntu: sudo apt-get install jq esbuild"
    exit 1
fi
echo -e "${GREEN}Dependencies found.${NC}"

# 2. Cleanup and Setup
echo -e "${YELLOW}Cleaning up old builds and setting up directories...${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$BUILD_DIR/js"
mkdir -p "$BUILD_DIR/css"
echo -e "${GREEN}Cleanup and setup complete.${NC}"

# 3. Copy Static Assets
echo -e "${YELLOW}Copying static assets...${NC}"
cp -r assets lib manifest.json popup.html popup.js background.js PRIVACY_POLICY.md "$BUILD_DIR/"
echo -e "${GREEN}Static assets copied.${NC}"

# 4. Process JavaScript
echo -e "${YELLOW}Bundling and minifying JavaScript...${NC}"

# Popup scripts
esbuild popup/app-controller.js --bundle --minify --outfile="$BUILD_DIR/js/popup_bundle.js"
if [ $? -ne 0 ]; then echo -e "${RED}Popup script bundling failed.${NC}"; exit 1; fi

# Content scripts
esbuild content-scripts/linkedin/linkedin-controller.js --bundle --minify --outfile="$BUILD_DIR/js/content_script_bundle.js"
if [ $? -ne 0 ]; then echo -e "${RED}Content script bundling failed.${NC}"; exit 1; fi

# Background script
esbuild background.js --minify --outfile="$BUILD_DIR/background.js"
if [ $? -ne 0 ]; then echo -e "${RED}Background script minification failed.${NC}"; exit 1; fi

echo -e "${GREEN}JavaScript processed successfully.${NC}"


# 5. Process CSS
echo -e "${YELLOW}Minifying CSS...${NC}"
cleancss -o "$BUILD_DIR/css/popup_modern.min.css" css/popup_modern.css
echo -e "${GREEN}CSS minified.${NC}"

# 6. Update HTML
echo -e "${YELLOW}Updating popup.html to use bundled files...${NC}"
# Remove old script and style tags
sed -i.bak '/<script src="utils\//d; /<script src="popup\//d; /<script src="popup.js/d; /<link rel="stylesheet" href="css\/popup_modern.css">/d' "$BUILD_DIR/popup.html"
# Add new bundled files
sed -i.bak 's|</body>|<link rel="stylesheet" href="css/popup_modern.min.css">\
<script src="js/popup_bundle.js"></script>\
<script src="popup.js"></script>\
</body>|' "$BUILD_DIR/popup.html"
rm "$BUILD_DIR/popup.html.bak"
# Minify the separate popup.js initializer
esbuild "$BUILD_DIR/popup.js" --minify --outfile="$BUILD_DIR/popup.js" --allow-overwrite
echo -e "${GREEN}popup.html updated.${NC}"

# 7. Update Manifest
echo -e "${YELLOW}Updating manifest.json...${NC}"
jq 'del(.web_accessible_resources) | .content_scripts[0].js = ["js/content_script_bundle.js"]' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp" && mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"
echo -e "${GREEN}manifest.json updated.${NC}"


# 8. Create Zip Archive
echo -e "${YELLOW}Creating production zip archive...${NC}"
(cd "$BUILD_DIR" && zip -r -q "../${ZIP_FILE##*/}" ./*)
echo -e "${GREEN}Production build created at ${ZIP_FILE}${NC}"

echo -e "\n${GREEN}✅ Build successful!${NC}" 