package game

// TerrainType represents different terrain types on the map
type TerrainType int

const (
	TerrainOcean TerrainType = iota
	TerrainGrassland
	TerrainPlains
	TerrainDesert
	TerrainHills
	TerrainMountains
	TerrainForest
)

// String returns the string representation of a terrain type
func (t TerrainType) String() string {
	switch t {
	case TerrainOcean:
		return "Ocean"
	case TerrainGrassland:
		return "Grassland"
	case TerrainPlains:
		return "Plains"
	case TerrainDesert:
		return "Desert"
	case TerrainHills:
		return "Hills"
	case TerrainMountains:
		return "Mountains"
	case TerrainForest:
		return "Forest"
	default:
		return "Unknown"
	}
}

// Tile represents a single map tile
type Tile struct {
	X             int          `json:"x"`
	Y             int          `json:"y"`
	Terrain       TerrainType  `json:"terrain"`
	Resource      ResourceType `json:"resource"`
	HasRoad       bool         `json:"has_road"`
	HasMine       bool         `json:"has_mine"`
	HasIrrigation bool         `json:"has_irrigation"`
	HasRiver      bool         `json:"has_river"` // Tile is adjacent to a river
}

// RiverPoint represents a point along a river path
type RiverPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// River represents a complete river as a path of points
type River struct {
	Points []RiverPoint   `json:"points"`
	Delta  [][]RiverPoint `json:"delta,omitempty"` // Delta branches near the mouth
}

// MovementCost returns the movement cost to enter this tile
func (t *Tile) MovementCost() int {
	cost := TerrainMovementCost[t.Terrain]
	if t.HasRoad {
		return 1 // Roads reduce movement to 1
	}
	return cost
}

// FoodYield returns the food production of this tile
func (t *Tile) FoodYield() int {
	yield := TerrainFoodYield[t.Terrain]
	if t.HasIrrigation {
		yield++
	}
	// River bonus (+1 food)
	if t.HasRiver {
		yield++
	}
	// Add resource bonus
	if bonus, ok := ResourceBonuses[t.Resource]; ok {
		yield += bonus.Food
	}
	return yield
}

// ProductionYield returns the production (shields) of this tile
func (t *Tile) ProductionYield() int {
	yield := TerrainProductionYield[t.Terrain]
	if t.HasMine {
		yield++
	}
	// Add resource bonus
	if bonus, ok := ResourceBonuses[t.Resource]; ok {
		yield += bonus.Production
	}
	return yield
}

// TradeYield returns the trade (gold) of this tile
func (t *Tile) TradeYield() int {
	yield := 0
	if t.HasRoad {
		yield++
	}
	// Add resource bonus
	if bonus, ok := ResourceBonuses[t.Resource]; ok {
		yield += bonus.Trade
	}
	return yield
}

// DefenseBonus returns the defense multiplier for this tile
func (t *Tile) DefenseBonus() float64 {
	return TerrainDefenseBonus[t.Terrain]
}

// IsPassable returns whether land units can enter this tile
func (t *Tile) IsPassable() bool {
	return t.Terrain != TerrainOcean
}

// IsWater returns whether this tile is water
func (t *Tile) IsWater() bool {
	return t.Terrain == TerrainOcean
}


// GameMap represents the game world map
type GameMap struct {
	Width  int      `json:"width"`
	Height int      `json:"height"`
	Tiles  [][]Tile `json:"tiles"`
	Rivers []River  `json:"rivers"`
}

// NewGameMap creates a new empty game map
func NewGameMap(width, height int) *GameMap {
	gm := &GameMap{
		Width:  width,
		Height: height,
		Tiles:  make([][]Tile, height),
	}

	for y := 0; y < height; y++ {
		gm.Tiles[y] = make([]Tile, width)
		for x := 0; x < width; x++ {
			gm.Tiles[y][x] = Tile{
				X:       x,
				Y:       y,
				Terrain: TerrainGrassland, // Default terrain
			}
		}
	}

	return gm
}

// GetTile returns the tile at the given coordinates
func (gm *GameMap) GetTile(x, y int) *Tile {
	if x < 0 || x >= gm.Width || y < 0 || y >= gm.Height {
		return nil
	}
	return &gm.Tiles[y][x]
}

// SetTerrain sets the terrain type at the given coordinates
func (gm *GameMap) SetTerrain(x, y int, terrain TerrainType) {
	if x >= 0 && x < gm.Width && y >= 0 && y < gm.Height {
		gm.Tiles[y][x].Terrain = terrain
	}
}

// IsValidCoord checks if coordinates are within map bounds
func (gm *GameMap) IsValidCoord(x, y int) bool {
	return x >= 0 && x < gm.Width && y >= 0 && y < gm.Height
}

// GetNeighbors returns all adjacent tiles (8-directional)
func (gm *GameMap) GetNeighbors(x, y int) []*Tile {
	neighbors := make([]*Tile, 0, 8)
	directions := [][2]int{
		{-1, -1}, {0, -1}, {1, -1},
		{-1, 0}, {1, 0},
		{-1, 1}, {0, 1}, {1, 1},
	}

	for _, d := range directions {
		nx, ny := x+d[0], y+d[1]
		if tile := gm.GetTile(nx, ny); tile != nil {
			neighbors = append(neighbors, tile)
		}
	}

	return neighbors
}

// GetCardinalNeighbors returns adjacent tiles (4-directional: N, S, E, W)
func (gm *GameMap) GetCardinalNeighbors(x, y int) []*Tile {
	neighbors := make([]*Tile, 0, 4)
	directions := [][2]int{
		{0, -1}, // North
		{0, 1},  // South
		{1, 0},  // East
		{-1, 0}, // West
	}

	for _, d := range directions {
		nx, ny := x+d[0], y+d[1]
		if tile := gm.GetTile(nx, ny); tile != nil {
			neighbors = append(neighbors, tile)
		}
	}

	return neighbors
}

// GetTilesInRadius returns all tiles within a given radius (Manhattan distance)
func (gm *GameMap) GetTilesInRadius(x, y, radius int) []*Tile {
	tiles := make([]*Tile, 0)
	for dy := -radius; dy <= radius; dy++ {
		for dx := -radius; dx <= radius; dx++ {
			if dx == 0 && dy == 0 {
				continue
			}
			if tile := gm.GetTile(x+dx, y+dy); tile != nil {
				tiles = append(tiles, tile)
			}
		}
	}
	return tiles
}

// GetCityRadius returns tiles that a city at (x,y) would work (radius 2)
func (gm *GameMap) GetCityRadius(x, y int) []*Tile {
	return gm.GetTilesInRadius(x, y, 2)
}
