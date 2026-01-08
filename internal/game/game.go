package game

import (
	"errors"
	"github.com/google/uuid"
)

// Common errors
var (
	ErrGameNotStarted    = errors.New("game has not started")
	ErrNotYourTurn       = errors.New("it is not your turn")
	ErrPlayerNotFound    = errors.New("player not found")
	ErrUnitNotFound      = errors.New("unit not found")
	ErrCityNotFound      = errors.New("city not found")
	ErrNotYourUnit       = errors.New("unit does not belong to you")
	ErrNotYourCity       = errors.New("city does not belong to you")
	ErrNoMovementLeft    = errors.New("unit has no movement left")
	ErrInvalidMove       = errors.New("invalid move destination")
	ErrCannotFoundCity   = errors.New("cannot found city here")
	ErrInvalidTarget     = errors.New("invalid attack target")
	ErrGameOver          = errors.New("game is over")
)

// GamePhase represents the current phase of the game
type GamePhase int

const (
	PhaseSetup GamePhase = iota
	PhasePlayerTurn
	PhaseAITurn
	PhaseGameOver
)

// String returns the string representation of a game phase
func (p GamePhase) String() string {
	switch p {
	case PhaseSetup:
		return "setup"
	case PhasePlayerTurn:
		return "player_turn"
	case PhaseAITurn:
		return "ai_turn"
	case PhaseGameOver:
		return "game_over"
	default:
		return "unknown"
	}
}

// GameConfig holds configuration for creating a new game
type GameConfig struct {
	MapWidth    int   `json:"map_width"`
	MapHeight   int   `json:"map_height"`
	Seed        int64 `json:"seed"`
	PlayerCount int   `json:"player_count"` // Total players including human
	PlayerName  string `json:"player_name"`
}

// DefaultGameConfig returns a default game configuration
func DefaultGameConfig() GameConfig {
	return GameConfig{
		MapWidth:    DefaultMapWidth,
		MapHeight:   DefaultMapHeight,
		Seed:        0, // Will use current time if 0
		PlayerCount: 4,
		PlayerName:  "Player",
	}
}

// GameState represents the entire state of a game
type GameState struct {
	ID            string    `json:"id"`
	Map           *GameMap  `json:"map"`
	Players       []*Player `json:"players"`
	CurrentTurn   int       `json:"current_turn"`
	CurrentPlayer int       `json:"current_player"` // Index into Players
	Phase         GamePhase `json:"phase"`
	Winner        *Player   `json:"winner,omitempty"`
}

// NewGame creates a new game with the given configuration
// Note: Map generation is handled separately by mapgen package
func NewGame(config GameConfig) *GameState {
	g := &GameState{
		ID:            uuid.New().String(),
		CurrentTurn:   1,
		CurrentPlayer: 0,
		Phase:         PhaseSetup,
	}

	// Create players
	g.Players = make([]*Player, config.PlayerCount)

	// First player is human
	g.Players[0] = NewPlayer(config.PlayerName, PlayerHuman, 0)

	// Rest are AI
	for i := 1; i < config.PlayerCount; i++ {
		name := CivilizationNames[i%len(CivilizationNames)]
		g.Players[i] = NewPlayer(name, PlayerAI, i)
	}

	return g
}

// SetMap sets the game map (called after map generation)
func (g *GameState) SetMap(gm *GameMap) {
	g.Map = gm
}

// Start begins the game
func (g *GameState) Start() {
	g.Phase = PhasePlayerTurn
	g.CurrentTurn = 1
	g.CurrentPlayer = 0
}

// GetCurrentPlayer returns the player whose turn it is
func (g *GameState) GetCurrentPlayer() *Player {
	if g.CurrentPlayer >= 0 && g.CurrentPlayer < len(g.Players) {
		return g.Players[g.CurrentPlayer]
	}
	return nil
}

// GetPlayer returns a player by ID
func (g *GameState) GetPlayer(playerID string) *Player {
	for _, p := range g.Players {
		if p.ID == playerID {
			return p
		}
	}
	return nil
}

// GetPlayerIndex returns the index of a player, or -1 if not found
func (g *GameState) GetPlayerIndex(playerID string) int {
	for i, p := range g.Players {
		if p.ID == playerID {
			return i
		}
	}
	return -1
}

// GetUnit returns a unit by ID from any player
func (g *GameState) GetUnit(unitID string) *Unit {
	for _, p := range g.Players {
		if u := p.GetUnit(unitID); u != nil {
			return u
		}
	}
	return nil
}

// GetUnitOwner returns the player who owns a unit
func (g *GameState) GetUnitOwner(unitID string) *Player {
	for _, p := range g.Players {
		if u := p.GetUnit(unitID); u != nil {
			return p
		}
	}
	return nil
}

// GetCity returns a city by ID from any player
func (g *GameState) GetCity(cityID string) *City {
	for _, p := range g.Players {
		if c := p.GetCity(cityID); c != nil {
			return c
		}
	}
	return nil
}

// GetCityOwner returns the player who owns a city
func (g *GameState) GetCityOwner(cityID string) *Player {
	for _, p := range g.Players {
		if c := p.GetCity(cityID); c != nil {
			return p
		}
	}
	return nil
}

// GetCityAt returns the city at a specific location, if any
func (g *GameState) GetCityAt(x, y int) *City {
	for _, p := range g.Players {
		if c := p.GetCityAt(x, y); c != nil {
			return c
		}
	}
	return nil
}

// GetUnitsAt returns all units at a specific location
func (g *GameState) GetUnitsAt(x, y int) []*Unit {
	units := make([]*Unit, 0)
	for _, p := range g.Players {
		units = append(units, p.GetUnitsAt(x, y)...)
	}
	return units
}

