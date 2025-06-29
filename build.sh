#!/bin/bash

# Enhanced Build script for ResumeHub extension
# This script creates an optimized, minified, and obfuscated production build

# Set variables
EXTENSION_NAME="ResumeHub-v1"
DIST_DIR="./dist"
BUILD_DIR="${DIST_DIR}/build_resumehub"
ZIP_FILE="${DIST_DIR}/${EXTENSION_NAME}-production.zip"
TEMP_DIR="${DIST_DIR}/temp_build"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for required dependencies
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    # Check for Node.js and npm
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is required but not installed.${NC}"
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is required but not installed.${NC}"
        exit 1
    fi
    
    # Install terser for JS minification if not present
    if ! npm list -g terser &> /dev/null; then
        echo -e "${YELLOW}Installing terser for JS minification...${NC}"
        npm install -g terser
    fi
    
    # Install clean-css-cli for CSS minification if not present
    if ! npm list -g clean-css-cli &> /dev/null; then
        echo -e "${YELLOW}Installing clean-css-cli for CSS minification...${NC}"
        npm install -g clean-css-cli
    fi
    
    echo -e "${GREEN}Dependencies check completed!${NC}"
}

# Function to combine and minify JS files
combine_js_files() {
    local input_files=("$@")
    local output_file="$1"
    shift
    local files=("$@")
    
    echo -e "${YELLOW}Combining JS files into ${output_file}...${NC}"
    
    # Create a temporary combined file
    local temp_combined="${TEMP_DIR}/temp_combined.js"
    > "$temp_combined"  # Clear the file
    
    # Add obfuscation header
    echo "/* ResumeHub Production Build - $(date) */" >> "$temp_combined"
    echo "(function(){" >> "$temp_combined"
    
    # Combine all files
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            echo "// Source: $file" >> "$temp_combined"
            cat "$file" >> "$temp_combined"
            echo "" >> "$temp_combined"
        else
            echo -e "${RED}Warning: File $file not found${NC}"
        fi
    done
    
    # Close the wrapper function
    echo "})();" >> "$temp_combined"
    
    # Minify and obfuscate using terser
    terser "$temp_combined" \
        --compress sequences=true,dead_code=true,conditionals=true,booleans=true,unused=true,if_return=true,join_vars=true,drop_console=true \
        --mangle toplevel=true,reserved=['chrome','browser','window','document'] \
        --output "$output_file" \
        --comments false
    
    # Clean up temp file
    rm "$temp_combined"
    
    echo -e "${GREEN}Combined and minified: ${output_file}${NC}"
}

# Function to minify CSS
minify_css() {
    local input_file="$1"
    local output_file="$2"
    
    echo -e "${YELLOW}Minifying CSS: ${input_file}...${NC}"
    
    cleancss \
        -O2 \
        --output "$output_file" \
        "$input_file"
    
    echo -e "${GREEN}Minified CSS: ${output_file}${NC}"
}

