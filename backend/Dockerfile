FROM oven/bun:1-alpine

# Install system dependencies for OCR and PDF processing
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-ind

WORKDIR /app

COPY package.json ./

RUN bun install

COPY . .

EXPOSE 3001

CMD ["bun", "run", "src/index.js"]
