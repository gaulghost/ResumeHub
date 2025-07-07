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

# --- Dependency Check & Command Fallbacks ---
echo -e "${YELLOW}Checking for dependencies (jq) and setting up tool commands...${NC}"

# jq must be available – it's required for manifest editing
if ! command -v jq &> /dev/null; then
    echo -e "${RED}jq is required but not installed.${NC}"
    echo "On macOS: brew install jq"
    echo "On Debian/Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Determine esbuild command (prefer global, fallback to npx)
if command -v esbuild &> /dev/null; then
    ESBUILD_CMD="esbuild"
else
    ESBUILD_CMD="npx esbuild"
fi

# Determine javascript-obfuscator command (prefer global, fallback to npx)
if command -v javascript-obfuscator &> /dev/null; then
    OBFUSCATE_CMD="javascript-obfuscator"
else
    OBFUSCATE_CMD="npx javascript-obfuscator"
fi

echo -e "${GREEN}Tool commands configured. Using:\n  esbuild -> $ESBUILD_CMD\n  obfuscator -> $OBFUSCATE_CMD${NC}"

# 2. Cleanup and Setup
echo -e "${YELLOW}Cleaning up old builds and setting up directories...${NC}"
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$BUILD_DIR/js"
mkdir -p "$BUILD_DIR/css"
echo -e "${GREEN}Cleanup and setup complete.${NC}"

# 3. Copy Static Assets
echo -e "${YELLOW}Copying static assets...${NC}"
# Copy necessary static assets (include utils, content scripts, and popup directory for interactive UI)
cp -r assets lib utils content-scripts popup manifest.json popup.html popup.js background.js PRIVACY_POLICY.md "$BUILD_DIR/"
echo -e "${GREEN}Static assets copied.${NC}"

# 4. Process JavaScript
echo -e "${YELLOW}Bundling and minifying JavaScript...${NC}"

# Popup scripts
${ESBUILD_CMD} popup/app-controller.js --bundle --minify --outfile="$BUILD_DIR/js/popup_bundle.js"
if [ $? -ne 0 ]; then echo -e "${RED}Popup script bundling failed.${NC}"; exit 1; fi

# Content scripts
${ESBUILD_CMD} content-scripts/linkedin/linkedin-controller.js --bundle --minify --outfile="$BUILD_DIR/js/content_script_bundle.js"
if [ $? -ne 0 ]; then echo -e "${RED}Content script bundling failed.${NC}"; exit 1; fi

# Background script
${ESBUILD_CMD} background.js --minify --outfile="$BUILD_DIR/background.js"
if [ $? -ne 0 ]; then echo -e "${RED}Background script minification failed.${NC}"; exit 1; fi

echo -e "${GREEN}JavaScript processed successfully.${NC}"

# 4a. Obfuscate JavaScript (makes code harder to analyse)
echo -e "${YELLOW}Obfuscating JavaScript...${NC}"
for jsfile in "$BUILD_DIR"/js/*.js "$BUILD_DIR"/popup.js; do
    $OBFUSCATE_CMD "$jsfile" --compact true --self-defending true --control-flow-flattening true --output "$jsfile"
done
echo -e "${GREEN}JavaScript obfuscation complete.${NC}"

# 5. Process CSS
echo -e "${YELLOW}Minifying CSS...${NC}"
cleancss -o "$BUILD_DIR/css/popup_modern.min.css" css/popup_modern.css
echo -e "${GREEN}CSS minified.${NC}"

# 6. Update HTML
echo -e "${YELLOW}Updating popup.html linking...${NC}"
# Swap to minified CSS reference but keep existing script tags intact
sed -i.bak 's|href="css/popup_modern.css"|href="css/popup_modern.min.css"|' "$BUILD_DIR/popup.html"
rm "$BUILD_DIR/popup.html.bak"
# Minify the separate popup.js initializer (keeps global names)
${ESBUILD_CMD} "$BUILD_DIR/popup.js" --minify --outfile="$BUILD_DIR/popup.js" --allow-overwrite
echo -e "${GREEN}popup.html updated.${NC}"

# 7. Update Manifest
echo -e "${YELLOW}Updating manifest.json...${NC}"
# Update content script path while retaining web_accessible_resources for dynamic imports
jq '.content_scripts[0].js = ["js/content_script_bundle.js"]' "$BUILD_DIR/manifest.json" > "$BUILD_DIR/manifest.json.tmp" && mv "$BUILD_DIR/manifest.json.tmp" "$BUILD_DIR/manifest.json"
echo -e "${GREEN}manifest.json updated.${NC}"


# 8. Create Zip Archive
echo -e "${YELLOW}Creating production zip archive...${NC}"
(cd "$BUILD_DIR" && zip -r -q "../${ZIP_FILE##*/}" ./*)
echo -e "${GREEN}Production build created at ${ZIP_FILE}${NC}"

echo -e "\n${GREEN}✅ Build successful!${NC}" 