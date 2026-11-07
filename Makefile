.PHONY: help dev run test frontend-install frontend-build docker-build docker-up docker-down clean

help:
	@echo "Jovyx Shorts Factory - Developer Commands:"
	@echo "  make dev              - Start backend & frontend in development mode"
	@echo "  make run              - Start production server (auto-builds frontend if needed)"
	@echo "  make test             - Run backend test suite"
	@echo "  make frontend-install - Install Node.js dependencies"
	@echo "  make frontend-build   - Compile Vite React production bundle"
	@echo "  make docker-build     - Build production Docker image"
	@echo "  make docker-up        - Start services via docker-compose"
	@echo "  make docker-down      - Stop docker-compose services"
	@echo "  make clean            - Remove cache files and build artifacts"

dev:
	./run.sh --dev

run:
	./run.sh

test:
	backend/.venv/bin/pytest -v

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build

docker-build:
	docker build -t jovyx-shorts-factory:latest .

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	rm -rf .pytest_cache tests/__pycache__ backend/app/**/__pycache__
	rm -rf frontend/dist
