################################
# Stage 1: Builder
################################
FROM python:3.13-slim-trixie AS builder

WORKDIR /app

# Copy only dependency manifests first (to leverage Docker build cache for faster builds)
COPY pyproject.toml poetry.lock /app/

# Install Poetry; the project deps go into /app/.venv so the runner copies them
# without Poetry and its own dependencies. The venv gets no pip: nothing installs at runtime,
# and pip's vendored copies (urllib3, msgpack, setuptools) only add scanner findings.
RUN pip install --no-cache-dir "poetry==2.3.2" \
    && poetry config virtualenvs.in-project true \
    && poetry config virtualenvs.options.no-pip true

# Re-generate lock file if it is outdated, then install all dependencies (except dev/test deps)
RUN (poetry check --lock || poetry lock) && poetry install --without dev --no-root --no-ansi --no-cache

################################
# Stage 2: Runtime
################################
FROM python:3.13-slim-trixie AS runner

WORKDIR /app

# Run as an unprivileged user. The base image's pip is removed for the same reason as above.
RUN python -m pip uninstall --yes --no-cache-dir pip \
    && useradd --system --uid 10001 --no-create-home gymbros

# Copy only the project's virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy the actual application code into /app. settings.json, alembic.ini and migrations/ land
# at / because src/ is flattened into /app (settings.py and db/migrate.py resolve the repo root
# to "/").
COPY ./src /app
COPY ./settings.json /settings.json
COPY ./alembic.ini /alembic.ini
COPY ./migrations /migrations

USER gymbros

EXPOSE 8080

ARG WEB_CONCURRENCY=2
ENV WEB_CONCURRENCY=${WEB_CONCURRENCY}

# Migrate once, before the workers start (so workers never race each other on Alembic), then run
# uvicorn:
# - "main:app"   : entrypoint -> file main.py, ASGI app instance "app"
# - host=0.0.0.0 : bind to all network interfaces (needed in containers)
# - port=8080    : matches EXPOSE above
# - workers      : WEB_CONCURRENCY env var
CMD ["sh", "-c", "alembic -c /alembic.ini upgrade head && exec uvicorn main:app --host=0.0.0.0 --port=8080 --workers=${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*'"]

HEALTHCHECK --interval=10s --timeout=10s --retries=5 CMD python -c 'import urllib.request; urllib.request.urlopen("http://localhost:8080/health", timeout=5)'
