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

// ResourceType represents a map resource
type ResourceType int

const (
	ResourceNone ResourceType = iota
	ResourceOil
	ResourceCoal
	ResourceGold
	ResourceIron
	ResourceGems
	ResourceUranium
	ResourceWheat
	ResourceHorses
	ResourceFish
	ResourceSilk
	ResourceSpices
	ResourceFurs
)

// String returns the string representation of a resource type
func (r ResourceType) String() string {
	switch r {
	case ResourceOil:
		return "oil"
	case ResourceCoal:
		return "coal"
	case ResourceGold:
		return "gold"
	case ResourceIron:
		return "iron"
	case ResourceGems:
		return "gems"
	case ResourceUranium:
		return "uranium"
	case ResourceWheat:
		return "wheat"
	case ResourceHorses:
		return "horses"
	case ResourceFish:
		return "fish"
	case ResourceSilk:
		return "silk"
	case ResourceSpices:
		return "spices"
	case ResourceFurs:
		return "furs"
	default:
		return ""
	}
}

// ResourceBonus defines the bonus yields for each resource
type ResourceBonus struct {
	Food       int
	Production int
	Trade      int
}

// ResourceBonuses maps resource types to their yield bonuses
var ResourceBonuses = map[ResourceType]ResourceBonus{
	ResourceOil:     {Food: 0, Production: 3, Trade: 0},
	ResourceCoal:    {Food: 0, Production: 2, Trade: 0},
	ResourceGold:    {Food: 0, Production: 0, Trade: 4},
	ResourceIron:    {Food: 0, Production: 2, Trade: 0},
	ResourceGems:    {Food: 0, Production: 0, Trade: 3},
	ResourceUranium: {Food: 0, Production: 3, Trade: 0},
	ResourceWheat:   {Food: 3, Production: 0, Trade: 0},
	ResourceHorses:  {Food: 1, Production: 1, Trade: 1},
	ResourceFish:    {Food: 3, Production: 0, Trade: 0},
	ResourceSilk:    {Food: 0, Production: 0, Trade: 3},
	ResourceSpices:  {Food: 0, Production: 0, Trade: 2},
	ResourceFurs:    {Food: 1, Production: 0, Trade: 2},
}

// ValidTerrainForResource defines which terrains can have each resource
var ValidTerrainForResource = map[ResourceType][]TerrainType{
	ResourceOil:     {TerrainDesert, TerrainPlains, TerrainOcean},
	ResourceCoal:    {TerrainHills, TerrainMountains},
	ResourceGold:    {TerrainHills, TerrainMountains, TerrainDesert},
	ResourceIron:    {TerrainHills, TerrainMountains},
	ResourceGems:    {TerrainHills, TerrainMountains, TerrainForest},
	ResourceUranium: {TerrainHills, TerrainMountains, TerrainDesert},
	ResourceWheat:   {TerrainGrassland, TerrainPlains},
	ResourceHorses:  {TerrainGrassland, TerrainPlains},
	ResourceFish:    {TerrainOcean},
	ResourceSilk:    {TerrainForest, TerrainGrassland},
	ResourceSpices:  {TerrainForest, TerrainGrassland},
	ResourceFurs:    {TerrainForest},
}
