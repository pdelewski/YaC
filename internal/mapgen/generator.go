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
	Width         int
	Height        int
	Seed          int64
	WaterLevel    float64 // 0.0 to 1.0, higher = more water
	MountainLevel float64 // 0.0 to 1.0, higher = more mountains
	MapType       string  // "random" or "earth"
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

	if g.config.MapType == "earth" {
		g.generateEarthLike(gm)
	} else {
		// Generate random terrain
		for y := 0; y < g.config.Height; y++ {
			for x := 0; x < g.config.Width; x++ {
				terrain := g.generateTerrain(x, y)
				gm.SetTerrain(x, y, terrain)
			}
		}
	}

	// Post-processing
	g.smoothCoastlines(gm)
	g.generateRivers(gm)          // Add rivers flowing from highlands to ocean (before removing coastal elevations)
	g.removeCoastalElevations(gm) // Hills/mountains cannot border ocean
	g.addForests(gm)              // Add forests only on grassland surrounded by grassland
	g.ensurePlayability(gm)
	g.placeResources(gm) // Add resources to tiles

	return gm
}

// generateEarthLike creates an Earth-like map with recognizable continents
func (g *Generator) generateEarthLike(gm *game.GameMap) {
	w := float64(g.config.Width)
	h := float64(g.config.Height)

	// Fill with ocean first
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			gm.SetTerrain(x, y, game.TerrainOcean)
		}
	}

	// Draw continents using polygon shapes (coordinates are 0-1 normalized)
	// North America - more detailed shape
	northAmerica := [][]float64{
		{0.05, 0.12}, {0.12, 0.08}, {0.18, 0.10}, {0.22, 0.15},
		{0.20, 0.22}, {0.22, 0.28}, {0.18, 0.35}, {0.20, 0.42},
		{0.15, 0.45}, {0.10, 0.40}, {0.08, 0.32}, {0.05, 0.28},
		{0.03, 0.20}, {0.05, 0.12},
	}
	g.drawPolygonContinent(gm, northAmerica)

	// Central America
	centralAmerica := [][]float64{
		{0.15, 0.45}, {0.18, 0.48}, {0.16, 0.52}, {0.17, 0.56},
		{0.15, 0.55}, {0.13, 0.50}, {0.15, 0.45},
	}
	g.drawPolygonContinent(gm, centralAmerica)

	// South America
	southAmerica := [][]float64{
		{0.17, 0.56}, {0.22, 0.55}, {0.26, 0.60}, {0.28, 0.68},
		{0.26, 0.78}, {0.22, 0.88}, {0.20, 0.92}, {0.18, 0.88},
		{0.16, 0.78}, {0.15, 0.68}, {0.16, 0.60}, {0.17, 0.56},
	}
	g.drawPolygonContinent(gm, southAmerica)

	// Europe
	europe := [][]float64{
		{0.42, 0.12}, {0.48, 0.10}, {0.52, 0.12}, {0.55, 0.15},
		{0.52, 0.20}, {0.50, 0.25}, {0.48, 0.28}, {0.45, 0.32},
		{0.42, 0.30}, {0.40, 0.25}, {0.38, 0.20}, {0.40, 0.15},
		{0.42, 0.12},
	}
	g.drawPolygonContinent(gm, europe)

	// Africa
	africa := [][]float64{
		{0.42, 0.32}, {0.48, 0.30}, {0.55, 0.35}, {0.58, 0.42},
		{0.56, 0.52}, {0.54, 0.62}, {0.50, 0.72}, {0.46, 0.75},
		{0.42, 0.70}, {0.40, 0.60}, {0.38, 0.50}, {0.40, 0.40},
		{0.42, 0.32},
	}
	g.drawPolygonContinent(gm, africa)

	// Asia - large landmass
	asia := [][]float64{
		{0.55, 0.15}, {0.62, 0.10}, {0.72, 0.08}, {0.82, 0.12},
		{0.88, 0.18}, {0.92, 0.25}, {0.90, 0.32}, {0.85, 0.38},
		{0.78, 0.42}, {0.72, 0.45}, {0.65, 0.42}, {0.60, 0.38},
		{0.58, 0.32}, {0.55, 0.25}, {0.55, 0.15},
	}
	g.drawPolygonContinent(gm, asia)

	// India
	india := [][]float64{
		{0.65, 0.42}, {0.70, 0.45}, {0.72, 0.52}, {0.68, 0.58},
		{0.64, 0.55}, {0.62, 0.48}, {0.65, 0.42},
	}
	g.drawPolygonContinent(gm, india)

	// Southeast Asia
	seAsia := [][]float64{
		{0.78, 0.42}, {0.82, 0.45}, {0.80, 0.55}, {0.76, 0.52},
		{0.78, 0.42},
	}
	g.drawPolygonContinent(gm, seAsia)

	// Australia
	australia := [][]float64{
		{0.82, 0.62}, {0.90, 0.60}, {0.95, 0.65}, {0.94, 0.72},
		{0.88, 0.78}, {0.82, 0.75}, {0.80, 0.68}, {0.82, 0.62},
	}
	g.drawPolygonContinent(gm, australia)

	// Greenland
	greenland := [][]float64{
		{0.32, 0.05}, {0.38, 0.04}, {0.40, 0.08}, {0.38, 0.15},
		{0.34, 0.14}, {0.32, 0.10}, {0.32, 0.05},
	}
	g.drawPolygonContinent(gm, greenland)

	// British Isles
	britain := [][]float64{
		{0.38, 0.18}, {0.40, 0.16}, {0.41, 0.20}, {0.39, 0.22},
		{0.38, 0.18},
	}
	g.drawPolygonContinent(gm, britain)

	// Japan
	japan := [][]float64{
		{0.88, 0.28}, {0.90, 0.25}, {0.92, 0.28}, {0.91, 0.35},
		{0.89, 0.32}, {0.88, 0.28},
	}
	g.drawPolygonContinent(gm, japan)

	// Add terrain variety based on climate
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil || tile.Terrain == game.TerrainOcean {
				continue
			}

			nx := float64(x) / w * 6
			ny := float64(y) / h * 6
			moisture := g.moistureNoise.Noise2D(nx, ny)
			elevation := g.elevationNoise.Noise2D(nx*2, ny*2)

			// Latitude affects climate (0 at equator, 1 at poles)
			lat := math.Abs(float64(y)/h-0.5) * 2

			// Mountain ranges
			if elevation > 0.55 {
				tile.Terrain = game.TerrainMountains
			} else if elevation > 0.35 {
				tile.Terrain = game.TerrainHills
			} else if lat > 0.15 && lat < 0.40 && moisture < 0.35 {
				// Desert bands (Sahara, Arabian, Australian outback)
				tile.Terrain = game.TerrainDesert
			} else if moisture < 0.3 {
				tile.Terrain = game.TerrainPlains
			}
			// else keep as grassland
		}
	}
}

