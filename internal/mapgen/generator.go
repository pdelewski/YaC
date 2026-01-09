package mapgen

import (
	"civilization/internal/game"
	"log"
	"math"
	"math/rand"
	"time"
)

// GeneratorConfig holds configuration for map generation
type GeneratorConfig struct {
	Width       int
	Height      int
	Seed        int64
	WaterLevel  float64 // 0.0 to 1.0, higher = more water
	MountainLevel float64 // 0.0 to 1.0, higher = more mountains
}

// DefaultConfig returns a default generator configuration
func DefaultConfig(width, height int) GeneratorConfig {
	return GeneratorConfig{
		Width:       width,
		Height:      height,
		Seed:        time.Now().UnixNano(),
		WaterLevel:  0.35,
		MountainLevel: 0.75,
	}
}

// Generator handles procedural map generation
type Generator struct {
	config        GeneratorConfig
	elevationNoise *PerlinNoise
	moistureNoise  *PerlinNoise
	forestNoise    *PerlinNoise
	rng           *rand.Rand
}

// NewGenerator creates a new map generator
func NewGenerator(config GeneratorConfig) *Generator {
	if config.Seed == 0 {
		config.Seed = time.Now().UnixNano()
	}

	return &Generator{
		config:        config,
		elevationNoise: NewPerlinNoise(config.Seed),
		moistureNoise:  NewPerlinNoise(config.Seed + 1000),
		forestNoise:    NewPerlinNoise(config.Seed + 2000),
		rng:           rand.New(rand.NewSource(config.Seed)),
	}
}

// Generate creates a new game map
func (g *Generator) Generate() *game.GameMap {
	gm := game.NewGameMap(g.config.Width, g.config.Height)

	// Generate terrain
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			terrain := g.generateTerrain(x, y)
			gm.SetTerrain(x, y, terrain)
		}
	}

	// Post-processing
	g.smoothCoastlines(gm)
	g.addForests(gm) // Add forests only on grassland surrounded by grassland
	g.ensurePlayability(gm)

	return gm
}

// generateTerrain determines the terrain type for a tile
func (g *Generator) generateTerrain(x, y int) game.TerrainType {
	elevation := g.getElevation(x, y)
	moisture := g.getMoisture(x, y)

	// Ocean
	if elevation < g.config.WaterLevel {
		return game.TerrainOcean
	}

	// Mountains
	if elevation > g.config.MountainLevel+0.1 {
		return game.TerrainMountains
	}

	// Hills
	if elevation > g.config.MountainLevel {
		return game.TerrainHills
	}

	// Land biomes based on moisture
	if moisture < 0.25 {
		return game.TerrainDesert
	}
	if moisture < 0.5 {
		return game.TerrainPlains
	}
	return game.TerrainGrassland
}

// getElevation returns the elevation at a point (0 to 1)
func (g *Generator) getElevation(x, y int) float64 {
	// Base frequency for the noise
	baseFreq := 1.0 / 32.0

	// Use FBM for more natural-looking terrain
	nx := float64(x) * baseFreq
	ny := float64(y) * baseFreq

	elevation := g.elevationNoise.FBM(nx, ny, 4, 0.5, 2.0)
	elevation = Normalize(elevation)

	// Apply island gradient to create continent shapes
	elevation = g.applyIslandGradient(x, y, elevation)

	return Clamp(elevation, 0, 1)
}

// getMoisture returns the moisture level at a point (0 to 1)
func (g *Generator) getMoisture(x, y int) float64 {
	baseFreq := 1.0 / 24.0

	nx := float64(x) * baseFreq
	ny := float64(y) * baseFreq

	moisture := g.moistureNoise.FBM(nx, ny, 3, 0.5, 2.0)
	return Normalize(moisture)
}

// applyIslandGradient reduces elevation at map edges
func (g *Generator) applyIslandGradient(x, y int, elevation float64) float64 {
	cx := float64(g.config.Width) / 2
	cy := float64(g.config.Height) / 2

	// Normalized distance from center (0 at center, 1 at corners)
	dx := (float64(x) - cx) / cx
	dy := (float64(y) - cy) / cy
	distance := math.Sqrt(dx*dx + dy*dy)

	// More aggressive falloff at edges
	falloff := 1.0 - math.Pow(distance, 2)*0.5

	return elevation * Clamp(falloff, 0, 1)
}

