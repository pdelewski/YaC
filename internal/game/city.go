package game

import "github.com/google/uuid"

// BuildingType represents different buildings that can be constructed
type BuildingType int

const (
	BuildingNone BuildingType = iota
	BuildingBarracks
	BuildingGranary
	BuildingWalls
	BuildingMarketplace
	BuildingLibrary
)

// String returns the string representation of a building type
func (b BuildingType) String() string {
	switch b {
	case BuildingBarracks:
		return "Barracks"
	case BuildingGranary:
		return "Granary"
	case BuildingWalls:
		return "Walls"
	case BuildingMarketplace:
		return "Marketplace"
	case BuildingLibrary:
		return "Library"
	default:
		return "None"
	}
}

// BuildingCosts defines the production cost for each building
var BuildingCosts = map[BuildingType]int{
	BuildingBarracks:    40,
	BuildingGranary:     60,
	BuildingWalls:       80,
	BuildingMarketplace: 80,
	BuildingLibrary:     80,
}

// BuildItem represents what a city is currently building
type BuildItem struct {
	IsUnit   bool         `json:"is_unit"`
	UnitType UnitType     `json:"unit_type,omitempty"`
	Building BuildingType `json:"building,omitempty"`
}

// Cost returns the production cost of the build item
func (b *BuildItem) Cost() int {
	if b.IsUnit {
		return UnitTemplates[b.UnitType].Cost
	}
	return BuildingCosts[b.Building]
}

// Name returns the name of what's being built
func (b *BuildItem) Name() string {
	if b.IsUnit {
		return UnitTemplates[b.UnitType].Name
	}
	return b.Building.String()
}

// City represents a player's city
type City struct {
	ID           string                `json:"id"`
	Name         string                `json:"name"`
	OwnerID      string                `json:"owner_id"`
	X            int                   `json:"x"`
	Y            int                   `json:"y"`
	Population   int                   `json:"population"`
	FoodStore    int                   `json:"food_store"`
	Production   int                   `json:"production"`
	Buildings    map[BuildingType]bool `json:"buildings"`
	CurrentBuild *BuildItem            `json:"current_build,omitempty"`
}

// NewCity creates a new city at the specified location
func NewCity(name, ownerID string, x, y int) *City {
	return &City{
		ID:         uuid.New().String(),
		Name:       name,
		OwnerID:    ownerID,
		X:          x,
		Y:          y,
		Population: 1,
		FoodStore:  0,
		Production: 0,
		Buildings:  make(map[BuildingType]bool),
	}
}

// FoodNeededForGrowth returns the food required to grow to the next population level
func (c *City) FoodNeededForGrowth() int {
	return BaseFoodForGrowth + c.Population*FoodPerPopForGrowth
}

// FoodConsumed returns the food consumed by the city's population per turn
func (c *City) FoodConsumed() int {
	return c.Population * BaseFoodPerCitizen
}

// CalculateFoodPerTurn calculates food production minus consumption
func (c *City) CalculateFoodPerTurn(tiles []*Tile) int {
	produced := 0
	for _, tile := range tiles {
		produced += tile.FoodYield()
	}
	// Add city center tile bonus
	produced += 2

	return produced - c.FoodConsumed()
}

// CalculateProductionPerTurn calculates shields produced per turn
func (c *City) CalculateProductionPerTurn(tiles []*Tile) int {
	produced := 0
	for _, tile := range tiles {
		produced += tile.ProductionYield()
	}
	// Add city center production
	produced += 1

	return produced
}

// HasBuilding checks if the city has a specific building
func (c *City) HasBuilding(building BuildingType) bool {
	return c.Buildings[building]
}

// AddBuilding adds a building to the city
func (c *City) AddBuilding(building BuildingType) {
	c.Buildings[building] = true
}

// HasWalls checks if the city has defensive walls
func (c *City) HasWalls() bool {
	return c.HasBuilding(BuildingWalls)
}

// HasBarracks checks if the city has barracks
func (c *City) HasBarracks() bool {
	return c.HasBuilding(BuildingBarracks)
}

// HasGranary checks if the city has a granary
func (c *City) HasGranary() bool {
	return c.HasBuilding(BuildingGranary)
}

// SetProduction sets what the city should build
func (c *City) SetProduction(item BuildItem) {
	c.CurrentBuild = &item
}

// ClearProduction clears the current production
func (c *City) ClearProduction() {
	c.CurrentBuild = nil
	c.Production = 0
}

// ProcessTurn handles end-of-turn processing for the city
// Returns a new unit if one was produced, nil otherwise
func (c *City) ProcessTurn(tiles []*Tile) (*Unit, BuildingType) {
	// Process food
	foodNet := c.CalculateFoodPerTurn(tiles)
	c.FoodStore += foodNet

	// Check for starvation
	if c.FoodStore < 0 {
		c.Population--
		c.FoodStore = 0
		if c.Population < 1 {
			c.Population = 1
		}
	}

	// Check for growth
	if c.FoodStore >= c.FoodNeededForGrowth() {
		c.Population++
		if c.HasGranary() {
			c.FoodStore = c.FoodNeededForGrowth() * GranaryFoodRetention / 100
		} else {
			c.FoodStore = 0
		}
	}

	// Process production
	var newUnit *Unit
	var newBuilding BuildingType

	if c.CurrentBuild != nil {
		shields := c.CalculateProductionPerTurn(tiles)
		c.Production += shields

		if c.Production >= c.CurrentBuild.Cost() {
			if c.CurrentBuild.IsUnit {
				// Create new unit
				newUnit = NewUnit(c.CurrentBuild.UnitType, c.OwnerID, c.X, c.Y)
				if c.HasBarracks() {
					newUnit.IsVeteran = true
				}
			} else {
				// Add building
				c.AddBuilding(c.CurrentBuild.Building)
				newBuilding = c.CurrentBuild.Building
			}
			c.Production = 0
			// Keep the same production item (auto-repeat for units)
			if !c.CurrentBuild.IsUnit {
				c.CurrentBuild = nil
			}
		}
	}

	return newUnit, newBuilding
}

// TurnsUntilGrowth returns estimated turns until population growth
func (c *City) TurnsUntilGrowth(tiles []*Tile) int {
	netFood := c.CalculateFoodPerTurn(tiles)
	if netFood <= 0 {
		return -1 // Never
	}
	needed := c.FoodNeededForGrowth() - c.FoodStore
	return (needed + netFood - 1) / netFood
}

// TurnsUntilComplete returns estimated turns until current production completes
func (c *City) TurnsUntilComplete(tiles []*Tile) int {
	if c.CurrentBuild == nil {
		return -1
	}
	shields := c.CalculateProductionPerTurn(tiles)
	if shields <= 0 {
		return -1
	}
	needed := c.CurrentBuild.Cost() - c.Production
	return (needed + shields - 1) / shields
}

// Size returns a size category for rendering
func (c *City) Size() string {
	if c.Population < 4 {
		return "small"
	} else if c.Population < 8 {
		return "medium"
	}
	return "large"
}
