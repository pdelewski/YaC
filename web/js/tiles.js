// Terrain Tile Generator - Creates realistic-looking terrain tiles
class TileGenerator {
    constructor() {
        this.tileSize = 64; // Generate at higher resolution for quality
        this.tiles = {};
        this.variationCount = 4; // Number of variations per terrain
        this.ready = false;
        this.generateAllTiles();
    }

    // Generate all terrain tiles with variations
    generateAllTiles() {
        const terrains = ['Ocean', 'Grassland', 'Plains', 'Desert', 'Hills', 'Mountains', 'Forest'];

        for (const terrain of terrains) {
            this.tiles[terrain] = [];
            for (let v = 0; v < this.variationCount; v++) {
                this.tiles[terrain].push(this.generateTile(terrain, v));
            }
        }
        this.ready = true;
    }

    // Generate a single terrain tile with variation seed
    generateTile(terrain, variationSeed) {
        const canvas = document.createElement('canvas');
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const ctx = canvas.getContext('2d');
        const s = this.tileSize;

        switch(terrain) {
            case 'Ocean':
                this.drawOceanTile(ctx, s, variationSeed);
                break;
            case 'Grassland':
                this.drawGrasslandTile(ctx, s, variationSeed);
                break;
            case 'Plains':
                this.drawPlainsTile(ctx, s, variationSeed);
                break;
            case 'Desert':
                this.drawDesertTile(ctx, s, variationSeed);
                break;
            case 'Hills':
                this.drawHillsTile(ctx, s, variationSeed);
                break;
            case 'Mountains':
                this.drawMountainsTile(ctx, s, variationSeed);
                break;
            case 'Forest':
                this.drawForestTile(ctx, s, variationSeed);
                break;
        }

        return canvas;
    }

