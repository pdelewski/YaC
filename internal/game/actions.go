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

// UnfortifyAction wakes up a fortified unit
type UnfortifyAction struct {
	UnitID string `json:"unit_id"`
}

// Validate checks if the unit can be unfortified
func (a *UnfortifyAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	return nil
}

// Execute unfortifies the unit
func (a *UnfortifyAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	unit.Unfortify()
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

	// Must have movement left
	if unit.MovementLeft <= 0 {
		return ErrNoMovementLeft
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

// GroupUnitsAction creates a new group from units on the same tile
type GroupUnitsAction struct {
	UnitIDs []string `json:"unit_ids"`
}

// Validate checks if the units can be grouped
func (a *GroupUnitsAction) Validate(g *GameState, playerID string) error {
	if len(a.UnitIDs) < 2 {
		return errors.New("need at least 2 units to form a group")
	}

	var refX, refY int
	for i, unitID := range a.UnitIDs {
		unit := g.GetUnit(unitID)
		if unit == nil {
			return ErrUnitNotFound
		}
		if unit.OwnerID != playerID {
			return ErrNotYourUnit
		}
		if unit.GroupID != "" {
			return errors.New("unit already in a group")
		}

		if i == 0 {
			refX, refY = unit.X, unit.Y
		} else if unit.X != refX || unit.Y != refY {
			return errors.New("all units must be on the same tile")
		}
	}
	return nil
}

// Execute creates the group
func (a *GroupUnitsAction) Execute(g *GameState) error {
	if len(a.UnitIDs) == 0 {
		return errors.New("no units specified")
	}

	// Generate group ID
	firstUnit := g.GetUnit(a.UnitIDs[0])
	if firstUnit == nil {
		return ErrUnitNotFound
	}

	player := g.GetPlayer(firstUnit.OwnerID)
	if player == nil {
		return ErrPlayerNotFound
	}

	// Create a simple group ID
	groupID := "group_" + firstUnit.ID[:8]

	// Assign group ID to all units
	for _, unitID := range a.UnitIDs {
		unit := g.GetUnit(unitID)
		if unit != nil {
			unit.GroupID = groupID
		}
	}

	// Add group to player
	group := &UnitGroup{
		ID:      groupID,
		UnitIDs: a.UnitIDs,
	}
	player.AddGroup(group)

	return nil
}

// UngroupUnitsAction dissolves a unit group
type UngroupUnitsAction struct {
	GroupID string `json:"group_id"`
}

// Validate checks if the group can be ungrouped
func (a *UngroupUnitsAction) Validate(g *GameState, playerID string) error {
	// Find any unit with this group ID to validate ownership
	found := false
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				if unit.OwnerID != playerID {
					return ErrNotYourUnit
				}
				found = true
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		return errors.New("group not found")
	}

	return nil
}

// Execute dissolves the group
func (a *UngroupUnitsAction) Execute(g *GameState) error {
	var ownerID string

	// Clear group ID from all units
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				ownerID = unit.OwnerID
				unit.GroupID = ""
			}
		}
	}

	// Remove group from player
	if ownerID != "" {
		player := g.GetPlayer(ownerID)
		if player != nil {
			player.RemoveGroup(a.GroupID)
		}
	}

	return nil
}

// MoveGroupAction moves all units in a group together
type MoveGroupAction struct {
	GroupID string `json:"group_id"`
	ToX     int    `json:"to_x"`
	ToY     int    `json:"to_y"`
}

