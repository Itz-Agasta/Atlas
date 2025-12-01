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

install:
	uv sync

dev:
	uv sync --extra dev

test:
	uv run pytest tests/ -v

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
	@echo "Running ARGO loader (single float: $(FLOAT_ID))..."
	infisical run --env=dev -- uv run python -m src.atlas_workers.main \
		--float-id $(FLOAT_ID)

run-batch:
	@echo "Running ARGO loader (batch mode)..."
	infisical run --env=dev -- uv run python -m src.atlas_workers.main \
		--batch