# Function to obfuscate HTML
obfuscate_html() {
    local input_file="$1"
    local output_file="$2"
    
    echo -e "${YELLOW}Processing HTML: ${input_file}...${NC}"
    
    # Create a minified version with updated script references
    sed -e 's/<!--.*-->//g' \
        -e '/^[[:space:]]*$/d' \
        -e 's/[[:space:]]\+/ /g' \
        "$input_file" > "$output_file.tmp"
    
    # Update script references to point to combined files (cross-platform sed)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' \
            -e 's|<script src="utils/shared-utilities.js"></script>||g' \
            -e 's|<script src="utils/storage-manager.js"></script>||g' \
            -e 's|<script src="utils/simple-rate-limiter.js"></script>||g' \
            -e 's|<script src="utils/unified-error-handler.js"></script>||g' \
            -e 's|<script src="utils/api-client.js"></script>||g' \
            -e 's|<script src="utils/script-injector.js"></script>||g' \
            -e 's|<script src="utils/parallel-processor.js"></script>||g' \
            -e 's|<script src="utils/resume-cache-optimizer.js"></script>||g' \
            -e 's|<script src="popup/state-manager.js"></script>||g' \
            -e 's|<script src="popup/ui-manager.js"></script>||g' \
            -e 's|<script src="popup/file-handlers.js"></script>||g' \
            -e 's|<script src="popup/resume-processor.js"></script>||g' \
            -e 's|<script src="popup/event-handlers.js"></script>||g' \
            -e 's|<script src="popup/app-controller.js"></script>||g' \
            -e 's|<link rel="stylesheet" href="css/popup_modern.css">|<link rel="stylesheet" href="css/combined.min.css">|g' \
            "$output_file.tmp"
        
        # Add combined script references before popup.js
        sed -i '' \
            -e 's|<script src="popup.js"></script>|<script src="js/utils.min.js"></script>\
    <script src="js/popup.min.js"></script>\
    <script src="popup.js"></script>|g' \
            "$output_file.tmp"
    else
        # Linux/Unix
        sed -i \
            -e 's|<script src="utils/shared-utilities.js"></script>||g' \
            -e 's|<script src="utils/storage-manager.js"></script>||g' \
            -e 's|<script src="utils/simple-rate-limiter.js"></script>||g' \
            -e 's|<script src="utils/unified-error-handler.js"></script>||g' \
            -e 's|<script src="utils/api-client.js"></script>||g' \
            -e 's|<script src="utils/script-injector.js"></script>||g' \
            -e 's|<script src="utils/parallel-processor.js"></script>||g' \
            -e 's|<script src="utils/resume-cache-optimizer.js"></script>||g' \
            -e 's|<script src="popup/state-manager.js"></script>||g' \
            -e 's|<script src="popup/ui-manager.js"></script>||g' \
            -e 's|<script src="popup/file-handlers.js"></script>||g' \
            -e 's|<script src="popup/resume-processor.js"></script>||g' \
            -e 's|<script src="popup/event-handlers.js"></script>||g' \
            -e 's|<script src="popup/app-controller.js"></script>||g' \
            -e 's|<link rel="stylesheet" href="css/popup_modern.css">|<link rel="stylesheet" href="css/combined.min.css">|g' \
            "$output_file.tmp"
        
        # Add combined script references before popup.js
        sed -i \
            -e 's|<script src="popup.js"></script>|<script src="js/utils.min.js"></script>\
    <script src="js/popup.min.js"></script>\
    <script src="popup.js"></script>|g' \
            "$output_file.tmp"
    fi
    
    mv "$output_file.tmp" "$output_file"
    
    echo -e "${GREEN}Processed HTML: ${output_file}${NC}"
}

# Function to add anti-copy protection
add_protection() {
    local build_path="$1"
    
    echo -e "${YELLOW}Adding anti-copy protection...${NC}"
    
    # Create a protection script
    cat > "${build_path}/js/protection.min.js" << 'EOF'
(function(){var a=function(){console.clear();console.log("%cResumeHub Protection","color:red;font-size:20px;font-weight:bold");console.log("%cThis extension is protected against unauthorized copying.","color:red;font-size:14px")};setInterval(a,1000);document.addEventListener("keydown",function(b){if(b.ctrlKey&&(b.keyCode===85||b.keyCode===83||b.keyCode===73)){b.preventDefault();a()}});document.addEventListener("contextmenu",function(b){b.preventDefault();a()});Object.defineProperty(window,"devtools",{get:function(){a();return{}},set:function(){}})})();
EOF
    
    # Add protection script to HTML
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's|</head>|<script src="js/protection.min.js"></script></head>|g' "${build_path}/popup.html"
    else
        sed -i 's|</head>|<script src="js/protection.min.js"></script></head>|g' "${build_path}/popup.html"
    fi
    
    # Create a dummy readme with misleading information
    cat > "${build_path}/README_BUILD.txt" << EOF
# Production Build
This is a production build of ResumeHub extension.
Build Date: $(date)
Build Version: $(openssl rand -hex 8)

Note: This build contains optimized and minified code.
Source files have been combined for performance.
EOF
    
    echo -e "${GREEN}Protection measures added!${NC}"
}

# Main build process
echo -e "${GREEN}Starting enhanced build process for ${EXTENSION_NAME}...${NC}"

# Check dependencies
check_dependencies

# Create directories
mkdir -p "$BUILD_DIR" "$DIST_DIR" "$TEMP_DIR"
mkdir -p "$BUILD_DIR/js" "$BUILD_DIR/css"

