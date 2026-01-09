package api

import (
	"civilization/internal/game"
	"civilization/internal/mapgen"
	"encoding/json"
	"log"
	"net/http"
	"path/filepath"
)

// Server handles HTTP requests and WebSocket connections
type Server struct {
	hub        *Hub
	game       *game.GameState
	staticPath string
}

// NewServer creates a new API server
func NewServer(staticPath string) *Server {
	return &Server{
		staticPath: staticPath,
	}
}

// NewGame creates a new game with the given configuration
func (s *Server) NewGame(config game.GameConfig) {
	// Create game state
	s.game = game.NewGame(config)

	// Generate map with players
	mapConfig := mapgen.GeneratorConfig{
		Width:       config.MapWidth,
		Height:      config.MapHeight,
		Seed:        config.Seed,
		WaterLevel:  0.35,
		MountainLevel: 0.75,
	}

	gm := mapgen.GenerateWithPlayers(mapConfig, s.game.Players)
	s.game.SetMap(gm)

	// Start the game
	s.game.Start()

	// Create hub for WebSocket connections
	s.hub = NewHub(s.game)
	go s.hub.Run()
}

// SetupRoutes configures HTTP routes
func (s *Server) SetupRoutes() http.Handler {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("/api/game/new", s.handleNewGame)
	mux.HandleFunc("/api/game", s.handleGetGame)
	mux.HandleFunc("/api/game/save", s.handleSaveGame)
	mux.HandleFunc("/api/game/load", s.handleLoadGame)

	// WebSocket
	mux.HandleFunc("/ws", s.handleWebSocket)

	// Static files
	fs := http.FileServer(http.Dir(s.staticPath))
	mux.Handle("/", fs)

	// Wrap with CORS middleware
	return corsMiddleware(mux)
}

// handleNewGame creates a new game
func (s *Server) handleNewGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config game.GameConfig

	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			// Use defaults if parsing fails
			config = game.DefaultGameConfig()
		}
	} else {
		config = game.DefaultGameConfig()
	}

	// Validate config
	if config.MapWidth < 20 {
		config.MapWidth = 20
	}
	if config.MapWidth > 200 {
		config.MapWidth = 200
	}
	if config.MapHeight < 20 {
		config.MapHeight = 20
	}
	if config.MapHeight > 200 {
		config.MapHeight = 200
	}
	if config.PlayerCount < 2 {
		config.PlayerCount = 2
	}
	if config.PlayerCount > 8 {
		config.PlayerCount = 8
	}
	if config.PlayerName == "" {
		config.PlayerName = "Player"
	}

	s.NewGame(config)

	state := GameStateToDTO(s.game)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

// handleGetGame returns the current game state
func (s *Server) handleGetGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.game == nil {
		http.Error(w, "No game in progress", http.StatusNotFound)
		return
	}

	state := GameStateToDTO(s.game)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

// handleSaveGame returns the current game state for saving
func (s *Server) handleSaveGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.game == nil {
		http.Error(w, "No game in progress", http.StatusNotFound)
		return
	}

	state := GameStateToDTO(s.game)
	response := map[string]interface{}{
		"success":   true,
		"save_data": state,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleLoadGame loads a game from save data
func (s *Server) handleLoadGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Implement full game state restoration
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   "Load game is not yet implemented",
	})
}

// handleWebSocket handles WebSocket upgrade requests
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if s.hub == nil {
		http.Error(w, "No game in progress", http.StatusBadRequest)
		return
	}

	s.hub.HandleWebSocket(w, r)
}

// corsMiddleware adds CORS headers to responses
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Run starts the HTTP server
func (s *Server) Run(addr string) error {
	handler := s.SetupRoutes()

	// Get absolute path for static files
	absPath, err := filepath.Abs(s.staticPath)
	if err != nil {
		log.Printf("Warning: could not resolve static path: %v", err)
	} else {
		log.Printf("Serving static files from: %s", absPath)
	}

	log.Printf("Starting server at %s", addr)
	return http.ListenAndServe(addr, handler)
}
