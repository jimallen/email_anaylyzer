#!/bin/bash

# Build Poppler Lambda Layer for Amazon Linux 2023
# This creates a Lambda layer with poppler-utils (pdftoppm)

set -e

echo "Building Poppler Lambda Layer..."
echo ""

LAYER_DIR="layer"
OUTPUT_DIR="layer-build"

# Clean up previous builds
rm -rf "$LAYER_DIR" "$OUTPUT_DIR"
mkdir -p "$LAYER_DIR" "$OUTPUT_DIR"

# Create a simple Dockerfile to extract poppler-utils
cat > Dockerfile.layer <<'EOF'
FROM public.ecr.aws/lambda/provided:al2023

# Install poppler-utils which includes pdftoppm
RUN dnf install -y poppler-utils && dnf clean all

# Copy binaries and libraries to layer structure
RUN mkdir -p /opt/bin /opt/lib
RUN cp -L /usr/bin/pdftoppm /opt/bin/
RUN cp -L /usr/bin/pdfinfo /opt/bin/
RUN cp -L /usr/bin/pdftotext /opt/bin/

# Copy required shared libraries
RUN ldd /usr/bin/pdftoppm | grep "=> /" | awk '{print $3}' | xargs -I '{}' cp -v '{}' /opt/lib/ || true

CMD ["bash"]
EOF

echo "Building Docker image with poppler-utils..."
docker build -f Dockerfile.layer -t poppler-layer-builder .

echo "Extracting layer files..."
CONTAINER_ID=$(docker create poppler-layer-builder)
docker cp "$CONTAINER_ID:/opt" "$LAYER_DIR/"
docker rm "$CONTAINER_ID"

echo "Creating layer zip..."
cd "$LAYER_DIR"
zip -r "../$OUTPUT_DIR/poppler-layer.zip" .
cd ..

echo ""
echo "Layer built successfully!"
echo "Layer zip file: $OUTPUT_DIR/poppler-layer.zip"
echo ""
echo "To publish this layer to AWS Lambda:"
echo "  aws lambda publish-layer-version \\"
echo "    --layer-name poppler-utils \\"
echo "    --description 'Poppler utils for PDF processing' \\"
echo "    --zip-file fileb://$OUTPUT_DIR/poppler-layer.zip \\"
echo "    --compatible-runtimes provided.al2023 nodejs20.x \\"
echo "    --region eu-central-1"
echo ""

# Clean up
rm -f Dockerfile.layer
