package game

import "github.com/google/uuid"

// PlayerType distinguishes human from AI players
type PlayerType int

const (
	PlayerHuman PlayerType = iota
	PlayerAI
)

// Player represents a civilization in the game
type Player struct {
	ID      string     `json:"id"`
	Name    string     `json:"name"`
	Type    PlayerType `json:"type"`
	Color   string     `json:"color"` // Hex color for UI
	Gold    int        `json:"gold"`
	Science int        `json:"science"`
	Units   []*Unit    `json:"units"`
	Cities  []*City    `json:"cities"`
	IsAlive bool       `json:"is_alive"`
}

// PlayerColors defines available colors for players
var PlayerColors = []string{
	"#FF0000", // Red
	"#0000FF", // Blue
	"#00FF00", // Green
	"#FFFF00", // Yellow
	"#FF00FF", // Magenta
	"#00FFFF", // Cyan
	"#FFA500", // Orange
	"#800080", // Purple
}

// CivilizationNames defines default civilization names
var CivilizationNames = []string{
	"Romans",
	"Egyptians",
	"Greeks",
	"Babylonians",
	"Germans",
	"Russians",
	"Chinese",
	"Americans",
}

// NewPlayer creates a new player
func NewPlayer(name string, playerType PlayerType, colorIndex int) *Player {
	color := PlayerColors[colorIndex%len(PlayerColors)]
	return &Player{
		ID:      uuid.New().String(),
		Name:    name,
		Type:    playerType,
		Color:   color,
		Gold:    StartingGold,
		Science: 0,
		Units:   make([]*Unit, 0),
		Cities:  make([]*City, 0),
		IsAlive: true,
	}
}

// AddUnit adds a unit to the player's forces
func (p *Player) AddUnit(unit *Unit) {
	unit.OwnerID = p.ID
	p.Units = append(p.Units, unit)
}

// RemoveUnit removes a unit from the player's forces
func (p *Player) RemoveUnit(unitID string) {
	for i, u := range p.Units {
		if u.ID == unitID {
			p.Units = append(p.Units[:i], p.Units[i+1:]...)
			return
		}
	}
}

// GetUnit returns a unit by ID, or nil if not found
func (p *Player) GetUnit(unitID string) *Unit {
	for _, u := range p.Units {
		if u.ID == unitID {
			return u
		}
	}
	return nil
}

// AddCity adds a city to the player's empire
func (p *Player) AddCity(city *City) {
	city.OwnerID = p.ID
	p.Cities = append(p.Cities, city)
}

// RemoveCity removes a city from the player's empire
func (p *Player) RemoveCity(cityID string) {
	for i, c := range p.Cities {
		if c.ID == cityID {
			p.Cities = append(p.Cities[:i], p.Cities[i+1:]...)
			return
		}
	}
}

// GetCity returns a city by ID, or nil if not found
func (p *Player) GetCity(cityID string) *City {
	for _, c := range p.Cities {
		if c.ID == cityID {
			return c
		}
	}
	return nil
}

// UnitCount returns the total number of units
func (p *Player) UnitCount() int {
	return len(p.Units)
}

// CityCount returns the total number of cities
func (p *Player) CityCount() int {
	return len(p.Cities)
}

// MilitaryStrength returns a rough estimate of military power
func (p *Player) MilitaryStrength() int {
	strength := 0
	for _, u := range p.Units {
		template := u.Template()
		strength += template.Attack + template.Defense
		if u.IsVeteran {
			strength += 1
		}
	}
	return strength
}

// TotalPopulation returns the sum of all city populations
func (p *Player) TotalPopulation() int {
	pop := 0
	for _, c := range p.Cities {
		pop += c.Population
	}
	return pop
}

// GetUnitsAt returns all units at a specific location
func (p *Player) GetUnitsAt(x, y int) []*Unit {
	units := make([]*Unit, 0)
	for _, u := range p.Units {
		if u.X == x && u.Y == y {
			units = append(units, u)
		}
	}
	return units
}

// GetCityAt returns the city at a specific location, or nil
func (p *Player) GetCityAt(x, y int) *City {
	for _, c := range p.Cities {
		if c.X == x && c.Y == y {
			return c
		}
	}
	return nil
}

// HasUnitsWithMovement returns whether any units can still move
func (p *Player) HasUnitsWithMovement() bool {
	for _, u := range p.Units {
		if u.CanMove() {
			return true
		}
	}
	return false
}

// ResetUnitsMovement resets all units' movement points
func (p *Player) ResetUnitsMovement() {
	for _, u := range p.Units {
		u.ResetMovement()
		// Unfortify doesn't happen automatically
	}
}

// CheckAlive updates the IsAlive status based on remaining cities/settlers
func (p *Player) CheckAlive() {
	// Player is alive if they have any cities
	if len(p.Cities) > 0 {
		p.IsAlive = true
		return
	}

	// Or if they have any settlers (can still found a city)
	for _, u := range p.Units {
		if u.CanFoundCity() {
			p.IsAlive = true
			return
		}
	}

	p.IsAlive = false
}
