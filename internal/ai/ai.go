package ai

import (
	"civilization/internal/game"
)

// Strategy represents the AI's current strategic focus
type Strategy int

const (
	StrategyExpansion  Strategy = iota // Early game: settle cities
	StrategyBuildup                     // Mid game: build military
	StrategyAggression                  // Late game: conquer enemies
)

// String returns the string representation of a strategy
func (s Strategy) String() string {
	switch s {
	case StrategyExpansion:
		return "Expansion"
	case StrategyBuildup:
		return "Buildup"
	case StrategyAggression:
		return "Aggression"
	default:
		return "Unknown"
	}
}

// Controller manages AI decision-making for a player
type Controller struct {
	Game     *game.GameState
	PlayerID string
	Strategy Strategy
}

// NewController creates a new AI controller
func NewController(g *game.GameState, playerID string) *Controller {
	return &Controller{
		Game:     g,
		PlayerID: playerID,
		Strategy: StrategyExpansion,
	}
}

// GetPlayer returns the player this AI controls
func (c *Controller) GetPlayer() *game.Player {
	return c.Game.GetPlayer(c.PlayerID)
}

// TakeTurn executes a complete AI turn
func (c *Controller) TakeTurn() []game.Action {
	player := c.GetPlayer()
	if player == nil || !player.IsAlive {
		return []game.Action{&game.EndTurnAction{}}
	}

	// Update strategy based on game state
	c.updateStrategy()

	actions := make([]game.Action, 0)

	// Process cities first (set production)
	actions = append(actions, c.processCities()...)

	// Process units
	actions = append(actions, c.processUnits()...)

	// End turn
	actions = append(actions, &game.EndTurnAction{})

	return actions
}

// updateStrategy adjusts the AI strategy based on current game state
func (c *Controller) updateStrategy() {
	player := c.GetPlayer()
	if player == nil {
		return
	}

	cityCount := len(player.Cities)
	militaryCount := c.countMilitaryUnits(player)

	// Decide strategy based on game state
	if cityCount < 3 {
		// Need more cities
		c.Strategy = StrategyExpansion
	} else if militaryCount < cityCount*2 {
		// Need more military
		c.Strategy = StrategyBuildup
	} else {
		// Ready to attack
		c.Strategy = StrategyAggression
	}
}

// countMilitaryUnits counts non-settler units
func (c *Controller) countMilitaryUnits(player *game.Player) int {
	count := 0
	for _, unit := range player.Units {
		if !unit.CanFoundCity() {
			count++
		}
	}
	return count
}

// processCities handles city production decisions
func (c *Controller) processCities() []game.Action {
	actions := make([]game.Action, 0)
	player := c.GetPlayer()
	if player == nil {
		return actions
	}

	for _, city := range player.Cities {
		if city.CurrentBuild == nil {
			buildItem := c.decideCityProduction(city)
			action := &game.SetProductionAction{
				CityID:    city.ID,
				BuildItem: buildItem,
			}
			if err := action.Validate(c.Game, c.PlayerID); err == nil {
				actions = append(actions, action)
			}
		}
	}

	return actions
}

// decideCityProduction determines what a city should build
func (c *Controller) decideCityProduction(city *game.City) game.BuildItem {
	player := c.GetPlayer()

	switch c.Strategy {
	case StrategyExpansion:
		// Build settlers if we have capacity
		if len(player.Cities) < 5 && city.Population >= 2 {
			return game.BuildItem{IsUnit: true, UnitType: game.UnitSettler}
		}
		// Build warriors for protection
		return game.BuildItem{IsUnit: true, UnitType: game.UnitWarrior}

	case StrategyBuildup:
		// Build barracks first for veteran units
		if !city.HasBarracks() {
			return game.BuildItem{IsUnit: false, Building: game.BuildingBarracks}
		}
		// Build walls for defense
		if !city.HasWalls() && city.Population >= 3 {
			return game.BuildItem{IsUnit: false, Building: game.BuildingWalls}
		}
		// Build defensive units
		return game.BuildItem{IsUnit: true, UnitType: game.UnitPhalanx}

	case StrategyAggression:
		// Build offensive units
		if city.Population >= 4 {
			return game.BuildItem{IsUnit: true, UnitType: game.UnitHorseman}
		}
		return game.BuildItem{IsUnit: true, UnitType: game.UnitArcher}
	}

	// Default
	return game.BuildItem{IsUnit: true, UnitType: game.UnitWarrior}
}