# Clean directories
echo -e "${YELLOW}Cleaning build directories...${NC}"
rm -rf "$BUILD_DIR"/* "$TEMP_DIR"/*

# Copy base files
echo -e "${YELLOW}Copying base files...${NC}"
cp manifest.json "$BUILD_DIR/"
cp popup.js "$BUILD_DIR/"
cp background.js "$BUILD_DIR/"
cp PRIVACY_POLICY.md "$BUILD_DIR/"

# Copy folders
if [ -d "assets" ]; then
    cp -r assets "$BUILD_DIR/"
fi

if [ -d "lib" ]; then
    cp -r lib "$BUILD_DIR/"
fi

# Combine and minify utility JS files
echo -e "${BLUE}Processing utility modules...${NC}"
combine_js_files "$BUILD_DIR/js/utils.min.js" \
    "utils/shared-utilities.js" \
    "utils/storage-manager.js" \
    "utils/simple-rate-limiter.js" \
    "utils/unified-error-handler.js" \
    "utils/api-client.js" \
    "utils/script-injector.js" \
    "utils/parallel-processor.js" \
    "utils/resume-cache-optimizer.js"

# Combine and minify popup JS files
echo -e "${BLUE}Processing popup modules...${NC}"
combine_js_files "$BUILD_DIR/js/popup.min.js" \
    "popup/state-manager.js" \
    "popup/ui-manager.js" \
    "popup/file-handlers.js" \
    "popup/resume-processor.js" \
    "popup/event-handlers.js" \
    "popup/app-controller.js"

# Minify CSS
echo -e "${BLUE}Processing CSS files...${NC}"
if [ -f "css/popup_modern.css" ]; then
    minify_css "css/popup_modern.css" "$BUILD_DIR/css/combined.min.css"
fi

# Process HTML with updated references
echo -e "${BLUE}Processing HTML...${NC}"
obfuscate_html "popup.html" "$BUILD_DIR/popup.html"

# Minify background.js separately
echo -e "${BLUE}Minifying background script...${NC}"
terser "background.js" \
    --compress sequences=true,dead_code=true,conditionals=true,booleans=true,unused=true,if_return=true,join_vars=true,drop_console=true \
    --mangle toplevel=true,reserved=['chrome','browser'] \
    --output "$BUILD_DIR/background.js" \
    --comments false

# Minify popup.js
echo -e "${BLUE}Minifying popup script...${NC}"
terser "popup.js" \
    --compress sequences=true,dead_code=true,conditionals=true,booleans=true,unused=true,if_return=true,join_vars=true \
    --mangle toplevel=true \
    --output "$BUILD_DIR/popup.js" \
    --comments false

# Add protection measures
add_protection "$BUILD_DIR"

# Create the zip file
echo -e "${YELLOW}Creating production zip file...${NC}"
ORIGINAL_DIR=$(pwd)
cd "$BUILD_DIR"

# Create zip with timestamp in filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FINAL_ZIP="../${EXTENSION_NAME}_prod_${TIMESTAMP}.zip"

zip -r "$FINAL_ZIP" . -x "*/.DS_Store" "*/.git*" "*/.vscode*" "*/.idea*" "*.map"

cd "$ORIGINAL_DIR"

# Cleanup temp directory
rm -rf "$TEMP_DIR"

# Final checks and summary
ZIP_PATH="${DIST_DIR}/${EXTENSION_NAME}_prod_${TIMESTAMP}.zip"
if [ -f "$ZIP_PATH" ]; then
    ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
    echo -e "${GREEN}✅ Production build completed successfully!${NC}"
    echo -e "${GREEN}📦 Zip file: ${EXTENSION_NAME}_prod_${TIMESTAMP}.zip (${ZIP_SIZE})${NC}"
    echo -e "${BLUE}🔒 Security features added:${NC}"
    echo -e "   • JS modules combined and obfuscated"
    echo -e "   • CSS minified and optimized"
    echo -e "   • Anti-debugging protection"
    echo -e "   • Source code obfuscation"
    echo -e "   • Console clearing protection"
    echo -e "   • Right-click protection"
    
    # Show file size comparison
    echo -e "${BLUE}📊 Build optimization:${NC}"
    ORIGINAL_SIZE=$(find . -name "*.js" -not -path "./build_*" -not -path "./dist/*" -not -path "./node_modules/*" | xargs wc -c | tail -1 | awk '{print $1}')
    MINIFIED_SIZE=$(find "$BUILD_DIR" -name "*.js" | xargs wc -c | tail -1 | awk '{print $1}')
    if [ "$ORIGINAL_SIZE" -gt 0 ]; then
        REDUCTION=$(echo "scale=1; ($ORIGINAL_SIZE - $MINIFIED_SIZE) * 100 / $ORIGINAL_SIZE" | bc -l 2>/dev/null || echo "N/A")
        echo -e "   • JS size reduction: ~${REDUCTION}%"
    fi
else
    echo -e "${RED}❌ Error: Failed to create production build${NC}"
    exit 1
fi

# Optional cleanup
read -p "Do you want to clean up the build directory (${BUILD_DIR})? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cleaning up build directory...${NC}"
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✅ Cleanup completed!${NC}"
fi

echo -e "${GREEN}🚀 The optimized extension is ready for publishing!${NC}"
echo -e "${YELLOW}⚠️  Note: This build is optimized for production and includes anti-copy protection.${NC}" 