# Makefile for the GYMBROS monorepo (apps/api + apps/web)

# Declare phony targets to avoid conflicts with files of the same name
.PHONY: install up down prod local test test-api test-web e2e precommit migrate migration seed crew clean

DEV := docker compose -f docker-compose-dev.yaml
PROD := docker compose -f docker-compose.yaml
API_TEST_IMAGE := gymbros-api-test

# First run: create .env from the template (then replace the REPLACE_ values).
.env:
	cp .env.example .env

# Poetry asks the system keyring for credentials, which hangs with no output in a headless
# shell (no unlocked keyring). The api only pulls from public PyPI, so use the null backend.
install:
	cd apps/api && PYTHON_KEYRING_BACKEND=keyring.backends.null.Keyring poetry install
	cd apps/web && npm ci
	pre-commit install

up: .env
	$(DEV) up --build

prod: .env
	$(PROD) up --build

# Native api against the dev postgres (`$(DEV) up -d postgres` first).
local: .env
	cd apps/api/src && poetry run uvicorn main:app --host 0.0.0.0 --port 8080 --reload

down:
	$(PROD) down
	$(DEV) down --remove-orphans

test: test-api test-web

# Build the test image and run pytest against the dev postgres service.
# - Uses Dockerfile.run_test, which installs dev dependencies and copies the full project.
# - The suite creates and migrates its own gymbros_test database; the dev database is untouched.
# - Mounts apps/api/reports to persist the JUnit report and the HTML coverage report.
test-api: .env
	$(DEV) up -d --wait postgres
	docker build apps/api -f apps/api/Dockerfile.run_test -t $(API_TEST_IMAGE)
	docker run --rm --network gymbros-dev_default --env-file .env -e POSTGRES_HOST=postgres \
		-e POSTGRES_PORT=5432 -v "$(CURDIR)/apps/api/reports:/app/reports" $(API_TEST_IMAGE)

test-web:
	cd apps/web && npm run test

# Playwright smoke tests against the running dev stack (`make up` in another terminal).
e2e:
	cd apps/web && npm run e2e

precommit:
	pre-commit run --all-files

migrate:
	$(DEV) exec api alembic -c /alembic.ini upgrade head

# make migration m="add sets table"
migration:
	@test -n "$(m)" || (echo 'usage: make migration m="add sets table"' && exit 1)
	$(DEV) exec api alembic -c /alembic.ini revision --autogenerate -m "$(m)"

# Create the five-person demo crew (invite code IRONRIDGE) with the prototype's history in the
# dev database. Safe to re-run. `make seed reset=1` deletes the demo crew first.
seed:
	$(DEV) exec api python cli.py seed-demo $(if $(reset),--reset,)

# make crew name="ATUS" tz="America/Argentina/Buenos_Aires" → prints the invite code
crew:
	@test -n "$(name)" -a -n "$(tz)" || (echo 'usage: make crew name="ATUS" tz="America/Argentina/Buenos_Aires"' && exit 1)
	$(DEV) exec api python cli.py create-crew "$(name)" "$(tz)"

# Stop both stacks and drop their database volumes.
clean:
	$(PROD) down -v --remove-orphans || true
	$(DEV) down -v --remove-orphans || true
