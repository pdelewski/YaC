.PHONY: build run clean test deps

# Build the server
build:
	go build -o bin/civilization ./cmd/server

# Run the server (development mode)
run:
	go run ./cmd/server

# Run with specific port
run-port:
	go run ./cmd/server -addr :$(PORT)

# Install dependencies
deps:
	go mod tidy
	go mod download

# Clean build artifacts
clean:
	rm -rf bin/
	go clean

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-cover:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Format code
fmt:
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Build for multiple platforms
build-all: build-linux build-darwin build-windows

build-linux:
	GOOS=linux GOARCH=amd64 go build -o bin/civilization-linux-amd64 ./cmd/server

build-darwin:
	GOOS=darwin GOARCH=amd64 go build -o bin/civilization-darwin-amd64 ./cmd/server
	GOOS=darwin GOARCH=arm64 go build -o bin/civilization-darwin-arm64 ./cmd/server

build-windows:
	GOOS=windows GOARCH=amd64 go build -o bin/civilization-windows-amd64.exe ./cmd/server

# Help
help:
	@echo "Civilization Game - Makefile Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build      - Build the server binary"
	@echo "  make run        - Run the server (development mode)"
	@echo "  make deps       - Install dependencies"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make test       - Run tests"
	@echo "  make fmt        - Format code"
	@echo "  make lint       - Lint code"
	@echo "  make build-all  - Build for all platforms"
	@echo ""
	@echo "Server will be available at http://localhost:8888"
