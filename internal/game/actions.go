package game

import "errors"

// Action represents a player action that can be validated and executed
type Action interface {
	Validate(g *GameState, playerID string) error
	Execute(g *GameState) error
}

// MoveUnitAction moves a unit to a new position
type MoveUnitAction struct {
	UnitID string `json:"unit_id"`
	ToX    int    `json:"to_x"`
	ToY    int    `json:"to_y"`
}

// Validate checks if the move is valid
func (a *MoveUnitAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	if !unit.CanMove() {
		return ErrNoMovementLeft
	}

	if !g.IsValidMove(unit, a.ToX, a.ToY) {
		return ErrInvalidMove
	}

	return nil
}

// Execute performs the move
func (a *MoveUnitAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	cost := g.GetMovementCost(unit.X, unit.Y, a.ToX, a.ToY)
	unit.X = a.ToX
	unit.Y = a.ToY
	unit.MovementLeft -= cost
	if unit.MovementLeft < 0 {
		unit.MovementLeft = 0
	}
	unit.IsFortified = false

	return nil
}

// AttackAction initiates combat between units
type AttackAction struct {
	AttackerID string `json:"attacker_id"`
	TargetX    int    `json:"target_x"`
	TargetY    int    `json:"target_y"`
}

// Validate checks if the attack is valid
func (a *AttackAction) Validate(g *GameState, playerID string) error {
	attacker := g.GetUnit(a.AttackerID)
	if attacker == nil {
		return ErrUnitNotFound
	}

	if attacker.OwnerID != playerID {
		return ErrNotYourUnit
	}

	if !attacker.CanMove() {
		return ErrNoMovementLeft
	}

	// Check adjacency
	dx := abs(a.TargetX - attacker.X)
	dy := abs(a.TargetY - attacker.Y)
	if dx > 1 || dy > 1 || (dx == 0 && dy == 0) {
		return ErrInvalidTarget
	}

	// Check for enemies at target
	enemies := g.GetEnemyUnitsAt(a.TargetX, a.TargetY, playerID)
	if len(enemies) == 0 {
		// Check for enemy city
		city := g.GetCityAt(a.TargetX, a.TargetY)
		if city == nil || city.OwnerID == playerID {
			return ErrInvalidTarget
		}
	}

	return nil
}

// Execute performs the attack
func (a *AttackAction) Execute(g *GameState) error {
	attacker := g.GetUnit(a.AttackerID)
	if attacker == nil {
		return ErrUnitNotFound
	}

	// Find defender (first enemy unit at location)
	enemies := g.GetEnemyUnitsAt(a.TargetX, a.TargetY, attacker.OwnerID)

	var defender *Unit
	if len(enemies) > 0 {
		// Attack the best defender
		defender = getBestDefender(enemies, g.Map.GetTile(a.TargetX, a.TargetY), g.GetCityAt(a.TargetX, a.TargetY) != nil)
	}

	if defender == nil {
		// No units, but we validated there's a city - just capture it
		city := g.GetCityAt(a.TargetX, a.TargetY)
		if city != nil {
			g.TransferCity(city, attacker.OwnerID)
			// Move attacker to city
			attacker.X = a.TargetX
			attacker.Y = a.TargetY
			attacker.MovementLeft = 0
		}
		return nil
	}

	// Resolve combat
	tile := g.Map.GetTile(a.TargetX, a.TargetY)
	city := g.GetCityAt(a.TargetX, a.TargetY)
	hasWalls := city != nil && city.HasWalls()

	result := ResolveCombat(attacker, defender, tile, city != nil, defender.IsFortified, hasWalls)

	// Apply results
	if result.AttackerDestroyed {
		g.RemoveUnit(attacker.ID)
	} else {
		attacker.Health = BaseHealthPoints - result.AttackerDamage
		attacker.MovementLeft = 0
	}

	if result.DefenderDestroyed {
		g.RemoveUnit(defender.ID)

		// If attacker won and is still alive, move to target location
		if result.AttackerWon && !result.AttackerDestroyed {
			attacker.X = a.TargetX
			attacker.Y = a.TargetY

			// Check if city is now undefended
			remainingDefenders := g.GetEnemyUnitsAt(a.TargetX, a.TargetY, attacker.OwnerID)
			if len(remainingDefenders) == 0 && city != nil {
				// Capture the city
				city.Population = city.Population / 2
				if city.Population < 1 {
					city.Population = 1
				}
				g.TransferCity(city, attacker.OwnerID)
			}
		}
	} else {
		defender.Health = BaseHealthPoints - result.DefenderDamage
	}

	return nil
}

// getBestDefender returns the unit with the highest effective defense
func getBestDefender(units []*Unit, tile *Tile, inCity bool) *Unit {
	var best *Unit
	bestDefense := -1

	for _, u := range units {
		defense := u.EffectiveDefense(tile.Terrain, inCity, u.IsFortified)
		if defense > bestDefense {
			bestDefense = defense
			best = u
		}
	}

	return best
}

