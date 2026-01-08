package game

// Game balance constants

const (
	// Map defaults
	DefaultMapWidth  = 80
	DefaultMapHeight = 50

	// City constants
	BaseFoodPerCitizen     = 2  // Food consumed per population
	BaseFoodForGrowth      = 10 // Base food needed for growth
	FoodPerPopForGrowth    = 10 // Additional food per population level
	GranaryFoodRetention   = 50 // Percentage of food kept after growth with granary

	// Combat constants
	BaseHealthPoints       = 100
	DamagePerRound         = 20
	VeteranBonus           = 50 // Percentage bonus for veterans
	FortificationBonus     = 50 // Percentage bonus for fortified units
	CityWallsMultiplier    = 2  // Defense multiplier for city walls

	// Production constants
	BaseProductionPerTurn  = 1

	// Starting resources
	StartingGold           = 0
	StartingUnits          = 2 // 1 Settler + 1 Warrior
)

// TerrainMovementCost defines movement points needed to enter terrain
var TerrainMovementCost = map[TerrainType]int{
	TerrainOcean:     1, // Only for naval units
	TerrainGrassland: 1,
	TerrainPlains:    1,
	TerrainDesert:    1,
	TerrainHills:     2,
	TerrainMountains: 3,
	TerrainForest:    2,
}

// TerrainDefenseBonus defines defense multipliers per terrain
var TerrainDefenseBonus = map[TerrainType]float64{
	TerrainOcean:     1.0,
	TerrainGrassland: 1.0,
	TerrainPlains:    1.0,
	TerrainDesert:    1.0,
	TerrainHills:     1.5,
	TerrainMountains: 2.0,
	TerrainForest:    1.5,
}

// TerrainFoodYield defines base food production per terrain
var TerrainFoodYield = map[TerrainType]int{
	TerrainOcean:     1,
	TerrainGrassland: 2,
	TerrainPlains:    1,
	TerrainDesert:    0,
	TerrainHills:     1,
	TerrainMountains: 0,
	TerrainForest:    1,
}

// TerrainProductionYield defines base production (shields) per terrain
var TerrainProductionYield = map[TerrainType]int{
	TerrainOcean:     0,
	TerrainGrassland: 0,
	TerrainPlains:    1,
	TerrainDesert:    0,
	TerrainHills:     2,
	TerrainMountains: 1,
	TerrainForest:    2,
}