// processUnits handles unit movement and actions
func (c *Controller) processUnits() []game.Action {
	actions := make([]game.Action, 0)
	player := c.GetPlayer()
	if player == nil {
		return actions
	}

	for _, unit := range player.Units {
		if !unit.CanMove() {
			continue
		}

		var unitActions []game.Action

		if unit.CanFoundCity() {
			unitActions = c.handleSettler(unit)
		} else {
			unitActions = c.handleMilitaryUnit(unit)
		}

		actions = append(actions, unitActions...)
	}

	return actions
}

// handleSettler controls settler behavior
func (c *Controller) handleSettler(unit *game.Unit) []game.Action {
	actions := make([]game.Action, 0)

	// Check if current location is good for a city
	if c.isGoodCityLocation(unit.X, unit.Y) {
		action := &game.FoundCityAction{
			SettlerID: unit.ID,
			CityName:  c.generateCityName(),
		}
		if err := action.Validate(c.Game, c.PlayerID); err == nil {
			actions = append(actions, action)
			return actions
		}
	}

	// Find a good location and move toward it
	target := c.findGoodCityLocation(unit)
	if target != nil {
		nextMove := GetNextMove(c.Game, unit, target.X, target.Y)
		if nextMove != nil {
			action := &game.MoveUnitAction{
				UnitID: unit.ID,
				ToX:    nextMove.X,
				ToY:    nextMove.Y,
			}
			if err := action.Validate(c.Game, c.PlayerID); err == nil {
				actions = append(actions, action)
			}
		}
	}

	return actions
}

// handleMilitaryUnit controls military unit behavior
func (c *Controller) handleMilitaryUnit(unit *game.Unit) []game.Action {
	actions := make([]game.Action, 0)

	switch c.Strategy {
	case StrategyExpansion, StrategyBuildup:
		// Defend cities
		actions = c.defendCity(unit)

	case StrategyAggression:
		// Attack enemies
		actions = c.attackEnemy(unit)
	}

	// If no specific action, try to fortify in a good position
	if len(actions) == 0 {
		if c.shouldFortify(unit) {
			action := &game.FortifyAction{UnitID: unit.ID}
			if err := action.Validate(c.Game, c.PlayerID); err == nil {
				actions = append(actions, action)
			}
		}
	}

	return actions
}

// defendCity moves unit toward an undefended city
func (c *Controller) defendCity(unit *game.Unit) []game.Action {
	actions := make([]game.Action, 0)
	player := c.GetPlayer()

	// Find nearest undefended city
	var targetCity *game.City
	minDist := 9999

	for _, city := range player.Cities {
		defenders := player.GetUnitsAt(city.X, city.Y)
		militaryDefenders := 0
		for _, d := range defenders {
			if !d.CanFoundCity() {
				militaryDefenders++
			}
		}

		if militaryDefenders == 0 {
			dist := DistanceTo(unit.X, unit.Y, city.X, city.Y)
			if dist < minDist {
				minDist = dist
				targetCity = city
			}
		}
	}

	if targetCity != nil {
		// If already in city, fortify
		if unit.X == targetCity.X && unit.Y == targetCity.Y {
			action := &game.FortifyAction{UnitID: unit.ID}
			if err := action.Validate(c.Game, c.PlayerID); err == nil {
				actions = append(actions, action)
			}
		} else {
			// Move toward city
			nextMove := GetNextMove(c.Game, unit, targetCity.X, targetCity.Y)
			if nextMove != nil {
				action := &game.MoveUnitAction{
					UnitID: unit.ID,
					ToX:    nextMove.X,
					ToY:    nextMove.Y,
				}
				if err := action.Validate(c.Game, c.PlayerID); err == nil {
					actions = append(actions, action)
				}
			}
		}
	}

	return actions
}

