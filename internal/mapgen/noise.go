package mapgen

import (
	"math"
	"math/rand"
)

// PerlinNoise generates Perlin noise values
type PerlinNoise struct {
	perm [512]int
}

// NewPerlinNoise creates a new Perlin noise generator with the given seed
func NewPerlinNoise(seed int64) *PerlinNoise {
	p := &PerlinNoise{}
	rng := rand.New(rand.NewSource(seed))

	// Initialize permutation table with values 0-255
	for i := 0; i < 256; i++ {
		p.perm[i] = i
	}

	// Shuffle using Fisher-Yates
	for i := 255; i > 0; i-- {
		j := rng.Intn(i + 1)
		p.perm[i], p.perm[j] = p.perm[j], p.perm[i]
	}

	// Duplicate for overflow handling
	for i := 0; i < 256; i++ {
		p.perm[256+i] = p.perm[i]
	}

	return p
}

// Noise2D generates 2D Perlin noise at the given coordinates
// Returns a value in the range [-1, 1]
func (p *PerlinNoise) Noise2D(x, y float64) float64 {
	// Find unit grid cell
	xi := int(math.Floor(x)) & 255
	yi := int(math.Floor(y)) & 255

	// Relative position in cell (0 to 1)
	xf := x - math.Floor(x)
	yf := y - math.Floor(y)

	// Compute fade curves
	u := fade(xf)
	v := fade(yf)

	// Hash coordinates of 4 corners
	aa := p.perm[p.perm[xi]+yi]
	ab := p.perm[p.perm[xi]+yi+1]
	ba := p.perm[p.perm[xi+1]+yi]
	bb := p.perm[p.perm[xi+1]+yi+1]

	// Blend results from 4 corners
	x1 := lerp(grad(aa, xf, yf), grad(ba, xf-1, yf), u)
	x2 := lerp(grad(ab, xf, yf-1), grad(bb, xf-1, yf-1), u)

	return lerp(x1, x2, v)
}

// FBM generates Fractal Brownian Motion (multiple octaves of noise)
// Returns a value approximately in the range [-1, 1]
func (p *PerlinNoise) FBM(x, y float64, octaves int, persistence, lacunarity float64) float64 {
	total := 0.0
	amplitude := 1.0
	frequency := 1.0
	maxValue := 0.0

	for i := 0; i < octaves; i++ {
		total += p.Noise2D(x*frequency, y*frequency) * amplitude
		maxValue += amplitude
		amplitude *= persistence
		frequency *= lacunarity
	}

	// Normalize to [-1, 1]
	return total / maxValue
}

// fade computes the fade curve (6t^5 - 15t^4 + 10t^3)
// This provides smoother interpolation than linear
func fade(t float64) float64 {
	return t * t * t * (t*(t*6-15) + 10)
}

// lerp performs linear interpolation between a and b
func lerp(a, b, t float64) float64 {
	return a + t*(b-a)
}

// grad computes gradient based on hash value
func grad(hash int, x, y float64) float64 {
	// Use last 2 bits to select one of 4 gradient directions
	h := hash & 3
	switch h {
	case 0:
		return x + y
	case 1:
		return -x + y
	case 2:
		return x - y
	default:
		return -x - y
	}
}

// Normalize converts a value from [-1, 1] range to [0, 1] range
func Normalize(value float64) float64 {
	return (value + 1) / 2
}

// Clamp constrains a value to the [min, max] range
func Clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}
