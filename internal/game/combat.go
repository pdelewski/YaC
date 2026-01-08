package game

import (
	"math/rand"
)

// CombatResult holds the outcome of a combat
type CombatResult struct {
	AttackerWon       bool `json:"attacker_won"`
	AttackerDamage    int  `json:"attacker_damage"`
	DefenderDamage    int  `json:"defender_damage"`
	AttackerDestroyed bool `json:"attacker_destroyed"`
	DefenderDestroyed bool `json:"defender_destroyed"`
	AttackerVeteran   bool `json:"attacker_veteran"` // Did attacker become veteran
	DefenderVeteran   bool `json:"defender_veteran"` // Did defender become veteran
}

// ResolveCombat resolves combat between an attacker and defender
// This uses a multi-round system similar to Civ1
func ResolveCombat(attacker, defender *Unit, tile *Tile, inCity bool, fortified bool, hasWalls bool) CombatResult {
	result := CombatResult{}

	// Calculate effective strengths
	attackStrength := attacker.EffectiveAttack()
	defenseStrength := defender.EffectiveDefense(tile.Terrain, inCity, fortified)

	// City walls double defense for non-siege units
	if hasWalls && inCity && !attacker.IsSiegeUnit() {
		defenseStrength *= CityWallsMultiplier
	}

	// Scale to combat rounds (multiply by 8 like Civ1)
	attackStrength *= 8
	defenseStrength *= 8

	// Ensure minimum values
	if attackStrength < 1 {
		attackStrength = 1
	}
	if defenseStrength < 1 {
		defenseStrength = 1
	}

	// Multi-round combat
	attackHP := BaseHealthPoints
	defendHP := BaseHealthPoints

	total := attackStrength + defenseStrength
	attackerHitChance := float64(attackStrength) / float64(total)

	// Combat rounds until one unit reaches 0 HP
	for attackHP > 0 && defendHP > 0 {
		if rand.Float64() < attackerHitChance {
			// Attacker scores a hit
			defendHP -= DamagePerRound
		} else {
			// Defender scores a hit
			attackHP -= DamagePerRound
		}
	}

	// Determine winner
	result.AttackerWon = attackHP > 0
	result.AttackerDamage = BaseHealthPoints - attackHP
	result.DefenderDamage = BaseHealthPoints - defendHP
	result.AttackerDestroyed = attackHP <= 0
	result.DefenderDestroyed = defendHP <= 0

	// Veteran promotion for winner (50% chance)
	if result.AttackerWon && !attacker.IsVeteran {
		if rand.Float64() < 0.5 {
			result.AttackerVeteran = true
			attacker.IsVeteran = true
		}
	} else if !result.AttackerWon && !defender.IsVeteran {
		if rand.Float64() < 0.5 {
			result.DefenderVeteran = true
			defender.IsVeteran = true
		}
	}

	return result
}

// ResolveCombatSimple uses a simplified single-roll combat system
// This is faster but less dramatic than the multi-round system
func ResolveCombatSimple(attacker, defender *Unit, tile *Tile, inCity bool, fortified bool, hasWalls bool) CombatResult {
	result := CombatResult{}

	// Calculate effective strengths
	attackStrength := attacker.EffectiveAttack()
	defenseStrength := defender.EffectiveDefense(tile.Terrain, inCity, fortified)

	// City walls double defense for non-siege units
	if hasWalls && inCity && !attacker.IsSiegeUnit() {
		defenseStrength *= CityWallsMultiplier
	}

	// Ensure minimum values
	if attackStrength < 1 {
		attackStrength = 1
	}
	if defenseStrength < 1 {
		defenseStrength = 1
	}

	// Simple probabilistic combat
	total := attackStrength + defenseStrength
	attackerChance := float64(attackStrength) / float64(total)

	// Single roll determines winner
	if rand.Float64() < attackerChance {
		result.AttackerWon = true
		result.DefenderDestroyed = true
		result.DefenderDamage = BaseHealthPoints

		// Veteran promotion
		if !attacker.IsVeteran && rand.Float64() < 0.5 {
			result.AttackerVeteran = true
			attacker.IsVeteran = true
		}
	} else {
		result.AttackerWon = false
		result.AttackerDestroyed = true
		result.AttackerDamage = BaseHealthPoints

		// Veteran promotion
		if !defender.IsVeteran && rand.Float64() < 0.5 {
			result.DefenderVeteran = true
			defender.IsVeteran = true
		}
	}

	return result
}

// CalculateOdds returns the attacker's win probability (0.0 to 1.0)
func CalculateOdds(attacker, defender *Unit, tile *Tile, inCity bool, fortified bool, hasWalls bool) float64 {
	attackStrength := attacker.EffectiveAttack()
	defenseStrength := defender.EffectiveDefense(tile.Terrain, inCity, fortified)

	if hasWalls && inCity && !attacker.IsSiegeUnit() {
		defenseStrength *= CityWallsMultiplier
	}

	if attackStrength < 1 {
		attackStrength = 1
	}
	if defenseStrength < 1 {
		defenseStrength = 1
	}

	total := attackStrength + defenseStrength
	return float64(attackStrength) / float64(total)
}

// SimulateCombat runs multiple simulations and returns win percentage
func SimulateCombat(attacker, defender *Unit, tile *Tile, inCity bool, fortified bool, hasWalls bool, simulations int) float64 {
	wins := 0

	// Save original veteran status
	attackerVet := attacker.IsVeteran
	defenderVet := defender.IsVeteran

	for i := 0; i < simulations; i++ {
		// Reset veteran status for simulation
		attacker.IsVeteran = attackerVet
		defender.IsVeteran = defenderVet

		result := ResolveCombat(attacker, defender, tile, inCity, fortified, hasWalls)
		if result.AttackerWon {
			wins++
		}
	}

	// Restore original status
	attacker.IsVeteran = attackerVet
	defender.IsVeteran = defenderVet

	return float64(wins) / float64(simulations)
}
