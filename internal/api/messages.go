package api

import (
	"civilization/internal/game"
	"encoding/json"
)

// MessageType identifies the type of WebSocket message
type MessageType string

const (
	// Client -> Server messages
	MsgTypeAction MessageType = "action"

	// Server -> Client messages
	MsgTypeGameState    MessageType = "game_state"
	MsgTypeUpdate       MessageType = "update"
	MsgTypeCombatResult MessageType = "combat_result"
	MsgTypeTurnChange   MessageType = "turn_change"
	MsgTypeError        MessageType = "error"
)

// WSMessage is the base WebSocket message structure
type WSMessage struct {
	Type    MessageType     `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// ActionMessage is sent by the client to perform an action
type ActionMessage struct {
	ActionType string          `json:"action_type"`
	Data       json.RawMessage `json:"data"`
}

// ErrorMessage is sent when an error occurs
type ErrorMessage struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// GameStateMessage contains the full game state
type GameStateMessage struct {
	ID            string       `json:"id"`
	Turn          int          `json:"turn"`
	CurrentPlayer string       `json:"current_player"`
	Phase         string       `json:"phase"`
	Map           MapDTO       `json:"map"`
	Players       []PlayerDTO  `json:"players"`
	Winner        *PlayerDTO   `json:"winner,omitempty"`
}

// TurnChangeMessage notifies clients of turn changes
type TurnChangeMessage struct {
	Turn          int    `json:"turn"`
	CurrentPlayer string `json:"current_player"`
	PlayerName    string `json:"player_name"`
	Phase         string `json:"phase"`
}

// CombatResultMessage contains combat outcome
type CombatResultMessage struct {
	AttackerID        string `json:"attacker_id"`
	DefenderID        string `json:"defender_id"`
	AttackerWon       bool   `json:"attacker_won"`
	AttackerDestroyed bool   `json:"attacker_destroyed"`
	DefenderDestroyed bool   `json:"defender_destroyed"`
}

// UpdateMessage contains incremental state updates
type UpdateMessage struct {
	UpdateType string      `json:"update_type"`
	Entity     interface{} `json:"entity"`
}

// Data Transfer Objects (DTOs)

// MapDTO represents the map in JSON format
type MapDTO struct {
	Width  int       `json:"width"`
	Height int       `json:"height"`
	Tiles  []TileDTO `json:"tiles"`
}

// TileDTO represents a single tile
type TileDTO struct {
	X             int    `json:"x"`
	Y             int    `json:"y"`
	Terrain       string `json:"terrain"`
	HasRoad       bool   `json:"has_road,omitempty"`
	HasMine       bool   `json:"has_mine,omitempty"`
	HasIrrigation bool   `json:"has_irrigation,omitempty"`
}

// PlayerDTO represents a player
type PlayerDTO struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Color   string    `json:"color"`
	IsHuman bool      `json:"is_human"`
	IsAlive bool      `json:"is_alive"`
	Gold    int       `json:"gold"`
	Units   []UnitDTO `json:"units"`
	Cities  []CityDTO `json:"cities"`
}

// UnitDTO represents a unit
type UnitDTO struct {
	ID           string `json:"id"`
	Type         string `json:"type"`
	OwnerID      string `json:"owner_id"`
	X            int    `json:"x"`
	Y            int    `json:"y"`
	MovementLeft int    `json:"movement_left"`
	Health       int    `json:"health"`
	IsVeteran    bool   `json:"is_veteran"`
	IsFortified  bool   `json:"is_fortified"`
	Attack       int    `json:"attack"`
	Defense      int    `json:"defense"`
	CanFoundCity bool   `json:"can_found_city"`
}

// CityDTO represents a city
type CityDTO struct {
	ID              string        `json:"id"`
	Name            string        `json:"name"`
	OwnerID         string        `json:"owner_id"`
	X               int           `json:"x"`
	Y               int           `json:"y"`
	Population      int           `json:"population"`
	FoodStore       int           `json:"food_store"`
	FoodNeeded      int           `json:"food_needed"`
	Production      int           `json:"production"`
	ProductionNeeded int          `json:"production_needed"`
	CurrentBuild    *BuildItemDTO `json:"current_build,omitempty"`
	Buildings       []string      `json:"buildings"`
}

// BuildItemDTO represents what's being built
type BuildItemDTO struct {
	IsUnit   bool   `json:"is_unit"`
	Name     string `json:"name"`
	Cost     int    `json:"cost"`
}

// Conversion functions

// GameStateToDTO converts a GameState to a DTO
func GameStateToDTO(g *game.GameState) GameStateMessage {
	dto := GameStateMessage{
		ID:            g.ID,
		Turn:          g.CurrentTurn,
		CurrentPlayer: g.Players[g.CurrentPlayer].ID,
		Phase:         g.Phase.String(),
		Map:           MapToDTO(g.Map),
		Players:       make([]PlayerDTO, len(g.Players)),
	}

	for i, p := range g.Players {
		dto.Players[i] = PlayerToDTO(p)
	}

	if g.Winner != nil {
		winner := PlayerToDTO(g.Winner)
		dto.Winner = &winner
	}

	return dto
}

// MapToDTO converts a GameMap to a DTO
func MapToDTO(m *game.GameMap) MapDTO {
	dto := MapDTO{
		Width:  m.Width,
		Height: m.Height,
		Tiles:  make([]TileDTO, 0, m.Width*m.Height),
	}

	for y := 0; y < m.Height; y++ {
		for x := 0; x < m.Width; x++ {
			tile := m.GetTile(x, y)
			dto.Tiles = append(dto.Tiles, TileToDTO(tile))
		}
	}

	return dto
}

// TileToDTO converts a Tile to a DTO
func TileToDTO(t *game.Tile) TileDTO {
	return TileDTO{
		X:             t.X,
		Y:             t.Y,
		Terrain:       t.Terrain.String(),
		HasRoad:       t.HasRoad,
		HasMine:       t.HasMine,
		HasIrrigation: t.HasIrrigation,
	}
}

// PlayerToDTO converts a Player to a DTO
func PlayerToDTO(p *game.Player) PlayerDTO {
	dto := PlayerDTO{
		ID:      p.ID,
		Name:    p.Name,
		Color:   p.Color,
		IsHuman: p.Type == game.PlayerHuman,
		IsAlive: p.IsAlive,
		Gold:    p.Gold,
		Units:   make([]UnitDTO, len(p.Units)),
		Cities:  make([]CityDTO, len(p.Cities)),
	}

	for i, u := range p.Units {
		dto.Units[i] = UnitToDTO(u)
	}

	for i, c := range p.Cities {
		dto.Cities[i] = CityToDTO(c)
	}

	return dto
}

// UnitToDTO converts a Unit to a DTO
func UnitToDTO(u *game.Unit) UnitDTO {
	template := u.Template()
	return UnitDTO{
		ID:           u.ID,
		Type:         template.Name,
		OwnerID:      u.OwnerID,
		X:            u.X,
		Y:            u.Y,
		MovementLeft: u.MovementLeft,
		Health:       u.Health,
		IsVeteran:    u.IsVeteran,
		IsFortified:  u.IsFortified,
		Attack:       template.Attack,
		Defense:      template.Defense,
		CanFoundCity: template.CanFoundCity,
	}
}

// CityToDTO converts a City to a DTO
func CityToDTO(c *game.City) CityDTO {
	dto := CityDTO{
		ID:          c.ID,
		Name:        c.Name,
		OwnerID:     c.OwnerID,
		X:           c.X,
		Y:           c.Y,
		Population:  c.Population,
		FoodStore:   c.FoodStore,
		FoodNeeded:  c.FoodNeededForGrowth(),
		Production:  c.Production,
		Buildings:   make([]string, 0),
	}

	if c.CurrentBuild != nil {
		dto.CurrentBuild = &BuildItemDTO{
			IsUnit: c.CurrentBuild.IsUnit,
			Name:   c.CurrentBuild.Name(),
			Cost:   c.CurrentBuild.Cost(),
		}
		dto.ProductionNeeded = c.CurrentBuild.Cost()
	}

	for building := range c.Buildings {
		dto.Buildings = append(dto.Buildings, building.String())
	}

	return dto
}