// attackEnemy moves unit toward and attacks enemies
func (c *Controller) attackEnemy(unit *game.Unit) []game.Action {
	actions := make([]game.Action, 0)

	// Find nearest enemy unit or city
	target := c.findNearestEnemy(unit)
	if target == nil {
		return actions
	}

	// Check if adjacent - can attack
	dx := target.X - unit.X
	dy := target.Y - unit.Y
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}

	if dx <= 1 && dy <= 1 && !(dx == 0 && dy == 0) {
		// Adjacent - attack!
		action := &game.AttackAction{
			AttackerID: unit.ID,
			TargetX:    target.X,
			TargetY:    target.Y,
		}
		if err := action.Validate(c.Game, c.PlayerID); err == nil {
			actions = append(actions, action)
		}
	} else {
		// Move toward enemy
		nextMove := GetNextMove(c.Game, unit, target.X, target.Y)
		if nextMove != nil {
			action := &game.MoveUnitAction{
				UnitID: unit.ID,
				ToX:    nextMove.X,
				ToY:    nextMove.Y,
			}
			if err := action.Validate(c.Game, c.PlayerID); err == nil {
				actions = append(actions, action)
			}
		}
	}

	return actions
}

// findNearestEnemy finds the nearest enemy unit or city
func (c *Controller) findNearestEnemy(unit *game.Unit) *Point {
	minDist := 9999
	var nearest *Point

	for _, player := range c.Game.Players {
		if player.ID == c.PlayerID || !player.IsAlive {
			continue
		}

		// Check enemy units
		for _, enemy := range player.Units {
			dist := DistanceTo(unit.X, unit.Y, enemy.X, enemy.Y)
			if dist < minDist {
				minDist = dist
				nearest = &Point{enemy.X, enemy.Y}
			}
		}

		// Check enemy cities
		for _, city := range player.Cities {
			dist := DistanceTo(unit.X, unit.Y, city.X, city.Y)
			if dist < minDist {
				minDist = dist
				nearest = &Point{city.X, city.Y}
			}
		}
	}

	return nearest
}

// isGoodCityLocation checks if a location is suitable for a city
func (c *Controller) isGoodCityLocation(x, y int) bool {
	tile := c.Game.Map.GetTile(x, y)
	if tile == nil {
		return false
	}

	// Must be suitable terrain
	if tile.IsWater() || tile.Terrain == game.TerrainMountains || tile.Terrain == game.TerrainDesert {
		return false
	}

	// Must not be too close to existing cities
	for _, player := range c.Game.Players {
		for _, city := range player.Cities {
			if DistanceTo(x, y, city.X, city.Y) < 4 {
				return false
			}
		}
	}

	// Check surrounding resources
	neighbors := c.Game.Map.GetTilesInRadius(x, y, 2)
	goodTiles := 0
	for _, n := range neighbors {
		if n.Terrain == game.TerrainGrassland || n.Terrain == game.TerrainPlains || n.Terrain == game.TerrainForest {
			goodTiles++
		}
	}

	return goodTiles >= 5
}

// findGoodCityLocation finds a good location for a new city
func (c *Controller) findGoodCityLocation(unit *game.Unit) *Point {
	// Search in expanding circles
	for radius := 1; radius <= 20; radius++ {
		for dy := -radius; dy <= radius; dy++ {
			for dx := -radius; dx <= radius; dx++ {
				x := unit.X + dx
				y := unit.Y + dy

				if !c.Game.Map.IsValidCoord(x, y) {
					continue
				}

				if c.isGoodCityLocation(x, y) {
					return &Point{x, y}
				}
			}
		}
	}

	return nil
}

// shouldFortify checks if unit should fortify at current position
func (c *Controller) shouldFortify(unit *game.Unit) bool {
	// Fortify if in a city
	city := c.Game.GetCityAt(unit.X, unit.Y)
	if city != nil && city.OwnerID == c.PlayerID {
		return true
	}

	// Fortify on hills or forest for defense
	tile := c.Game.Map.GetTile(unit.X, unit.Y)
	if tile != nil && (tile.Terrain == game.TerrainHills || tile.Terrain == game.TerrainForest) {
		return true
	}

	return false
}

// generateCityName generates a name for a new city
func (c *Controller) generateCityName() string {
	player := c.GetPlayer()
	suffixes := []string{"polis", "burg", "ville", "ton", "grad", "heim"}

	cityNum := len(player.Cities)
	prefix := player.Name[:min(4, len(player.Name))]
	suffix := suffixes[cityNum%len(suffixes)]

	return prefix + suffix
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
