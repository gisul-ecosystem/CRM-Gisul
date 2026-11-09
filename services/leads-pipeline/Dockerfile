# Pipeline, the API for the CRM and the daily schedule in one image.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PIP_NO_CACHE_DIR=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY requirements.txt .
# tzdata: the daily RUN_AT time follows TZ (set in docker-compose.yml)
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && pip install -r requirements.txt \
    && python -m playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY leads ./leads
COPY .env.example .env.training.example .env.competitors.example docker-entrypoint.sh ./
# Settings live in the data volume, so the CRM can edit them and they survive rebuilds
ENV DATA_DIR=/app/data ENV_FILE=/app/data/.env WEB_HOST=0.0.0.0 WEB_IN_DOCKER=1
RUN useradd --create-home --uid 10001 --user-group leads \
    && mkdir -p /app/data \
    && chown -R leads:leads /app
USER leads
EXPOSE 8501
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["web"]
