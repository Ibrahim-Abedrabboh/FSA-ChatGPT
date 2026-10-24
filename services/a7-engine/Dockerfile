FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app
RUN useradd --system --uid 10001 engine
USER engine

EXPOSE 8080
# One worker: the duplicate-request guard is in memory (the site's ledger is the hard guard).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 75 --no-server-header"]
