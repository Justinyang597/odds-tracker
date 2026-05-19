.PHONY: up down logs migrate test

# Start all services, rebuilding images if source changed.
up:
	docker compose up --build -d

# Stop and remove containers (volumes are preserved).
down:
	docker compose down

# Tail backend logs.
logs:
	docker compose logs -f backend

# Migrations run automatically on startup — just restart the backend.
migrate:
	docker compose restart backend

# Run all Go tests.
test:
	cd backend && go test ./...
