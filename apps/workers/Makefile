.PHONY: help install test lint format type-check clean dev run-single run-batch deploy-aws

help:
	@echo "ARGO Workers - Makefile Commands"
	@echo "================================"
	@echo "  make install          Install dependencies"
	@echo "  make dev              Install dev dependencies"
	@echo "  make test             Run all tests"
	@echo "  make lint             Run code linting"
	@echo "  make format           Format code"
	@echo "  make type-check       Run type checking"
	@echo "  make clean            Clean build artifacts"
	@echo "  make run-single       Run ARGO loader (single float)"
	@echo "  make run-batch        Run ARGO loader (batch mode)"
	@echo "  make deploy-aws       Deploy to AWS Lambda"

install:
	uv sync

dev:
	uv sync --extra dev

test:
	uv run pytest tests/ -v --cov=src/atlas_workers --cov-report=term-missing

lint:
	uv run ruff check src/ tests/

format:
	uv run ruff format src/ tests/

type-check:
	uv run pyrefly check src/atlas_workers

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + || true
	find . -type f -name "*.pyc" -delete || true
	rm -rf .pytest_cache/ || true
	rm -rf .ruff_cache/ || true
	rm -rf htmlcov/ || true
	rm -rf .coverage || true
	rm -rf dist/ build/ *.egg-info/ || true

run-single:
	# Note: Requires infisical CLI installed and configured
	# Install: https://infisical.com/docs/cli/overview
	@if [ -z "$(FLOAT_ID)" ]; then \
		echo "Error: FLOAT_ID is required. Usage: make run-single FLOAT_ID=<id>"; \
		exit 1; \
	fi
	@echo "Running ARGO loader (single float: $(FLOAT_ID))..."
	infisical run --env=dev -- uv run python -m src.atlas_workers.main \
		--float-id $(FLOAT_ID)

run-batch:
	@echo "Running ARGO loader (batch mode)..."
	infisical run --env=dev -- uv run python -m src.atlas_workers.main \
		--batch

deploy-aws:
	@echo "Preparing Lambda package..."
	mkdir -p lambda-package
	cp -r src/atlas_workers lambda-package/
	uv export --no-dev -o /tmp/requirements.txt --quiet
	pip install -r /tmp/requirements.txt -t lambda-package/ --quiet --disable-pip-version-check --no-warn-conflicts >/dev/null 2>&1
	rm /tmp/requirements.txt
	cd lambda-package && zip -r ../function.zip . && cd ..
	@echo "✓ Lambda package created: function.zip"
	@echo "Deploy with: aws lambda update-function-code --function-name argo-ftp-sync --zip-file fileb://function.zip"
