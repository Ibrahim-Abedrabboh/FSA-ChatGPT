FROM node:22-bookworm-slim AS node

FROM python:3.12-slim-bookworm

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && useradd --create-home --uid 10001 runner \
    && mkdir -p /app/cache \
    && chown -R runner:runner /app

WORKDIR /app
RUN pip install --no-cache-dir \
    fastapi==0.115.6 uvicorn==0.34.0 httpx==0.28.1 python-multipart==0.0.20 \
    SQLAlchemy==2.0.36 'psycopg[binary]==3.2.3' Pillow==11.0.0

COPY --chown=runner:runner claude-runner/runner.py /app/runner.py
ENV MIDAS_RUNNER_HOME=/app/cache
USER runner
RUN python runner.py setup && python runner.py verify

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8080') + '/health', timeout=3)" || exit 1
CMD ["python", "runner.py", "serve"]
