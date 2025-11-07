.PHONY: help install test lint format type-check clean dev run-ftp run-parser deploy-aws

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
	@echo "  make run-ftp          Run FTP sync worker"
	@echo "  make run-parser       Run NetCDF parser worker"
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
	uv run black src/ tests/ || true

type-check:
	uv run mypy src/atlas_workers --ignore-missing-imports

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + || true
	find . -type f -name "*.pyc" -delete || true
	rm -rf .pytest_cache/ || true
	rm -rf .mypy_cache/ || true
	rm -rf htmlcov/ || true
	rm -rf .coverage || true
	rm -rf dist/ build/ *.egg-info/ || true

run-ftp:
	uv run python -m src.atlas_workers.workers.ftp_sync

run-parser:
	uv run python -m src.atlas_workers.workers.netcdf_parser

deploy-aws:
	@echo "Preparing Lambda package..."
	mkdir -p lambda-package
	cp -r src/atlas_workers lambda-package/
	pip install -r requirements.txt -t lambda-package/ --quiet || true
	cd lambda-package && zip -r ../function.zip . && cd ..
	@echo "✓ Lambda package created: function.zip"
	@echo "Deploy with: aws lambda update-function-code --function-name argo-ftp-sync --zip-file fileb://function.zip"