// Validate checks if the group can move
func (a *MoveGroupAction) Validate(g *GameState, playerID string) error {
	// Find units in this group
	var units []*Unit
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				units = append(units, unit)
			}
		}
	}

	if len(units) == 0 {
		return errors.New("group not found")
	}

	// Check ownership and movement for all units
	for _, unit := range units {
		if unit.OwnerID != playerID {
			return ErrNotYourUnit
		}
		if unit.IsFortified {
			return errors.New("cannot move fortified unit in group")
		}
	}

	// Check minimum movement
	minMovement := 999
	for _, unit := range units {
		if unit.MovementLeft < minMovement {
			minMovement = unit.MovementLeft
		}
	}
	if minMovement <= 0 {
		return ErrNoMovementLeft
	}

	// Validate move destination using first unit's position
	if !g.IsValidMove(units[0], a.ToX, a.ToY) {
		return ErrInvalidMove
	}

	return nil
}

// Execute moves all units in the group
func (a *MoveGroupAction) Execute(g *GameState) error {
	// Find units in this group
	var units []*Unit
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				units = append(units, unit)
			}
		}
	}

	if len(units) == 0 {
		return errors.New("group not found")
	}

	// Get movement cost from first unit's position
	cost := g.GetMovementCost(units[0].X, units[0].Y, a.ToX, a.ToY)

	// Move all units
	for _, unit := range units {
		unit.X = a.ToX
		unit.Y = a.ToY
		unit.MovementLeft -= cost
		if unit.MovementLeft < 0 {
			unit.MovementLeft = 0
		}
		unit.IsFortified = false
	}

	return nil
}

// AttackGroupAction attacks with all units in a group sequentially
type AttackGroupAction struct {
	GroupID string `json:"group_id"`
	TargetX int    `json:"target_x"`
	TargetY int    `json:"target_y"`
}

// Validate checks if the group can attack
func (a *AttackGroupAction) Validate(g *GameState, playerID string) error {
	// Find units in this group
	var units []*Unit
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				units = append(units, unit)
			}
		}
	}

	if len(units) == 0 {
		return errors.New("group not found")
	}

	// Check ownership and that at least one unit can attack
	hasAttacker := false
	for _, unit := range units {
		if unit.OwnerID != playerID {
			return ErrNotYourUnit
		}
		if unit.CanMove() {
			hasAttacker = true
		}
	}

	if !hasAttacker {
		return ErrNoMovementLeft
	}

	// Check adjacency
	refUnit := units[0]
	dx := abs(a.TargetX - refUnit.X)
	dy := abs(a.TargetY - refUnit.Y)
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

// Execute performs sequential attacks with all group units
func (a *AttackGroupAction) Execute(g *GameState) error {
	// Find units in this group that can attack
	var attackers []*Unit
	var groupOwnerID string
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID && unit.CanMove() {
				attackers = append(attackers, unit)
				groupOwnerID = unit.OwnerID
			}
		}
	}

	if len(attackers) == 0 {
		return errors.New("no units can attack")
	}

	// Attack sequentially until no enemies remain or all attackers have attacked
	for _, attacker := range attackers {
		// Check if there are still enemies
		enemies := g.GetEnemyUnitsAt(a.TargetX, a.TargetY, groupOwnerID)
		city := g.GetCityAt(a.TargetX, a.TargetY)

		if len(enemies) == 0 {
			// No more enemy units - check if there's an enemy city to capture
			if city != nil && city.OwnerID != groupOwnerID {
				// Capture the city
				g.TransferCity(city, groupOwnerID)
				// Move all remaining group attackers to the city
				for _, u := range attackers {
					if u.IsAlive() && u.GroupID == a.GroupID {
						u.X = a.TargetX
						u.Y = a.TargetY
						u.MovementLeft = 0
					}
				}
			}
			break
		}

		// Find best defender
		tile := g.Map.GetTile(a.TargetX, a.TargetY)
		hasWalls := city != nil && city.HasWalls()
		defender := getBestDefender(enemies, tile, city != nil)

		if defender == nil {
			break
		}

		// Resolve combat
		result := ResolveCombat(attacker, defender, tile, city != nil, defender.IsFortified, hasWalls)

		// Apply results to attacker
		if result.AttackerDestroyed {
			g.RemoveUnit(attacker.ID)
		} else {
			attacker.Health = BaseHealthPoints - result.AttackerDamage
			attacker.MovementLeft = 0
		}

		// Apply results to defender
		if result.DefenderDestroyed {
			g.RemoveUnit(defender.ID)

			// If attacker won and is still alive, it can move to target
			if result.AttackerWon && !result.AttackerDestroyed {
				// Check if city is now undefended
				remainingDefenders := g.GetEnemyUnitsAt(a.TargetX, a.TargetY, groupOwnerID)
				if len(remainingDefenders) == 0 && city != nil {
					// Capture the city
					city.Population = city.Population / 2
					if city.Population < 1 {
						city.Population = 1
					}
					g.TransferCity(city, groupOwnerID)
					// Move all surviving group units to captured location
					for _, u := range attackers {
						if u.IsAlive() && u.GroupID == a.GroupID {
							u.X = a.TargetX
							u.Y = a.TargetY
							u.MovementLeft = 0
						}
					}
					break
				}
			}
		} else {
			defender.Health = BaseHealthPoints - result.DefenderDamage
		}
	}

	return nil
}