// GetEnemyUnitsAt returns enemy units at a location
func (g *GameState) GetEnemyUnitsAt(x, y int, playerID string) []*Unit {
	units := make([]*Unit, 0)
	for _, p := range g.Players {
		if p.ID != playerID {
			units = append(units, p.GetUnitsAt(x, y)...)
		}
	}
	return units
}

// IsValidMove checks if a unit can move to the destination
func (g *GameState) IsValidMove(unit *Unit, toX, toY int) bool {
	// Check bounds
	if !g.Map.IsValidCoord(toX, toY) {
		return false
	}

	// Check adjacency (can only move one tile at a time)
	dx := abs(toX - unit.X)
	dy := abs(toY - unit.Y)
	if dx > 1 || dy > 1 || (dx == 0 && dy == 0) {
		return false
	}

	// Check terrain passability
	tile := g.Map.GetTile(toX, toY)
	if tile == nil {
		return false
	}

	// Land units can't enter water (unless naval)
	template := unit.Template()
	if !template.IsNaval && tile.IsWater() {
		return false
	}

	// Naval units can't enter land
	if template.IsNaval && !tile.IsWater() {
		return false
	}

	// Check movement cost
	cost := tile.MovementCost()
	if unit.MovementLeft < cost {
		// Allow move if unit has any movement left (minimum 1 move per turn)
		if unit.MovementLeft <= 0 {
			return false
		}
	}

	return true
}

// GetMovementCost returns the movement cost to move between tiles
func (g *GameState) GetMovementCost(fromX, fromY, toX, toY int) int {
	tile := g.Map.GetTile(toX, toY)
	if tile == nil {
		return 999
	}
	return tile.MovementCost()
}

// GetCityTiles returns the tiles that a city can work
func (g *GameState) GetCityTiles(city *City) []*Tile {
	return g.Map.GetCityRadius(city.X, city.Y)
}

// EndTurn processes the end of the current player's turn
func (g *GameState) EndTurn() error {
	if g.Phase == PhaseGameOver {
		return ErrGameOver
	}

	player := g.GetCurrentPlayer()
	if player == nil {
		return ErrPlayerNotFound
	}

	// Process all cities
	for _, city := range player.Cities {
		tiles := g.GetCityTiles(city)
		newUnit, _ := city.ProcessTurn(tiles)
		if newUnit != nil {
			player.AddUnit(newUnit)
		}
	}

	// Check for victory
	if g.checkVictory() {
		return nil
	}

	// Advance to next player
	g.advanceToNextPlayer()

	return nil
}

// advanceToNextPlayer moves to the next player's turn
func (g *GameState) advanceToNextPlayer() {
	for {
		g.CurrentPlayer++
		if g.CurrentPlayer >= len(g.Players) {
			g.CurrentPlayer = 0
			g.CurrentTurn++

			// Reset all units' movement at the start of each round
			for _, p := range g.Players {
				p.ResetUnitsMovement()
			}
		}

		// Skip eliminated players
		if g.Players[g.CurrentPlayer].IsAlive {
			break
		}

		// Safety check to prevent infinite loop if all players are dead
		allDead := true
		for _, p := range g.Players {
			if p.IsAlive {
				allDead = false
				break
			}
		}
		if allDead {
			g.Phase = PhaseGameOver
			return
		}
	}

	// Set phase based on player type
	if g.Players[g.CurrentPlayer].Type == PlayerAI {
		g.Phase = PhaseAITurn
	} else {
		g.Phase = PhasePlayerTurn
	}
}

// checkVictory checks if any player has won
func (g *GameState) checkVictory() bool {
	alivePlayers := make([]*Player, 0)
	for _, p := range g.Players {
		p.CheckAlive()
		if p.IsAlive {
			alivePlayers = append(alivePlayers, p)
		}
	}

	// If only one player remains, they win
	if len(alivePlayers) == 1 {
		g.Winner = alivePlayers[0]
		g.Phase = PhaseGameOver
		return true
	}

	// If no players remain (shouldn't happen)
	if len(alivePlayers) == 0 {
		g.Phase = PhaseGameOver
		return true
	}

	return false
}

// IsCurrentPlayerTurn checks if it's the given player's turn
func (g *GameState) IsCurrentPlayerTurn(playerID string) bool {
	current := g.GetCurrentPlayer()
	return current != nil && current.ID == playerID
}

// RemoveUnit removes a unit from the game
func (g *GameState) RemoveUnit(unitID string) {
	for _, p := range g.Players {
		if u := p.GetUnit(unitID); u != nil {
			p.RemoveUnit(unitID)
			p.CheckAlive()
			return
		}
	}
}

// TransferCity transfers a city to a new owner
func (g *GameState) TransferCity(city *City, newOwnerID string) {
	oldOwner := g.GetPlayer(city.OwnerID)
	newOwner := g.GetPlayer(newOwnerID)

	if oldOwner != nil {
		oldOwner.RemoveCity(city.ID)
		oldOwner.CheckAlive()
	}

	if newOwner != nil {
		newOwner.AddCity(city)
	}
}

// Helper function
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// GetHumanPlayer returns the human player (first player)
func (g *GameState) GetHumanPlayer() *Player {
	for _, p := range g.Players {
		if p.Type == PlayerHuman {
			return p
		}
	}
	return nil
}

// GetAIPlayers returns all AI players
func (g *GameState) GetAIPlayers() []*Player {
	aiPlayers := make([]*Player, 0)
	for _, p := range g.Players {
		if p.Type == PlayerAI {
			aiPlayers = append(aiPlayers, p)
		}
	}
	return aiPlayers
}