    // Perlin-like noise for texture
    noise(x, y, seed) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
        return n - Math.floor(n);
    }

    // Smooth noise
    smoothNoise(x, y, seed, scale) {
        const ix = Math.floor(x / scale);
        const iy = Math.floor(y / scale);
        const fx = (x / scale) - ix;
        const fy = (y / scale) - iy;

        const v1 = this.noise(ix, iy, seed);
        const v2 = this.noise(ix + 1, iy, seed);
        const v3 = this.noise(ix, iy + 1, seed);
        const v4 = this.noise(ix + 1, iy + 1, seed);

        const i1 = v1 * (1 - fx) + v2 * fx;
        const i2 = v3 * (1 - fx) + v4 * fx;

        return i1 * (1 - fy) + i2 * fy;
    }

    // Fractal noise
    fractalNoise(x, y, seed, octaves) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.smoothNoise(x * frequency, y * frequency, seed + i * 100, 8) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    // Ocean with realistic water texture
    drawOceanTile(ctx, s, varSeed = 0) {
        // Deep water base with variation
        const baseHue = 200 + varSeed * 5;
        const gradient = ctx.createLinearGradient(0, 0, s, s);
        gradient.addColorStop(0, `hsl(${baseHue}, 60%, 28%)`);
        gradient.addColorStop(0.5, `hsl(${baseHue}, 55%, 38%)`);
        gradient.addColorStop(1, `hsl(${baseHue}, 60%, 28%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, s, s);

        // Add wave texture using noise
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;
                const noise = this.fractalNoise(x, y, 42 + seedOffset, 3);
                const wave = Math.sin((x + y) * 0.2 + noise * 5 + varSeed) * 0.5 + 0.5;

                // Modulate color based on noise
                data[idx] = Math.min(255, data[idx] + (noise * 30 - 15) + wave * 20);
                data[idx + 1] = Math.min(255, data[idx + 1] + (noise * 40 - 20) + wave * 25);
                data[idx + 2] = Math.min(255, data[idx + 2] + (noise * 20 - 10) + wave * 15);
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Add subtle wave highlights with variation
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        const waveOffset = varSeed * 0.1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, s * (0.3 + i * 0.25 + waveOffset));
            ctx.bezierCurveTo(s * 0.3, s * (0.25 + i * 0.25), s * 0.6, s * (0.35 + i * 0.25), s, s * (0.3 + i * 0.25 + waveOffset));
            ctx.stroke();
        }
    }

    // Grassland with natural grass texture
    drawGrasslandTile(ctx, s, varSeed = 0) {
        // Base green with variation
        const baseGreen = 140 + varSeed * 8;
        ctx.fillStyle = `rgb(74, ${baseGreen}, 74)`;
        ctx.fillRect(0, 0, s, s);

        // Add noise texture
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;
                const noise1 = this.fractalNoise(x, y, 123 + seedOffset, 4);
                const noise2 = this.fractalNoise(x * 2, y * 2, 456 + seedOffset, 2);

                // Create grass variation
                const variation = (noise1 - 0.5) * 50 + (noise2 - 0.5) * 25;

                data[idx] = Math.max(0, Math.min(255, 74 + variation * 0.5));
                data[idx + 1] = Math.max(0, Math.min(255, baseGreen + variation));
                data[idx + 2] = Math.max(0, Math.min(255, 74 + variation * 0.3));
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Add grass blade details with variation
        ctx.strokeStyle = '#3a7a3a';
        ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
            const x = this.noise(i, 0, 789 + seedOffset) * s;
            const y = this.noise(i, 1, 789 + seedOffset) * s;
            const height = 3 + this.noise(i, 2, 789 + seedOffset) * 5;
            const lean = (this.noise(i, 3, 789 + seedOffset) - 0.5) * 3;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + lean, y - height);
            ctx.stroke();
        }
    }

    // Plains with dry grass and earth
    drawPlainsTile(ctx, s, varSeed = 0) {
        // Tan/wheat base with variation
        const baseTan = 196 + varSeed * 5;
        ctx.fillStyle = `rgb(${baseTan}, ${Math.floor(baseTan * 0.85)}, 84)`;
        ctx.fillRect(0, 0, s, s);

        // Add texture
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;
                const noise = this.fractalNoise(x, y, 234 + seedOffset, 4);
                const dirt = this.fractalNoise(x * 0.5, y * 0.5, 567 + seedOffset, 2);

                let variation = (noise - 0.5) * 40;

                // Add dirt patches
                if (dirt > 0.6) {
                    variation -= 30;
                    data[idx] = Math.max(0, Math.min(255, 160 + variation));
                    data[idx + 1] = Math.max(0, Math.min(255, 130 + variation));
                    data[idx + 2] = Math.max(0, Math.min(255, 80 + variation * 0.5));
                } else {
                    data[idx] = Math.max(0, Math.min(255, baseTan + variation));
                    data[idx + 1] = Math.max(0, Math.min(255, 168 + variation));
                    data[idx + 2] = Math.max(0, Math.min(255, 84 + variation * 0.5));
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Dry grass stalks with variation
        ctx.strokeStyle = '#a89040';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const x = this.noise(i, 0, 321 + seedOffset) * s;
            const y = this.noise(i, 1, 321 + seedOffset) * s * 0.7 + s * 0.3;
            const height = 4 + this.noise(i, 2, 321 + seedOffset) * 6;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 1, y - height);
            ctx.moveTo(x, y);
            ctx.lineTo(x + 1, y - height * 0.8);
            ctx.stroke();
        }
    }

    // Desert with sand dunes
    drawDesertTile(ctx, s, varSeed = 0) {
        // Sand base with variation
        const hueShift = varSeed * 3;
        const gradient = ctx.createLinearGradient(0, 0, s, s);
        gradient.addColorStop(0, `hsl(${45 + hueShift}, 60%, 73%)`);
        gradient.addColorStop(0.5, `hsl(${45 + hueShift}, 55%, 77%)`);
        gradient.addColorStop(1, `hsl(${45 + hueShift}, 60%, 68%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, s, s);

        // Add sand texture
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;
                const noise = this.fractalNoise(x, y, 345 + seedOffset, 4);
                const dune = Math.sin((x + noise * 20 + varSeed * 10) * 0.15) * 0.5 + 0.5;

                const variation = (noise - 0.5) * 30 + dune * 20;

                data[idx] = Math.max(0, Math.min(255, data[idx] + variation));
                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + variation * 0.9));
                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + variation * 0.5));
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Sand ripple lines with variation
        ctx.strokeStyle = 'rgba(200, 180, 120, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const yBase = s * (0.15 + i * 0.18 + varSeed * 0.02);
            ctx.beginPath();
            ctx.moveTo(0, yBase);
            for (let x = 0; x < s; x += 4) {
                ctx.lineTo(x, yBase + Math.sin(x * 0.3 + i + varSeed) * 2);
            }
            ctx.stroke();
        }
    }

    // Hills with elevation shading
    drawHillsTile(ctx, s, varSeed = 0) {
        // Green-brown base with variation
        const baseGreen = 154 + varSeed * 6;
        ctx.fillStyle = `rgb(106, ${baseGreen}, 80)`;
        ctx.fillRect(0, 0, s, s);

        // Create hill shapes
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        // Vary hill positions based on seed
        const hill1X = 0.35 + (varSeed % 2) * 0.15;
        const hill2X = 0.7 - (varSeed % 3) * 0.1;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;

                // Hill height map with variation
                const hill1 = Math.max(0, 1 - Math.sqrt(Math.pow((x - s * hill1X) / (s * 0.4), 2) + Math.pow((y - s * 0.6) / (s * 0.5), 2)));
                const hill2 = Math.max(0, 1 - Math.sqrt(Math.pow((x - s * hill2X) / (s * 0.35), 2) + Math.pow((y - s * 0.45) / (s * 0.4), 2)));
                const height = Math.max(hill1, hill2 * 0.8);

                const noise = this.fractalNoise(x, y, 456 + seedOffset, 3);

                // Shade based on height and add rock
                const shade = height * 60 + (noise - 0.5) * 30;
                const isRock = height > 0.5 && noise > 0.6;

                if (isRock) {
                    data[idx] = Math.max(0, Math.min(255, 120 + shade * 0.5));
                    data[idx + 1] = Math.max(0, Math.min(255, 110 + shade * 0.5));
                    data[idx + 2] = Math.max(0, Math.min(255, 100 + shade * 0.5));
                } else {
                    data[idx] = Math.max(0, Math.min(255, 106 + shade * 0.4));
                    data[idx + 1] = Math.max(0, Math.min(255, baseGreen + shade));
                    data[idx + 2] = Math.max(0, Math.min(255, 80 + shade * 0.3));
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Mountains with snow caps
    drawMountainsTile(ctx, s, varSeed = 0) {
        // Dark rock base
        ctx.fillStyle = '#505050';
        ctx.fillRect(0, 0, s, s);

        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        // Mountain peak positions with variation
        const peaks = [
            { x: 0.5 + (varSeed % 2) * 0.1 - 0.05, y: 0.15, height: 1.0 },
            { x: 0.2 + (varSeed % 3) * 0.05, y: 0.4, height: 0.6 + varSeed * 0.05 },
            { x: 0.8 - (varSeed % 2) * 0.1, y: 0.35, height: 0.7 }
        ];

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;

                let maxHeight = 0;
                let inMountain = false;

                for (const peak of peaks) {
                    const px = peak.x * s;
                    const py = peak.y * s;
                    const slope = 1.5;

                    // Calculate if point is on mountain slope
                    const distX = Math.abs(x - px);
                    const distY = y - py;

                    if (distY > 0) {
                        const mountainWidth = distY / slope;
                        if (distX < mountainWidth) {
                            const h = peak.height * (1 - distX / mountainWidth) * (1 - distY / (s * 0.8));
                            if (h > maxHeight) {
                                maxHeight = h;
                                inMountain = true;
                            }
                        }
                    }
                }

                const noise = this.fractalNoise(x, y, 567 + seedOffset, 3);

                if (inMountain) {
                    // Mountain shading
                    const lightSide = x < s * 0.5;
                    const baseGray = lightSide ? 130 : 90;
                    const shade = baseGray + maxHeight * 60 + (noise - 0.5) * 30;

                    // Snow above certain height (varies with seed)
                    const snowLine = 0.65 + varSeed * 0.03 + noise * 0.1;
                    if (maxHeight > snowLine) {
                        data[idx] = Math.min(255, 230 + (noise - 0.5) * 30);
                        data[idx + 1] = Math.min(255, 235 + (noise - 0.5) * 25);
                        data[idx + 2] = Math.min(255, 240 + (noise - 0.5) * 20);
                    } else {
                        data[idx] = Math.max(0, Math.min(255, shade));
                        data[idx + 1] = Math.max(0, Math.min(255, shade));
                        data[idx + 2] = Math.max(0, Math.min(255, shade + 5));
                    }
                } else {
                    // Base rock
                    const rockShade = 80 + (noise - 0.5) * 30;
                    data[idx] = Math.max(0, Math.min(255, rockShade));
                    data[idx + 1] = Math.max(0, Math.min(255, rockShade));
                    data[idx + 2] = Math.max(0, Math.min(255, rockShade + 5));
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // Forest with trees
    drawForestTile(ctx, s, varSeed = 0) {
        // Dark green ground with variation
        const baseGreen = 90 + varSeed * 5;
        ctx.fillStyle = `rgb(42, ${baseGreen}, 42)`;
        ctx.fillRect(0, 0, s, s);

        // Add ground texture
        const imageData = ctx.getImageData(0, 0, s, s);
        const data = imageData.data;
        const seedOffset = varSeed * 1000;

        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const idx = (y * s + x) * 4;
                const noise = this.fractalNoise(x, y, 678 + seedOffset, 3);
                const variation = (noise - 0.5) * 25;

                data[idx] = Math.max(0, Math.min(255, 42 + variation * 0.5));
                data[idx + 1] = Math.max(0, Math.min(255, baseGreen + variation));
                data[idx + 2] = Math.max(0, Math.min(255, 42 + variation * 0.5));
            }
        }
        ctx.putImageData(imageData, 0, 0);

        // Draw trees with positions varying by seed
        const baseTrees = [
            { x: 0.2, y: 0.75 }, { x: 0.5, y: 0.65 }, { x: 0.8, y: 0.8 },
            { x: 0.35, y: 0.5 }, { x: 0.65, y: 0.55 }, { x: 0.15, y: 0.4 },
            { x: 0.85, y: 0.45 }, { x: 0.5, y: 0.35 }
        ];

        // Vary tree positions based on seed
        const treePositions = baseTrees.map((pos, i) => ({
            x: pos.x + (this.noise(i, varSeed, 111) - 0.5) * 0.15,
            y: pos.y + (this.noise(i, varSeed, 222) - 0.5) * 0.1
        }));

        // Sort by y for proper overlap
        treePositions.sort((a, b) => a.y - b.y);

        for (const pos of treePositions) {
            const treeSize = s * (0.15 + this.noise(pos.x * 10, pos.y * 10, 999 + seedOffset) * 0.1);
            this.drawTree(ctx, pos.x * s, pos.y * s, treeSize);
        }
    }

    // Draw a single tree
    drawTree(ctx, x, y, size) {
        // Trunk
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(x - size * 0.08, y, size * 0.16, size * 0.4);

        // Tree shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y + size * 0.35, size * 0.3, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Foliage layers (back to front, dark to light)
        const layers = [
            { y: -0.1, w: 0.5, h: 0.4, color: '#1a4a1a' },
            { y: -0.35, w: 0.45, h: 0.35, color: '#2a5a2a' },
            { y: -0.55, w: 0.35, h: 0.3, color: '#3a6a3a' },
            { y: -0.75, w: 0.25, h: 0.25, color: '#2a5a2a' }
        ];

        for (const layer of layers) {
            ctx.fillStyle = layer.color;
            ctx.beginPath();
            ctx.moveTo(x, y + size * (layer.y - layer.h));
            ctx.lineTo(x - size * layer.w, y + size * layer.y);
            ctx.lineTo(x + size * layer.w, y + size * layer.y);
            ctx.closePath();
            ctx.fill();
        }

        // Highlight
        ctx.fillStyle = 'rgba(100, 180, 100, 0.3)';
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size * 0.15, y - size * 0.5);
        ctx.lineTo(x, y - size * 0.6);
        ctx.closePath();
        ctx.fill();
    }

    // Get tile canvas for a terrain type with variation based on coordinates
    getTile(terrain, tileX = 0, tileY = 0) {
        const terrainTiles = this.tiles[terrain];
        if (!terrainTiles || terrainTiles.length === 0) return null;

        // Use coordinates to consistently select a variation
        const variationIndex = Math.abs((tileX * 7919 + tileY * 104729) % this.variationCount);
        return terrainTiles[variationIndex];
    }
}

// Global tile generator instance
let tileGenerator = null;
