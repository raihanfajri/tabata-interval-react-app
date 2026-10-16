# Thin wrappers around the npm scripts in package.json, which stay the source
# of truth. Recipes only call npm/node, so they work whether make runs them
# through sh (Git Bash) or cmd.

.DEFAULT_GOAL := help
.PHONY: help install dev build preview lint test test-watch coverage check android icons-android clean

help:
	@echo "make install        Install dependencies (npm ci)"
	@echo "make dev            Vite dev server with HMR"
	@echo "make build          Type-check and build the PWA to dist/"
	@echo "make preview        Serve dist/ (test install and offline here)"
	@echo "make lint           Run oxlint"
	@echo "make test           Run the tests once"
	@echo "make test-watch     Run the tests in watch mode"
	@echo "make coverage       Run the tests once with coverage"
	@echo "make check          Lint, test, then build (what to run before a commit)"
	@echo "make android        Build the debug APK (Windows only)"
	@echo "make icons-android  Regenerate the APK icon and splash from public/favicon.svg"
	@echo "make clean          Remove dist/ and dist-android/"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

lint:
	npm run lint

test:
	npm run test:run

test-watch:
	npm test

coverage:
	npm run test:coverage

check: lint test build

android:
	npm run build:android

icons-android:
	npm run icons:android

clean:
	node -e "for (const d of ['dist', 'dist-android']) require('fs').rmSync(d, { recursive: true, force: true })"
