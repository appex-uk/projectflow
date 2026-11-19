package main

import (
	"log"

	"github.com/appex-uk/projectflow/internal/config"
	"github.com/appex-uk/projectflow/internal/mcp"
	"github.com/appex-uk/projectflow/internal/storage"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize storage
	store, err := storage.NewStorage(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	// Serve stdio for backwards compatibility. The main server exposes the same
	// MCP registry over HTTP at /mcp.
	log.Println("Starting ProjectFlow MCP stdio server...")
	if err := mcpserver.ServeStdio(mcp.NewProtocolServer(store)); err != nil {
		log.Fatalf("MCP server error: %v", err)
	}

	log.Println("ProjectFlow MCP server stopped")
}
