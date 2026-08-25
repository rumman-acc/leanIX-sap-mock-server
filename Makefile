# Makefile

.PHONY: setup dev test migrate seed clean build

setup:
	cp -n .env.mock .env || true
	docker compose -f docker/docker-compose.yml up -d postgres redis
	sleep 5
	cd packages/prisma && npx prisma migrate deploy
	cd packages/prisma && npx prisma db seed

dev:
	docker compose -f docker/docker-compose.yml up

build:
	npm run build

test:
	npm run test --workspace=apps/api
	npm run test:e2e --workspace=apps/api

migrate:
	cd packages/prisma && npx prisma migrate dev

seed:
	cd packages/prisma && npx prisma db seed

clean:
	docker compose -f docker/docker-compose.yml down -v
	rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist packages/prisma/generated
