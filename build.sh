#!/bin/bash

# Build script for ResumeHub extension
# This script creates a clean zip package for publishing

# Set variables
EXTENSION_NAME="ResumeHub-v1"
BUILD_DIR="./build_resumehub" # Use a distinct build directory name
DIST_DIR="./dist"
ZIP_FILE="${DIST_DIR}/${EXTENSION_NAME}.zip"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting build process for ${EXTENSION_NAME}...${NC}"

# Create directories if they don't exist
mkdir -p $BUILD_DIR
mkdir -p $DIST_DIR

# Clean build directory
echo -e "${YELLOW}Cleaning build directory...${NC}"
rm -rf $BUILD_DIR/*

# --- Copy necessary files and folders ---
echo -e "${YELLOW}Copying essential files and folders...${NC}"

# Root files
cp manifest.json $BUILD_DIR/
cp popup.html $BUILD_DIR/
cp popup.js $BUILD_DIR/
cp background.js $BUILD_DIR/
cp content.js $BUILD_DIR/
cp PRIVACY_POLICY.md $BUILD_DIR/

# Folders (copy contents recursively)
if [ -d "assets" ]; then
  cp -r assets $BUILD_DIR/assets
fi

if [ -d "lib" ]; then
  cp -r lib $BUILD_DIR/lib
fi

if [ -d "css" ]; then
  cp -r css $BUILD_DIR/css
fi


# --- Create the zip file ---
echo -e "${YELLOW}Creating zip file...${NC}"
cd $BUILD_DIR

# Create the zip file, excluding hidden files/folders like .DS_Store and .git
# Make sure manifest.json is at the root inside the zip
zip -r "../$ZIP_FILE" . -x "*/.DS_Store" "*/.git*" "*/.vscode*" "*/.idea*"

cd .. # Return to the original directory

# --- Check and Finalize ---
if [ -f "$ZIP_FILE" ]; then
  ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
  echo -e "${GREEN}Build completed successfully!${NC}"
  echo -e "Zip file created at ${ZIP_FILE} (${ZIP_SIZE})"
else
  echo -e "\033[0;31mError: Failed to create zip file${NC}"
  exit 1
fi

# Optional cleanup
read -p "Do you want to clean up the build directory (${BUILD_DIR})? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}Cleaning up build directory...${NC}"
  rm -rf $BUILD_DIR
  echo -e "${GREEN}Cleanup completed!${NC}"
fi

echo -e "${GREEN}The extension is ready for publishing!${NC}" 