// FoundCityAction creates a new city
type FoundCityAction struct {
	SettlerID string `json:"settler_id"`
	CityName  string `json:"city_name"`
}

// Validate checks if a city can be founded
func (a *FoundCityAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.SettlerID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	if !unit.CanFoundCity() {
		return ErrCannotFoundCity
	}

	// Check if there's already a city here
	if g.GetCityAt(unit.X, unit.Y) != nil {
		return ErrCannotFoundCity
	}

	// Check if terrain is suitable (not water, not mountains)
	tile := g.Map.GetTile(unit.X, unit.Y)
	if tile == nil || tile.IsWater() || tile.Terrain == TerrainMountains {
		return ErrCannotFoundCity
	}

	return nil
}

// Execute founds the city
func (a *FoundCityAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.SettlerID)
	if unit == nil {
		return ErrUnitNotFound
	}

	player := g.GetPlayer(unit.OwnerID)
	if player == nil {
		return ErrPlayerNotFound
	}

	// Create the city
	cityName := a.CityName
	if cityName == "" {
		cityName = generateCityName(player, len(player.Cities))
	}

	city := NewCity(cityName, player.ID, unit.X, unit.Y)
	player.AddCity(city)

	// Remove the settler
	g.RemoveUnit(unit.ID)

	return nil
}

// generateCityName generates a default city name
func generateCityName(player *Player, cityIndex int) string {
	// Simple naming: Player name + city number
	suffixes := []string{"burg", "ville", "ton", "polis", "heim", "grad"}
	suffix := suffixes[cityIndex%len(suffixes)]
	return player.Name[:min(4, len(player.Name))] + suffix
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// SetProductionAction changes what a city is building
type SetProductionAction struct {
	CityID    string    `json:"city_id"`
	BuildItem BuildItem `json:"build_item"`
}

// Validate checks if the production can be set
func (a *SetProductionAction) Validate(g *GameState, playerID string) error {
	city := g.GetCity(a.CityID)
	if city == nil {
		return ErrCityNotFound
	}

	if city.OwnerID != playerID {
		return ErrNotYourCity
	}

	// Check if building already exists
	if !a.BuildItem.IsUnit && city.HasBuilding(a.BuildItem.Building) {
		return errors.New("building already exists")
	}

	return nil
}

// Execute sets the production
func (a *SetProductionAction) Execute(g *GameState) error {
	city := g.GetCity(a.CityID)
	if city == nil {
		return ErrCityNotFound
	}

	city.SetProduction(a.BuildItem)
	return nil
}

// FortifyAction puts a unit into fortified mode
type FortifyAction struct {
	UnitID string `json:"unit_id"`
}

// Validate checks if the unit can fortify
func (a *FortifyAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	// Can't fortify settlers
	if unit.CanFoundCity() {
		return errors.New("settlers cannot fortify")
	}

	return nil
}

// Execute fortifies the unit
func (a *FortifyAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	unit.Fortify()
	return nil
}

// SkipUnitAction skips the unit's turn
type SkipUnitAction struct {
	UnitID string `json:"unit_id"`
}

// Validate checks if the action is valid
func (a *SkipUnitAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	return nil
}

// Execute skips the unit
func (a *SkipUnitAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	unit.MovementLeft = 0
	return nil
}

// BuildRoadAction builds a road on the current tile
type BuildRoadAction struct {
	UnitID string `json:"unit_id"`
}

// Validate checks if a road can be built
func (a *BuildRoadAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	// Only settlers can build roads
	if !unit.CanFoundCity() {
		return errors.New("only settlers can build roads")
	}

	// Check if there's already a road here
	tile := g.Map.GetTile(unit.X, unit.Y)
	if tile == nil {
		return errors.New("invalid tile")
	}

	if tile.HasRoad {
		return errors.New("road already exists")
	}

	// Can't build roads on water or mountains
	if tile.IsWater() || tile.Terrain == TerrainMountains {
		return errors.New("cannot build road here")
	}

	return nil
}

// Execute builds the road
func (a *BuildRoadAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	tile := g.Map.GetTile(unit.X, unit.Y)
	if tile == nil {
		return errors.New("invalid tile")
	}

	tile.HasRoad = true
	// Building a road uses all movement
	unit.MovementLeft = 0

	return nil
}

// EndTurnAction ends the current player's turn
type EndTurnAction struct{}

// Validate checks if the turn can be ended
func (a *EndTurnAction) Validate(g *GameState, playerID string) error {
	if g.Phase == PhaseGameOver {
		return ErrGameOver
	}

	if !g.IsCurrentPlayerTurn(playerID) {
		return ErrNotYourTurn
	}

	return nil
}

// Execute ends the turn
func (a *EndTurnAction) Execute(g *GameState) error {
	return g.EndTurn()
}
