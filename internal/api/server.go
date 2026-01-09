package api

import (
	"civilization/internal/game"
	"civilization/internal/mapgen"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Server handles HTTP requests and WebSocket connections
type Server struct {
	hub        *Hub
	game       *game.GameState
	staticPath string
	savesPath  string
}

// NewServer creates a new API server
func NewServer(staticPath string) *Server {
	// Create saves directory relative to working directory
	savesPath := "saves"
	if err := os.MkdirAll(savesPath, 0755); err != nil {
		log.Printf("Warning: could not create saves directory: %v", err)
	}

	return &Server{
		staticPath: staticPath,
		savesPath:  savesPath,
	}
}

// NewGame creates a new game with the given configuration
func (s *Server) NewGame(config game.GameConfig) {
	// Create game state
	s.game = game.NewGame(config)

	// Generate map with players
	mapConfig := mapgen.GeneratorConfig{
		Width:         config.MapWidth,
		Height:        config.MapHeight,
		Seed:          config.Seed,
		WaterLevel:    0.35,
		MountainLevel: 0.75,
		MapType:       config.MapType,
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
	mux.HandleFunc("/api/game/saves", s.handleListSaves)

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

// handleSaveGame saves the current game state to a file
func (s *Server) handleSaveGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.game == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "No game in progress",
		})
		return
	}

	state := GameStateToDTO(s.game)

	// Generate filename with timestamp
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("save_%s.json", timestamp)
	savePath := filepath.Join(s.savesPath, filename)

	// Write to file
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to serialize game state",
		})
		return
	}

	if err := os.WriteFile(savePath, data, 0644); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to write save file: %v", err),
		})
		return
	}

	log.Printf("Game saved to: %s", savePath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"filename": filename,
		"path":     savePath,
	})
}

// handleListSaves returns a list of save files
func (s *Server) handleListSaves(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	files, err := os.ReadDir(s.savesPath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Failed to read saves directory",
		})
		return
	}

	type SaveInfo struct {
		Filename string `json:"filename"`
		Modified string `json:"modified"`
		Size     int64  `json:"size"`
	}

	saves := make([]SaveInfo, 0)
	for _, file := range files {
		if file.IsDir() || filepath.Ext(file.Name()) != ".json" {
			continue
		}
		info, err := file.Info()
		if err != nil {
			continue
		}
		saves = append(saves, SaveInfo{
			Filename: file.Name(),
			Modified: info.ModTime().Format("2006-01-02 15:04:05"),
			Size:     info.Size(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"saves":   saves,
	})
}

// handleLoadGame loads a game from save data
func (s *Server) handleLoadGame(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request to get filename
	var req struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Invalid request",
		})
		return
	}

	// Read save file
	savePath := filepath.Join(s.savesPath, req.Filename)
	data, err := os.ReadFile(savePath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to read save file: %v", err),
		})
		return
	}

	// Parse save data
	var saveData GameStateMessage
	if err := json.Unmarshal(data, &saveData); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Failed to parse save file: %v", err),
		})
		return
	}

	// Convert DTO to game state
	s.game = DTOToGameState(&saveData)

	// Create new hub for WebSocket connections
	if s.hub != nil {
		// Close existing hub connections
		s.hub.Close()
	}
	s.hub = NewHub(s.game)
	go s.hub.Run()

	log.Printf("Game loaded from: %s", savePath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
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