// SetGotoAction sets a goto destination for a unit
type SetGotoAction struct {
	UnitID string `json:"unit_id"`
	GotoX  int    `json:"goto_x"`
	GotoY  int    `json:"goto_y"`
}

// Validate checks if the goto is valid
func (a *SetGotoAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	// Check destination is valid (on map and passable)
	if a.GotoX < 0 || a.GotoX >= g.Map.Width || a.GotoY < 0 || a.GotoY >= g.Map.Height {
		return ErrInvalidMove
	}

	tile := g.Map.GetTile(a.GotoX, a.GotoY)
	if tile == nil || tile.Terrain == TerrainOcean || tile.Terrain == TerrainMountains {
		return ErrInvalidMove
	}

	return nil
}

// Execute sets the goto destination
func (a *SetGotoAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	unit.SetGoto(a.GotoX, a.GotoY)
	return nil
}

// ClearGotoAction clears a goto destination for a unit
type ClearGotoAction struct {
	UnitID string `json:"unit_id"`
}

// Validate checks if the unit exists and is owned by player
func (a *ClearGotoAction) Validate(g *GameState, playerID string) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	if unit.OwnerID != playerID {
		return ErrNotYourUnit
	}

	return nil
}

// Execute clears the goto destination
func (a *ClearGotoAction) Execute(g *GameState) error {
	unit := g.GetUnit(a.UnitID)
	if unit == nil {
		return ErrUnitNotFound
	}

	unit.ClearGoto()
	return nil
}

// SetGroupGotoAction sets a goto destination for all units in a group
type SetGroupGotoAction struct {
	GroupID string `json:"group_id"`
	GotoX   int    `json:"goto_x"`
	GotoY   int    `json:"goto_y"`
}

// Validate checks if the group exists and goto is valid
func (a *SetGroupGotoAction) Validate(g *GameState, playerID string) error {
	// Find units in this group
	found := false
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				if unit.OwnerID != playerID {
					return ErrNotYourUnit
				}
				found = true
			}
		}
	}

	if !found {
		return errors.New("group not found")
	}

	// Check destination is valid
	if a.GotoX < 0 || a.GotoX >= g.Map.Width || a.GotoY < 0 || a.GotoY >= g.Map.Height {
		return ErrInvalidMove
	}

	tile := g.Map.GetTile(a.GotoX, a.GotoY)
	if tile == nil || tile.Terrain == TerrainOcean || tile.Terrain == TerrainMountains {
		return ErrInvalidMove
	}

	return nil
}

// Execute sets the goto destination for all units in the group
func (a *SetGroupGotoAction) Execute(g *GameState) error {
	for _, player := range g.Players {
		for _, unit := range player.Units {
			if unit.GroupID == a.GroupID {
				unit.SetGoto(a.GotoX, a.GotoY)
			}
		}
	}
	return nil
}