// addForests adds forest terrain to suitable tiles
// Forests can only border grassland or other forests
func (g *Generator) addForests(gm *game.GameMap) {
	// First pass: mark candidate tiles for forest
	candidates := make(map[[2]int]bool)

	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil || tile.Terrain != game.TerrainGrassland {
				continue
			}

			// Check if all neighbors are grassland (forests can expand later)
			neighbors := gm.GetNeighbors(x, y)
			allGrassland := true
			for _, n := range neighbors {
				if n.Terrain != game.TerrainGrassland {
					allGrassland = false
					break
				}
			}
			if !allGrassland {
				continue
			}

			// Check forest noise
			nx := float64(x) / 8.0
			ny := float64(y) / 8.0
			forestValue := g.forestNoise.Noise2D(nx, ny)

			if forestValue > 0.2 {
				candidates[[2]int{x, y}] = true
			}
		}
	}

	// Second pass: place forests where they only touch grassland or other forest candidates
	for coord := range candidates {
		x, y := coord[0], coord[1]
		neighbors := gm.GetNeighbors(x, y)
		valid := true
		for _, n := range neighbors {
			// Allow grassland or tiles that will become forest
			isCandidate := candidates[[2]int{n.X, n.Y}]
			if n.Terrain != game.TerrainGrassland && !isCandidate {
				valid = false
				break
			}
		}
		if valid {
			gm.SetTerrain(x, y, game.TerrainForest)
		}
	}
}

// removeCoastalForests converts forests adjacent to ocean back to grassland
func (g *Generator) removeCoastalForests(gm *game.GameMap) {
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil || tile.Terrain != game.TerrainForest {
				continue
			}

			// Check if any neighbor is ocean
			neighbors := gm.GetNeighbors(x, y)
			for _, n := range neighbors {
				if n.Terrain == game.TerrainOcean {
					// Convert forest back to grassland
					tile.Terrain = game.TerrainGrassland
					break
				}
			}
		}
	}
}

// smoothCoastlines removes single-tile ocean/land anomalies
func (g *Generator) smoothCoastlines(gm *game.GameMap) {
	changes := make(map[[2]int]game.TerrainType)

	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil {
				continue
			}

			neighbors := gm.GetCardinalNeighbors(x, y)
			if len(neighbors) < 4 {
				continue // Edge tile
			}

			waterCount := 0
			for _, n := range neighbors {
				if n.IsWater() {
					waterCount++
				}
			}

			// Single water tile surrounded by land
			if tile.IsWater() && waterCount == 0 {
				changes[[2]int{x, y}] = game.TerrainGrassland
			}

			// Single land tile surrounded by water
			if !tile.IsWater() && waterCount == 4 {
				changes[[2]int{x, y}] = game.TerrainOcean
			}
		}
	}

	// Apply changes
	for coord, terrain := range changes {
		gm.SetTerrain(coord[0], coord[1], terrain)
	}
}

// ensurePlayability makes sure the map is playable
func (g *Generator) ensurePlayability(gm *game.GameMap) {
	// Count land tiles
	landCount := 0
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile != nil && !tile.IsWater() && tile.Terrain != game.TerrainMountains {
				landCount++
			}
		}
	}

	// If too little land, reduce water level and regenerate
	minLand := g.config.Width * g.config.Height / 4
	if landCount < minLand {
		// Convert some water to land
		for y := 0; y < g.config.Height; y++ {
			for x := 0; x < g.config.Width; x++ {
				tile := gm.GetTile(x, y)
				if tile != nil && tile.IsWater() {
					// Check if near land
					neighbors := gm.GetNeighbors(x, y)
					hasLand := false
					for _, n := range neighbors {
						if !n.IsWater() {
							hasLand = true
							break
						}
					}
					if hasLand && g.rng.Float64() < 0.3 {
						tile.Terrain = game.TerrainGrassland
						landCount++
						if landCount >= minLand {
							return
						}
					}
				}
			}
		}
	}
}