// drawPolygonContinent draws a continent using polygon vertices
func (g *Generator) drawPolygonContinent(gm *game.GameMap, vertices [][]float64) {
	w := float64(g.config.Width)
	h := float64(g.config.Height)

	// Convert normalized coords to pixel coords
	pixelVerts := make([][]float64, len(vertices))
	for i, v := range vertices {
		pixelVerts[i] = []float64{v[0] * w, v[1] * h}
	}

	// Find bounding box
	minX, minY := pixelVerts[0][0], pixelVerts[0][1]
	maxX, maxY := minX, minY
	for _, v := range pixelVerts {
		if v[0] < minX {
			minX = v[0]
		}
		if v[0] > maxX {
			maxX = v[0]
		}
		if v[1] < minY {
			minY = v[1]
		}
		if v[1] > maxY {
			maxY = v[1]
		}
	}

	// Expand bounds slightly for coastline noise
	margin := 5.0
	minX = math.Max(0, minX-margin)
	minY = math.Max(0, minY-margin)
	maxX = math.Min(w, maxX+margin)
	maxY = math.Min(h, maxY+margin)

	// Fill polygon with coastline noise
	for y := int(minY); y < int(maxY); y++ {
		for x := int(minX); x < int(maxX); x++ {
			if x < 0 || x >= g.config.Width || y < 0 || y >= g.config.Height {
				continue
			}

			// Check if point is inside polygon
			dist := g.pointToPolygonDistance(float64(x), float64(y), pixelVerts)

			// Add noise to coastlines
			nx := float64(x) / w * 12
			ny := float64(y) / h * 12
			noise := g.elevationNoise.Noise2D(nx, ny) * 4

			// Land if inside polygon (with noisy coastline)
			if dist < noise {
				gm.SetTerrain(x, y, game.TerrainGrassland)
			}
		}
	}
}

