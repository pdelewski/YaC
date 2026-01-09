package main

import (
	"civilization/internal/api"
	"civilization/internal/game"
	"flag"
	"log"
	"os"
	"path/filepath"
)

func main() {
	// Command line flags
	addr := flag.String("addr", ":8888", "HTTP server address")
	webDir := flag.String("web", "", "Path to web directory (default: ./web)")
	flag.Parse()

	// Determine web directory path
	staticPath := *webDir
	if staticPath == "" {
		// Try to find web directory relative to executable or working directory
		execPath, err := os.Executable()
		if err == nil {
			// Try relative to executable
			staticPath = filepath.Join(filepath.Dir(execPath), "web")
			if _, err := os.Stat(staticPath); os.IsNotExist(err) {
				// Try relative to working directory
				staticPath = "web"
			}
		} else {
			staticPath = "web"
		}
	}

	// Verify web directory exists
	if _, err := os.Stat(staticPath); os.IsNotExist(err) {
		log.Fatalf("Web directory not found: %s", staticPath)
	}

	log.Printf("Starting Civilization server...")
	log.Printf("Web directory: %s", staticPath)
	log.Printf("Server address: %s", *addr)

	// Create server
	server := api.NewServer(staticPath)

	// Create a default game to start with
	config := game.DefaultGameConfig()
	server.NewGame(config)

	// Start server
	log.Printf("Open http://localhost%s in your browser to play", *addr)
	if err := server.Run(*addr); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