// FindStartingPositions finds suitable starting locations for players
func (g *Generator) FindStartingPositions(gm *game.GameMap, count int) [][2]int {
	positions := make([][2]int, 0, count)

	// Find all candidate positions (good land tiles)
	candidates := make([][2]int, 0)
	for y := 2; y < g.config.Height-2; y++ {
		for x := 2; x < g.config.Width-2; x++ {
			if g.isGoodStartPosition(gm, x, y) {
				candidates = append(candidates, [2]int{x, y})
			}
		}
	}

	// Fallback: use any land tile if no good positions found
	if len(candidates) == 0 {
		for y := 0; y < g.config.Height; y++ {
			for x := 0; x < g.config.Width; x++ {
				tile := gm.GetTile(x, y)
				if tile != nil && !tile.IsWater() && tile.Terrain != game.TerrainMountains {
					candidates = append(candidates, [2]int{x, y})
				}
			}
		}
	}

	// Keep a copy of all candidates for fallback
	allCandidates := make([][2]int, len(candidates))
	copy(allCandidates, candidates)

	// Select positions that are spread apart
	minDistance := math.Max(float64(g.config.Width+g.config.Height)/(float64(count)*2), 10)

	for len(positions) < count && len(candidates) > 0 {
		// Pick a random candidate
		idx := g.rng.Intn(len(candidates))
		candidate := candidates[idx]

		// Check distance from existing positions
		valid := true
		for _, pos := range positions {
			dist := math.Sqrt(float64((candidate[0]-pos[0])*(candidate[0]-pos[0]) +
				(candidate[1]-pos[1])*(candidate[1]-pos[1])))
			if dist < minDistance {
				valid = false
				break
			}
		}

		if valid {
			positions = append(positions, candidate)
		}

		// Remove from candidates
		candidates = append(candidates[:idx], candidates[idx+1:]...)
	}

	// If we couldn't find enough positions, use any remaining candidates
	if len(positions) < count {
		// Shuffle allCandidates
		g.rng.Shuffle(len(allCandidates), func(i, j int) {
			allCandidates[i], allCandidates[j] = allCandidates[j], allCandidates[i]
		})

		for _, candidate := range allCandidates {
			if len(positions) >= count {
				break
			}
			// Check if this position is already used
			alreadyUsed := false
			for _, pos := range positions {
				if pos[0] == candidate[0] && pos[1] == candidate[1] {
					alreadyUsed = true
					break
				}
			}
			if !alreadyUsed {
				positions = append(positions, candidate)
			}
		}
	}

	return positions
}

// isGoodStartPosition checks if a position is good for starting
func (g *Generator) isGoodStartPosition(gm *game.GameMap, x, y int) bool {
	tile := gm.GetTile(x, y)
	if tile == nil {
		return false
	}

	// Must be land (not water, mountains, or desert)
	if tile.IsWater() || tile.Terrain == game.TerrainMountains || tile.Terrain == game.TerrainDesert {
		return false
	}

	// Accept grassland, plains, forest, or hills
	validTerrain := tile.Terrain == game.TerrainGrassland ||
		tile.Terrain == game.TerrainPlains ||
		tile.Terrain == game.TerrainForest ||
		tile.Terrain == game.TerrainHills

	if !validTerrain {
		return false
	}

	// Check surrounding tiles for resources
	neighbors := gm.GetTilesInRadius(x, y, 2)
	goodCount := 0
	waterCount := 0

	for _, n := range neighbors {
		if n.Terrain == game.TerrainGrassland || n.Terrain == game.TerrainForest ||
			n.Terrain == game.TerrainPlains || n.Terrain == game.TerrainHills {
			goodCount++
		}
		if n.IsWater() {
			waterCount++
		}
	}

	// Need some good tiles nearby and not too much water
	return goodCount >= 2 && waterCount < len(neighbors)*2/3
}

// GenerateWithPlayers generates a map and places starting units for players
func GenerateWithPlayers(config GeneratorConfig, players []*game.Player) *game.GameMap {
	gen := NewGenerator(config)
	gm := gen.Generate()

	// Find starting positions
	startPositions := gen.FindStartingPositions(gm, len(players))
	log.Printf("Found %d starting positions for %d players", len(startPositions), len(players))

	// Place starting units for each player
	for i, player := range players {
		if i >= len(startPositions) {
			log.Printf("Not enough starting positions for player %d (%s)", i, player.Name)
			break
		}

		pos := startPositions[i]
		log.Printf("Placing units for player %s at (%d, %d)", player.Name, pos[0], pos[1])

		// Create starting settler
		settler := game.NewUnit(game.UnitSettler, player.ID, pos[0], pos[1])
		player.AddUnit(settler)
		log.Printf("Created settler %s for player %s", settler.ID, player.Name)

		// Create starting warrior (offset by 1 tile)
		warriorX := pos[0]
		warriorY := pos[1]
		if gm.IsValidCoord(pos[0]+1, pos[1]) {
			tile := gm.GetTile(pos[0]+1, pos[1])
			if tile != nil && !tile.IsWater() && tile.Terrain != game.TerrainMountains {
				warriorX = pos[0] + 1
			}
		}

		warrior := game.NewUnit(game.UnitWarrior, player.ID, warriorX, warriorY)
		player.AddUnit(warrior)
		log.Printf("Created warrior %s for player %s at (%d, %d)", warrior.ID, player.Name, warriorX, warriorY)
		log.Printf("Player %s now has %d units", player.Name, len(player.Units))
	}

	return gm
}