// pointToPolygonDistance returns negative if inside, positive if outside
func (g *Generator) pointToPolygonDistance(px, py float64, vertices [][]float64) float64 {
	inside := false
	minDist := math.MaxFloat64

	n := len(vertices)
	for i := 0; i < n; i++ {
		j := (i + 1) % n
		xi, yi := vertices[i][0], vertices[i][1]
		xj, yj := vertices[j][0], vertices[j][1]

		// Ray casting for inside/outside
		if ((yi > py) != (yj > py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi) {
			inside = !inside
		}

		// Distance to edge
		dist := g.pointToSegmentDistance(px, py, xi, yi, xj, yj)
		if dist < minDist {
			minDist = dist
		}
	}

	if inside {
		return -minDist
	}
	return minDist
}

// pointToSegmentDistance calculates distance from point to line segment
func (g *Generator) pointToSegmentDistance(px, py, x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	length := dx*dx + dy*dy

	if length == 0 {
		return math.Sqrt((px-x1)*(px-x1) + (py-y1)*(py-y1))
	}

	t := math.Max(0, math.Min(1, ((px-x1)*dx+(py-y1)*dy)/length))
	projX := x1 + t*dx
	projY := y1 + t*dy

	return math.Sqrt((px-projX)*(px-projX) + (py-projY)*(py-projY))
}

// generateTerrain determines the terrain type for a tile
func (g *Generator) generateTerrain(x, y int) game.TerrainType {
	elevation := g.getElevation(x, y)
	moisture := g.getMoisture(x, y)

	// Ocean
	if elevation < g.config.WaterLevel {
		return game.TerrainOcean
	}

	// Mountains (lowered threshold from 0.85 to 0.70)
	if elevation > 0.70 {
		return game.TerrainMountains
	}

	// Hills (lowered threshold from 0.75 to 0.58)
	if elevation > 0.58 {
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

// removeCoastalElevations converts hills and mountains adjacent to ocean into plains/grassland
func (g *Generator) removeCoastalElevations(gm *game.GameMap) {
	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil {
				continue
			}

			// Only process hills and mountains
			if tile.Terrain != game.TerrainHills && tile.Terrain != game.TerrainMountains {
				continue
			}

			// Check if any neighbor is ocean
			neighbors := gm.GetNeighbors(x, y)
			adjacentToOcean := false
			for _, n := range neighbors {
				if n.Terrain == game.TerrainOcean {
					adjacentToOcean = true
					break
				}
			}

			if adjacentToOcean {
				// Convert to plains (more natural coastal terrain)
				tile.Terrain = game.TerrainPlains
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

// generateRivers creates rivers as smooth paths flowing from highlands to ocean
func (g *Generator) generateRivers(gm *game.GameMap) {
	log.Println("=== GENERATING RIVERS ===")

	// Find potential river sources (mountains preferred, then hills)
	mountainSources := make([][2]int, 0)
	hillSources := make([][2]int, 0)

	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil {
				continue
			}
			if tile.Terrain == game.TerrainMountains {
				mountainSources = append(mountainSources, [2]int{x, y})
			} else if tile.Terrain == game.TerrainHills {
				hillSources = append(hillSources, [2]int{x, y})
			}
		}
	}

	// Prefer mountains as sources, fall back to hills
	sources := mountainSources
	if len(sources) < 5 {
		sources = append(sources, hillSources...)
	}

	log.Printf("Found %d potential river sources", len(sources))

	if len(sources) == 0 {
		return
	}

	// Generate fewer but longer rivers (3-8)
	numRivers := 3 + g.rng.Intn(6)
	if numRivers > len(sources) {
		numRivers = len(sources)
	}

	log.Printf("Generating %d rivers", numRivers)

	// Shuffle sources
	g.rng.Shuffle(len(sources), func(i, j int) {
		sources[i], sources[j] = sources[j], sources[i]
	})

	// Generate each river as a path
	gm.Rivers = make([]game.River, 0)
	for i := 0; i < numRivers; i++ {
		river := g.traceRiverPath(gm, sources[i][0], sources[i][1])
		if len(river.Points) > 3 { // Only keep rivers with enough points
			// Add delta branches if river is long enough
			if len(river.Points) > 8 {
				g.addRiverDelta(gm, &river)
			}
			gm.Rivers = append(gm.Rivers, river)
			// Mark tiles near the river
			g.markRiverTiles(gm, river)
		}
	}

	log.Printf("Total rivers created: %d", len(gm.Rivers))
}

// traceRiverPath creates a smooth river path from source towards ocean
func (g *Generator) traceRiverPath(gm *game.GameMap, startX, startY int) game.River {
	river := game.River{Points: make([]game.RiverPoint, 0)}

	// Start point with small random offset within tile
	px := float64(startX) + 0.3 + g.rng.Float64()*0.4
	py := float64(startY) + 0.3 + g.rng.Float64()*0.4
	river.Points = append(river.Points, game.RiverPoint{X: px, Y: py})

	visited := make(map[[2]int]bool)
	x, y := startX, startY
	maxLength := 150

	// Direction accumulator for smooth curves
	dirX, dirY := 0.0, 0.0

	for i := 0; i < maxLength; i++ {
		visited[[2]int{x, y}] = true
		tile := gm.GetTile(x, y)
		if tile == nil {
			break
		}

		// Find best direction to flow
		bestX, bestY := -1, -1
		bestScore := -1000.0

		// Check all 8 directions for smoother paths
		directions := [][2]int{
			{0, -1}, {0, 1}, {1, 0}, {-1, 0},
			{1, -1}, {1, 1}, {-1, -1}, {-1, 1},
		}

		for _, d := range directions {
			nx, ny := x+d[0], y+d[1]
			if visited[[2]int{nx, ny}] {
				continue
			}
			nextTile := gm.GetTile(nx, ny)
			if nextTile == nil {
				continue
			}

			score := 0.0
			if nextTile.Terrain == game.TerrainOcean {
				score = 1000
			} else {
				switch nextTile.Terrain {
				case game.TerrainMountains:
					score = -20
				case game.TerrainHills:
					score = -5
				case game.TerrainForest:
					score = 3
				case game.TerrainGrassland:
					score = 4
				case game.TerrainPlains:
					score = 4
				case game.TerrainDesert:
					score = 2
				}
				// Randomness for meandering
				score += g.rng.Float64() * 3

				// Momentum - prefer continuing roughly same direction
				dot := float64(d[0])*dirX + float64(d[1])*dirY
				score += dot * 2
			}

			if score > bestScore {
				bestScore = score
				bestX, bestY = nx, ny
			}
		}

		if bestX == -1 {
			break
		}

		// Update direction accumulator (smoothed)
		newDirX := float64(bestX - x)
		newDirY := float64(bestY - y)
		dirX = dirX*0.6 + newDirX*0.4
		dirY = dirY*0.6 + newDirY*0.4

		nextTile := gm.GetTile(bestX, bestY)
		if nextTile != nil && nextTile.Terrain == game.TerrainOcean {
			// Get the last point of the river to calculate straight approach
			lastPt := river.Points[len(river.Points)-1]

			// Determine if this is a diagonal move (would end at corner)
			isDiagonal := bestX != x && bestY != y

			if isDiagonal {
				// For diagonal moves (corner), go into the ocean tile center
				// but make the final segment straight (align with dominant direction)
				endX := float64(bestX) + 0.5
				endY := float64(bestY) + 0.5

				// Make approach straight by aligning one coordinate with previous point
				if math.Abs(dirX) > math.Abs(dirY) {
					// Horizontal approach - keep Y aligned with last point
					endY = lastPt.Y
				} else {
					// Vertical approach - keep X aligned with last point
					endX = lastPt.X
				}

				river.Points = append(river.Points, game.RiverPoint{X: endX, Y: endY})
			} else {
				// Cardinal direction - stop at the edge of current land tile
				// Make it a straight line by aligning with the last point
				edgeX := lastPt.X
				edgeY := lastPt.Y

				if bestX > x {
					edgeX = float64(x) + 0.95 // Right edge
				} else if bestX < x {
					edgeX = float64(x) + 0.05 // Left edge
				}
				if bestY > y {
					edgeY = float64(y) + 0.95 // Bottom edge
				} else if bestY < y {
					edgeY = float64(y) + 0.05 // Top edge
				}

				river.Points = append(river.Points, game.RiverPoint{X: edgeX, Y: edgeY})
			}

			log.Printf("River reached ocean, length: %d points", len(river.Points))
			break
		}

		// Add point with meandering offset (only for non-ocean tiles)
		offset := (g.rng.Float64() - 0.5) * 0.5
		perpX := -newDirY * offset
		perpY := newDirX * offset

		newPx := float64(bestX) + 0.5 + perpX
		newPy := float64(bestY) + 0.5 + perpY
		river.Points = append(river.Points, game.RiverPoint{X: newPx, Y: newPy})

		x, y = bestX, bestY
	}

	// If river didn't reach ocean, check if it's adjacent to ocean and extend it
	if len(river.Points) > 0 {
		lastPt := river.Points[len(river.Points)-1]
		lastTileX, lastTileY := int(lastPt.X), int(lastPt.Y)

		// Check cardinal directions for ocean
		cardinalDirs := [][2]int{{0, -1}, {0, 1}, {-1, 0}, {1, 0}}
		for _, d := range cardinalDirs {
			adjTile := gm.GetTile(lastTileX+d[0], lastTileY+d[1])
			if adjTile != nil && adjTile.Terrain == game.TerrainOcean {
				// Extend river to touch ocean edge
				edgeX := lastPt.X
				edgeY := lastPt.Y

				if d[0] > 0 {
					edgeX = float64(lastTileX) + 0.95 // Right edge
				} else if d[0] < 0 {
					edgeX = float64(lastTileX) + 0.05 // Left edge
				}
				if d[1] > 0 {
					edgeY = float64(lastTileY) + 0.95 // Bottom edge
				} else if d[1] < 0 {
					edgeY = float64(lastTileY) + 0.05 // Top edge
				}

				river.Points = append(river.Points, game.RiverPoint{X: edgeX, Y: edgeY})
				log.Printf("Extended river to touch ocean at edge (%.2f, %.2f)", edgeX, edgeY)
				break
			}
		}
	}

	return river
}

// markRiverTiles marks tiles that are adjacent to a river
func (g *Generator) markRiverTiles(gm *game.GameMap, river game.River) {
	for _, pt := range river.Points {
		// Mark the tile containing this point and adjacent tiles
		tx, ty := int(pt.X), int(pt.Y)
		for dy := -1; dy <= 1; dy++ {
			for dx := -1; dx <= 1; dx++ {
				tile := gm.GetTile(tx+dx, ty+dy)
				if tile != nil && tile.Terrain != game.TerrainOcean {
					tile.HasRiver = true
				}
			}
		}
	}
	// Also mark tiles near delta branches
	for _, branch := range river.Delta {
		for _, pt := range branch {
			tx, ty := int(pt.X), int(pt.Y)
			for dy := -1; dy <= 1; dy++ {
				for dx := -1; dx <= 1; dx++ {
					tile := gm.GetTile(tx+dx, ty+dy)
					if tile != nil && tile.Terrain != game.TerrainOcean {
						tile.HasRiver = true
					}
				}
			}
		}
	}
}

// addRiverDelta creates delta branches at the river mouth
func (g *Generator) addRiverDelta(gm *game.GameMap, river *game.River) {
	if len(river.Points) < 5 {
		return
	}

	// Find the point where river meets ocean (last few points)
	lastIdx := len(river.Points) - 1
	lastPoint := river.Points[lastIdx]

	// Check if the last point is near ocean
	lastTileX, lastTileY := int(lastPoint.X), int(lastPoint.Y)
	lastTile := gm.GetTile(lastTileX, lastTileY)
	if lastTile == nil || lastTile.Terrain != game.TerrainOcean {
		return // River didn't reach ocean
	}

	// Start delta from a point before the mouth (about 70% along the river)
	deltaStartIdx := int(float64(len(river.Points)) * 0.7)
	if deltaStartIdx < 3 {
		deltaStartIdx = 3
	}
	deltaStart := river.Points[deltaStartIdx]

	// Create 2-3 delta branches
	numBranches := 2 + g.rng.Intn(2)
	river.Delta = make([][]game.RiverPoint, 0)

	for b := 0; b < numBranches; b++ {
		branch := make([]game.RiverPoint, 0)

		// Start slightly offset from main river
		angleOffset := (float64(b) - float64(numBranches-1)/2) * 0.8
		bx := deltaStart.X
		by := deltaStart.Y

		// Direction towards ocean (approximate from last points of main river)
		mainDirX := lastPoint.X - deltaStart.X
		mainDirY := lastPoint.Y - deltaStart.Y
		length := math.Sqrt(mainDirX*mainDirX + mainDirY*mainDirY)
		if length > 0 {
			mainDirX /= length
			mainDirY /= length
		}

		// Rotate direction for this branch
		cos := math.Cos(angleOffset)
		sin := math.Sin(angleOffset)
		branchDirX := mainDirX*cos - mainDirY*sin
		branchDirY := mainDirX*sin + mainDirY*cos

		// Trace branch towards ocean
		prevTileX, prevTileY := int(bx), int(by)
		for i := 0; i < 8; i++ {
			// Add meander
			meander := (g.rng.Float64() - 0.5) * 0.3
			perpX := -branchDirY * meander
			perpY := branchDirX * meander

			nextBx := bx + branchDirX*0.8 + perpX
			nextBy := by + branchDirY*0.8 + perpY

			// Check if next point would be in ocean
			tileX, tileY := int(nextBx), int(nextBy)
			tile := gm.GetTile(tileX, tileY)
			if tile != nil && tile.Terrain == game.TerrainOcean {
				// Determine if this is a diagonal move (would end at corner)
				isDiagonal := tileX != prevTileX && tileY != prevTileY

				if isDiagonal {
					// For diagonal moves (corner), go into the ocean tile
					// Make the final segment straight
					endX := float64(tileX) + 0.5
					endY := float64(tileY) + 0.5

					if math.Abs(branchDirX) > math.Abs(branchDirY) {
						// Horizontal approach - keep Y aligned
						endY = by
					} else {
						// Vertical approach - keep X aligned
						endX = bx
					}

					branch = append(branch, game.RiverPoint{X: endX, Y: endY})
				} else {
					// Cardinal direction - stop at the edge, straight line
					edgeX := bx
					edgeY := by

					if tileX > prevTileX {
						edgeX = float64(prevTileX) + 0.95
					} else if tileX < prevTileX {
						edgeX = float64(prevTileX) + 0.05
					}
					if tileY > prevTileY {
						edgeY = float64(prevTileY) + 0.95
					} else if tileY < prevTileY {
						edgeY = float64(prevTileY) + 0.05
					}

					branch = append(branch, game.RiverPoint{X: edgeX, Y: edgeY})
				}
				break
			}

			bx = nextBx
			by = nextBy
			branch = append(branch, game.RiverPoint{X: bx, Y: by})
			prevTileX, prevTileY = tileX, tileY
		}

		if len(branch) > 1 {
			river.Delta = append(river.Delta, branch)
		}
	}

	log.Printf("Added %d delta branches to river", len(river.Delta))
}

// placeResources scatters resources across the map on valid terrain
func (g *Generator) placeResources(gm *game.GameMap) {
	// Resource placement frequency (lower = more rare)
	resourceChance := 0.03 // 3% chance per valid tile

	// List of all resource types
	resourceTypes := []game.ResourceType{
		game.ResourceOil,
		game.ResourceCoal,
		game.ResourceGold,
		game.ResourceIron,
		game.ResourceGems,
		game.ResourceUranium,
		game.ResourceWheat,
		game.ResourceHorses,
		game.ResourceFish,
		game.ResourceSilk,
		game.ResourceSpices,
		game.ResourceFurs,
	}

	for y := 0; y < g.config.Height; y++ {
		for x := 0; x < g.config.Width; x++ {
			tile := gm.GetTile(x, y)
			if tile == nil {
				continue
			}

			// Skip if random chance not met
			if g.rng.Float64() > resourceChance {
				continue
			}

			// Find valid resources for this terrain
			validResources := make([]game.ResourceType, 0)
			for _, resType := range resourceTypes {
				validTerrains := game.ValidTerrainForResource[resType]
				for _, terrain := range validTerrains {
					if terrain == tile.Terrain {
						validResources = append(validResources, resType)
						break
					}
				}
			}

			// Place a random valid resource
			if len(validResources) > 0 {
				tile.Resource = validResources[g.rng.Intn(len(validResources))]
			}
		}
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
