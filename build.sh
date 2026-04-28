#!/bin/bash

npm run build

# Define the directories
old_dir="./out/_next"
new_dir="./out/next"

# Rename the directory
if [ -d "$old_dir" ]; then
  mv "$old_dir" "$new_dir"
  echo "Renamed $old_dir to $new_dir"
else
  echo "Directory $old_dir does not exist."
  exit 1
fi

# Update paths in HTML, CSS, and JS files
if [[ "$OSTYPE" == "darwin"* ]]; then
  find ./out -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" \) -exec sed -i '' 's#/_next/#/next/#g' {} \;
else
  find ./out -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" \) -exec sed -i 's#/_next/#/next/#g' {} \;
fi

echo "Updated path references from /_next/ to /next/"

