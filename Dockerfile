# Midas A7 service: Python (FastAPI engine) + Node (runs the frozen A7 Code-node logic).
FROM node:22.12.0-bookworm-slim AS js
WORKDIR /js
COPY src/midas_a7/engine/js/package.json src/midas_a7/engine/js/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM python:3.12.8-slim-bookworm
COPY --from=js /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
COPY --from=js /js/node_modules ./src/midas_a7/engine/js/node_modules
RUN pip install --no-cache-dir -e . \
 && useradd --system --uid 10001 --home /app app \
 && chown -R app /app
USER app
ENV PORT=8080 PYTHONUNBUFFERED=1 MIDAS_NODE_BIN=/usr/local/bin/node
EXPOSE 8080
CMD ["midas-a7", "serve"]
