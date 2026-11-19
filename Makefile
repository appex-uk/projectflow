.DEFAULT_GOAL := build

GO ?= go
NODE ?= node
APP_NAME ?= projectflow
BUILD_DIR ?= dist
MAIN_PACKAGE := ./cmd/server
GO_BUILD_FLAGS ?=

NATIVE_GOOS := $(shell $(GO) env GOOS)
NATIVE_EXT := $(if $(filter windows,$(NATIVE_GOOS)),.exe,)
TARGET_OS := $(if $(filter darwin,$(GOOS)),mac,$(GOOS))
TARGET_EXT := $(if $(filter windows,$(GOOS)),.exe,)

.PHONY: all build build-all release \
	windows windows-amd64 windows-arm64 \
	mac macos mac-amd64 mac-arm64 \
	linux linux-amd64 linux-arm64 \
	build-target test test-frontend test-all vet clean help

build:
	@mkdir -p "$(BUILD_DIR)"
	@echo "Building ProjectFlow for $(NATIVE_GOOS)..."
	CGO_ENABLED=0 $(GO) build -trimpath $(GO_BUILD_FLAGS) \
		-o "$(BUILD_DIR)/$(APP_NAME)$(NATIVE_EXT)" "$(MAIN_PACKAGE)"

windows: windows-amd64 windows-arm64

windows-amd64:
	@$(MAKE) --no-print-directory build-target GOOS=windows GOARCH=amd64

windows-arm64:
	@$(MAKE) --no-print-directory build-target GOOS=windows GOARCH=arm64

mac macos: mac-amd64 mac-arm64

mac-amd64:
	@$(MAKE) --no-print-directory build-target GOOS=darwin GOARCH=amd64

mac-arm64:
	@$(MAKE) --no-print-directory build-target GOOS=darwin GOARCH=arm64

linux: linux-amd64 linux-arm64

linux-amd64:
	@$(MAKE) --no-print-directory build-target GOOS=linux GOARCH=amd64

linux-arm64:
	@$(MAKE) --no-print-directory build-target GOOS=linux GOARCH=arm64

all release build-all: windows mac linux

build-target:
	@test -n "$(GOOS)" || (echo "GOOS is required"; exit 1)
	@test -n "$(GOARCH)" || (echo "GOARCH is required"; exit 1)
	@mkdir -p "$(BUILD_DIR)"
	@echo "Building ProjectFlow for $(TARGET_OS)/$(GOARCH)..."
	CGO_ENABLED=0 GOOS="$(GOOS)" GOARCH="$(GOARCH)" $(GO) build -trimpath $(GO_BUILD_FLAGS) \
		-o "$(BUILD_DIR)/$(APP_NAME)-$(TARGET_OS)-$(GOARCH)$(TARGET_EXT)" "$(MAIN_PACKAGE)"

test:
	$(GO) test -count=1 ./...

test-frontend:
	$(NODE) --test web/tests/*.test.mjs

test-all: test test-frontend

vet:
	$(GO) vet ./...

clean:
	rm -rf "$(BUILD_DIR)"

help:
	@echo "ProjectFlow build targets:"
	@echo "  make build            Build for the current platform"
	@echo "  make windows          Build Windows amd64 and arm64 binaries"
	@echo "  make mac              Build macOS Intel and Apple Silicon binaries"
	@echo "  make linux            Build Linux amd64 and arm64 binaries"
	@echo "  make release          Build all six platform binaries"
	@echo "  make test             Run the Go test suite"
	@echo "  make test-frontend    Run frontend unit tests"
	@echo "  make test-all         Run Go and frontend tests"
	@echo "  make vet              Run go vet"
	@echo "  make clean            Remove $(BUILD_DIR)"
