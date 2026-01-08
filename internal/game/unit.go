package game

import "github.com/google/uuid"

// UnitType represents different types of units
type UnitType int

const (
	UnitSettler UnitType = iota
	UnitWarrior
	UnitPhalanx
	UnitArcher
	UnitHorseman
	UnitCatapult
)

// String returns the string representation of a unit type
func (u UnitType) String() string {
	switch u {
	case UnitSettler:
		return "Settler"
	case UnitWarrior:
		return "Warrior"
	case UnitPhalanx:
		return "Phalanx"
	case UnitArcher:
		return "Archer"
	case UnitHorseman:
		return "Horseman"
	case UnitCatapult:
		return "Catapult"
	default:
		return "Unknown"
	}
}

// UnitTemplate defines the base stats for a unit type
type UnitTemplate struct {
	Type         UnitType
	Name         string
	Attack       int
	Defense      int
	Movement     int
	Cost         int  // Production cost
	IsNaval      bool
	CanFoundCity bool
	CanBuildRoad bool
	IsSiege      bool // Can bypass city walls
}

// UnitTemplates contains all unit type definitions
var UnitTemplates = map[UnitType]UnitTemplate{
	UnitSettler: {
		Type:         UnitSettler,
		Name:         "Settler",
		Attack:       0,
		Defense:      1,
		Movement:     1,
		Cost:         40,
		IsNaval:      false,
		CanFoundCity: true,
		CanBuildRoad: true,
		IsSiege:      false,
	},
	UnitWarrior: {
		Type:         UnitWarrior,
		Name:         "Warrior",
		Attack:       1,
		Defense:      1,
		Movement:     1,
		Cost:         10,
		IsNaval:      false,
		CanFoundCity: false,
		CanBuildRoad: false,
		IsSiege:      false,
	},
	UnitPhalanx: {
		Type:         UnitPhalanx,
		Name:         "Phalanx",
		Attack:       1,
		Defense:      2,
		Movement:     1,
		Cost:         20,
		IsNaval:      false,
		CanFoundCity: false,
		CanBuildRoad: false,
		IsSiege:      false,
	},
	UnitArcher: {
		Type:         UnitArcher,
		Name:         "Archer",
		Attack:       2,
		Defense:      1,
		Movement:     1,
		Cost:         20,
		IsNaval:      false,
		CanFoundCity: false,
		CanBuildRoad: false,
		IsSiege:      false,
	},
	UnitHorseman: {
		Type:         UnitHorseman,
		Name:         "Horseman",
		Attack:       2,
		Defense:      1,
		Movement:     2,
		Cost:         20,
		IsNaval:      false,
		CanFoundCity: false,
		CanBuildRoad: false,
		IsSiege:      false,
	},
	UnitCatapult: {
		Type:         UnitCatapult,
		Name:         "Catapult",
		Attack:       6,
		Defense:      1,
		Movement:     1,
		Cost:         40,
		IsNaval:      false,
		CanFoundCity: false,
		CanBuildRoad: false,
		IsSiege:      true,
	},
}

// Unit represents a single unit in the game
type Unit struct {
	ID           string   `json:"id"`
	Type         UnitType `json:"type"`
	OwnerID      string   `json:"owner_id"`
	X            int      `json:"x"`
	Y            int      `json:"y"`
	MovementLeft int      `json:"movement_left"`
	Health       int      `json:"health"`
	IsVeteran    bool     `json:"is_veteran"`
	IsFortified  bool     `json:"is_fortified"`
}

// NewUnit creates a new unit at the specified location
func NewUnit(unitType UnitType, ownerID string, x, y int) *Unit {
	template := UnitTemplates[unitType]
	return &Unit{
		ID:           uuid.New().String(),
		Type:         unitType,
		OwnerID:      ownerID,
		X:            x,
		Y:            y,
		MovementLeft: template.Movement,
		Health:       BaseHealthPoints,
		IsVeteran:    false,
		IsFortified:  false,
	}
}

// Template returns the unit template for this unit
func (u *Unit) Template() UnitTemplate {
	return UnitTemplates[u.Type]
}

// EffectiveAttack returns the attack value with modifiers
func (u *Unit) EffectiveAttack() int {
	attack := u.Template().Attack
	if u.IsVeteran {
		attack = attack * (100 + VeteranBonus) / 100
	}
	return attack
}

// EffectiveDefense returns the defense value with modifiers
func (u *Unit) EffectiveDefense(terrain TerrainType, inCity bool, fortified bool) int {
	defense := u.Template().Defense
	if u.IsVeteran {
		defense = defense * (100 + VeteranBonus) / 100
	}

	// Apply terrain bonus
	defenseFloat := float64(defense) * TerrainDefenseBonus[terrain]
	defense = int(defenseFloat)

	// Apply fortification bonus
	if fortified || u.IsFortified {
		defense = defense * (100 + FortificationBonus) / 100
	}

	// Minimum defense of 1
	if defense < 1 {
		defense = 1
	}

	return defense
}

// CanMove returns whether the unit has movement points left
func (u *Unit) CanMove() bool {
	return u.MovementLeft > 0 && !u.IsFortified
}

// ResetMovement resets movement points to full
func (u *Unit) ResetMovement() {
	u.MovementLeft = u.Template().Movement
}

// Fortify puts the unit in fortified mode
func (u *Unit) Fortify() {
	u.IsFortified = true
	u.MovementLeft = 0
}

// Unfortify removes fortified status
func (u *Unit) Unfortify() {
	u.IsFortified = false
}

// TakeDamage reduces unit health
func (u *Unit) TakeDamage(damage int) {
	u.Health -= damage
	if u.Health < 0 {
		u.Health = 0
	}
}

// IsAlive returns whether the unit is still alive
func (u *Unit) IsAlive() bool {
	return u.Health > 0
}

// CanFoundCity returns whether this unit can found a city
func (u *Unit) CanFoundCity() bool {
	return u.Template().CanFoundCity
}

// CanBuildRoad returns whether this unit can build roads
func (u *Unit) CanBuildRoad() bool {
	return u.Template().CanBuildRoad
}

// IsSiegeUnit returns whether this unit bypasses city walls
func (u *Unit) IsSiegeUnit() bool {
	return u.Template().IsSiege
}
