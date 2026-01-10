// Game renderer
class Renderer {
    constructor(canvas, minimapCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.minimap = minimapCanvas;
        this.minimapCtx = minimapCanvas.getContext('2d');

        // Camera
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0
        };

        // Tile size
        this.tileSize = Config.TILE_SIZE;

        // Resize handler
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth || container.offsetWidth || 800;
        const containerHeight = container.clientHeight || container.offsetHeight || 600;

        // Only resize if we have valid dimensions
        if (containerWidth > 0 && containerHeight > 0) {
            this.canvas.width = containerWidth;
            this.canvas.height = containerHeight;
        }

        // Minimap size
        const minimapContainer = this.minimap.parentElement;
        const minimapWidth = (minimapContainer.clientWidth || minimapContainer.offsetWidth || 200) - 16;
        if (minimapWidth > 0) {
            this.minimap.width = minimapWidth;
            this.minimap.height = 130;
        }
    }

    // Main render loop
    render() {
        this.clear();

        if (!gameState.map) {
            // Draw "waiting for game" message
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Waiting for game data...', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        this.renderMap();
        this.renderCities();
        this.renderUnits();
        this.renderSelection();
        this.renderHoverTooltip();
        this.renderMinimap();
    }

    clear() {
        this.ctx.fillStyle = '#0a0a14';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(x, y) {
        const screenX = (x * this.tileSize - this.camera.x) * this.camera.zoom;
        const screenY = (y * this.tileSize - this.camera.y) * this.camera.zoom;
        return { x: screenX, y: screenY };
    }

    // Convert screen coordinates to world tile coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX / this.camera.zoom + this.camera.x) / this.tileSize;
        const worldY = (screenY / this.camera.zoom + this.camera.y) / this.tileSize;
        return { x: Math.floor(worldX), y: Math.floor(worldY) };
    }

    // Get visible tile range
    getVisibleRange() {
        const startTile = this.screenToWorld(0, 0);
        const endTile = this.screenToWorld(this.canvas.width, this.canvas.height);

        return {
            startX: Math.max(0, startTile.x - 1),
            startY: Math.max(0, startTile.y - 1),
            endX: Math.min(gameState.map.width, endTile.x + 2),
            endY: Math.min(gameState.map.height, endTile.y + 2)
        };
    }

    // Render map tiles
    renderMap() {
        const range = this.getVisibleRange();
        const scaledTileSize = this.tileSize * this.camera.zoom;

        // First pass: draw all terrain
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                const screen = this.worldToScreen(x, y);
                const s = scaledTileSize;

                // Use tile coordinates for consistent pseudo-random variation
                const seed = (x * 7919 + y * 104729) % 1000;
                const variation = seed / 1000;

                // Draw terrain based on type
                this.drawTerrain(tile.terrain, screen.x, screen.y, s, variation, x, y);
            }
        }

        // Second pass: draw edge blending between different terrains
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                const screen = this.worldToScreen(x, y);
                const s = scaledTileSize;

                this.drawTerrainEdgeBlend(tile, x, y, screen.x, screen.y, s);
            }
        }

        // Third pass: draw grid and improvements
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                const screen = this.worldToScreen(x, y);
                const s = scaledTileSize;

                // Draw grid lines (subtle)
                this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(screen.x, screen.y, s, s);

                // Draw improvements
                if (tile.has_road) {
                    this.drawRoad(screen.x, screen.y, s, x, y);
                }
            }
        }

        // Fourth pass: draw coastal decorations (beaches, rocks, shells, etc.)
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                // Only draw on land tiles adjacent to ocean
                if (tile.terrain === 'Ocean') continue;

                const screen = this.worldToScreen(x, y);
                const s = scaledTileSize;
                const seed = (x * 7919 + y * 104729) % 1000;
                const variation = seed / 1000;

                this.drawCoastalDecorations(tile, x, y, screen.x, screen.y, s, variation);
            }
        }

        // Fifth pass: draw terrain transition decorations (where 2+ terrain types meet)
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                // Skip ocean tiles
                if (tile.terrain === 'Ocean') continue;

                const screen = this.worldToScreen(x, y);
                const s = scaledTileSize;
                const seed = (x * 7919 + y * 104729) % 1000;
                const variation = seed / 1000;

                this.drawTerrainTransitionDecorations(tile, x, y, screen.x, screen.y, s, variation);
            }
        }

        // Sixth pass: draw resources (on top of beaches and transition decorations)
        for (let y = range.startY; y < range.endY; y++) {
            for (let x = range.startX; x < range.endX; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                if (tile.resource && tile.resource !== '') {
                    const screen = this.worldToScreen(x, y);
                    const s = scaledTileSize;
                    this.drawResource(tile.resource, screen.x, screen.y, s);
                }
            }
        }

        // Seventh pass: draw rivers as smooth paths
        this.renderRivers();
    }

    // Draw coastal decorations on land tiles adjacent to ocean
    drawCoastalDecorations(tile, tileX, tileY, screenX, screenY, size, variation) {
        const ctx = this.ctx;

        // Check which edges are adjacent to ocean
        const directions = [
            { dx: 0, dy: -1, edge: 'top' },
            { dx: 0, dy: 1, edge: 'bottom' },
            { dx: -1, dy: 0, edge: 'left' },
            { dx: 1, dy: 0, edge: 'right' }
        ];

        const oceanEdges = [];
        for (const dir of directions) {
            const neighbor = gameState.getTile(tileX + dir.dx, tileY + dir.dy);
            if (neighbor && neighbor.terrain === 'Ocean') {
                oceanEdges.push(dir.edge);
            }
        }

        // Check diagonal neighbors for corner beaches
        const diagonals = [
            { dx: -1, dy: -1, corner: 'topLeft' },
            { dx: 1, dy: -1, corner: 'topRight' },
            { dx: -1, dy: 1, corner: 'bottomLeft' },
            { dx: 1, dy: 1, corner: 'bottomRight' }
        ];

        const oceanDiagonals = [];
        for (const diag of diagonals) {
            const neighbor = gameState.getTile(tileX + diag.dx, tileY + diag.dy);
            if (neighbor && neighbor.terrain === 'Ocean') {
                oceanDiagonals.push(diag.corner);
            }
        }

        // Return early only if no ocean neighbors at all (cardinal or diagonal)
        if (oceanEdges.length === 0 && oceanDiagonals.length === 0) return;

        // Seeded random for consistent placement
        const seededRandom = (offset) => {
            const x = Math.sin((tileX * 127.1 + tileY * 311.7 + offset) * 43758.5453);
            return x - Math.floor(x);
        };

        const baseSize = size / 16;

        // First, draw sandy beach areas along ocean edges
        for (const edge of oceanEdges) {
            this.drawSandyBeach(ctx, screenX, screenY, size, edge, seededRandom, tileX, tileY);
        }

        // Draw corner beaches where two edges meet or diagonal has ocean
        const corners = [
            { edges: ['top', 'left'], corner: 'topLeft' },
            { edges: ['top', 'right'], corner: 'topRight' },
            { edges: ['bottom', 'left'], corner: 'bottomLeft' },
            { edges: ['bottom', 'right'], corner: 'bottomRight' }
        ];

        for (const c of corners) {
            // Check if both edges of this corner have ocean OR if the diagonal has ocean
            const hasEdge1 = oceanEdges.includes(c.edges[0]);
            const hasEdge2 = oceanEdges.includes(c.edges[1]);
            const hasDiagonalOcean = oceanDiagonals.includes(c.corner);

            // Draw corner sand if: both edges have ocean, OR diagonal is ocean
            if ((hasEdge1 && hasEdge2) || hasDiagonalOcean) {
                this.drawSandyBeachCorner(ctx, screenX, screenY, size, c.corner, seededRandom, tileX, tileY);
            }
        }

        // Draw decorations along each ocean edge
        for (const edge of oceanEdges) {
            // Number of decoration clusters per edge
            const numClusters = 2 + Math.floor(seededRandom(edge.charCodeAt(0)) * 3);

            for (let c = 0; c < numClusters; c++) {
                const progress = (c + 0.5) / numClusters;
                const offsetRand = seededRandom(c * 100 + edge.charCodeAt(0));

                let decorX, decorY;
                const edgeOffset = size * 0.1 + seededRandom(c * 10) * size * 0.15;

                switch (edge) {
                    case 'top':
                        decorX = screenX + progress * size + (offsetRand - 0.5) * size * 0.3;
                        decorY = screenY + edgeOffset;
                        break;
                    case 'bottom':
                        decorX = screenX + progress * size + (offsetRand - 0.5) * size * 0.3;
                        decorY = screenY + size - edgeOffset;
                        break;
                    case 'left':
                        decorX = screenX + edgeOffset;
                        decorY = screenY + progress * size + (offsetRand - 0.5) * size * 0.3;
                        break;
                    case 'right':
                        decorX = screenX + size - edgeOffset;
                        decorY = screenY + progress * size + (offsetRand - 0.5) * size * 0.3;
                        break;
                }

                // Choose decoration type
                const decorType = seededRandom(c * 50 + edge.charCodeAt(0) * 7);

                if (decorType < 0.35) {
                    // Coastal rocks
                    this.drawCoastalRocks(ctx, decorX, decorY, baseSize, seededRandom, c, edge);
                } else if (decorType < 0.55) {
                    // Shells and pebbles
                    this.drawCoastalShells(ctx, decorX, decorY, baseSize, seededRandom, c, edge);
                } else if (decorType < 0.7) {
                    // Driftwood
                    this.drawCoastalDriftwood(ctx, decorX, decorY, baseSize, seededRandom, c, edge);
                } else if (decorType < 0.85) {
                    // Seaweed
                    this.drawSeaweed(ctx, decorX, decorY, baseSize, seededRandom, c, edge);
                } else {
                    // Foam/water marks
                    this.drawFoamMarks(ctx, decorX, decorY, baseSize, seededRandom, c, edge);
                }
            }
        }
    }

    // Draw coastal rocks
    drawCoastalRocks(ctx, x, y, baseSize, seededRandom, index, edge) {
        const numRocks = 2 + Math.floor(seededRandom(index * 200) * 4);

        for (let r = 0; r < numRocks; r++) {
            const rx = x + (seededRandom(index * 210 + r) - 0.5) * baseSize * 3;
            const ry = y + (seededRandom(index * 220 + r) - 0.5) * baseSize * 2;
            const rockSize = baseSize * (0.4 + seededRandom(index * 230 + r) * 0.6);

            // Shadow
            ctx.beginPath();
            ctx.ellipse(rx + rockSize * 0.15, ry + rockSize * 0.1, rockSize, rockSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fill();

            // Rock body
            ctx.beginPath();
            ctx.ellipse(rx, ry, rockSize, rockSize * (0.6 + seededRandom(index * 240 + r) * 0.3),
                       seededRandom(index * 250 + r) * Math.PI * 0.5, 0, Math.PI * 2);

            // Gray/dark rock colors
            const grayBase = 70 + Math.floor(seededRandom(index * 260 + r) * 50);
            ctx.fillStyle = `rgb(${grayBase + 10}, ${grayBase + 5}, ${grayBase})`;
            ctx.fill();

            // Wet highlight
            ctx.beginPath();
            ctx.ellipse(rx - rockSize * 0.2, ry - rockSize * 0.2, rockSize * 0.35, rockSize * 0.25, -0.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
        }
    }

    // Draw coastal shells and pebbles
    drawCoastalShells(ctx, x, y, baseSize, seededRandom, index, edge) {
        const numItems = 4 + Math.floor(seededRandom(index * 300) * 5);

        for (let s = 0; s < numItems; s++) {
            const sx = x + (seededRandom(index * 310 + s) - 0.5) * baseSize * 3;
            const sy = y + (seededRandom(index * 320 + s) - 0.5) * baseSize * 2;

            if (seededRandom(index * 330 + s) > 0.5) {
                // Shell
                const shellSize = baseSize * (0.15 + seededRandom(index * 340 + s) * 0.15);
                const shellAngle = seededRandom(index * 350 + s) * Math.PI * 2;

                ctx.save();
                ctx.translate(sx, sy);
                ctx.rotate(shellAngle);

                const shellColor = seededRandom(index * 360 + s);
                if (shellColor < 0.4) {
                    ctx.fillStyle = '#fff8f0';
                } else if (shellColor < 0.7) {
                    ctx.fillStyle = '#ffe0d0';
                } else {
                    ctx.fillStyle = '#e8e0d0';
                }

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, shellSize, -Math.PI * 0.4, Math.PI * 0.4);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            } else {
                // Pebble
                const pebbleSize = baseSize * (0.08 + seededRandom(index * 370 + s) * 0.12);
                ctx.beginPath();
                ctx.ellipse(sx, sy, pebbleSize, pebbleSize * 0.7, seededRandom(index * 380 + s) * Math.PI, 0, Math.PI * 2);
                const gray = 140 + Math.floor(seededRandom(index * 390 + s) * 80);
                ctx.fillStyle = `rgb(${gray}, ${gray - 5}, ${gray - 10})`;
                ctx.fill();
            }
        }
    }

    // Draw coastal driftwood
    drawCoastalDriftwood(ctx, x, y, baseSize, seededRandom, index, edge) {
        const length = baseSize * (1.5 + seededRandom(index * 400) * 2.5);
        const thickness = baseSize * (0.2 + seededRandom(index * 410) * 0.2);
        const angle = seededRandom(index * 420) * Math.PI;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(-length / 2 + 2, 2, length, thickness);

        // Wood - weathered gray/tan
        const woodGray = 150 + Math.floor(seededRandom(index * 430) * 40);
        ctx.fillStyle = `rgb(${woodGray}, ${woodGray - 10}, ${woodGray - 25})`;
        ctx.fillRect(-length / 2, -thickness / 2, length, thickness);

        // Grain
        ctx.strokeStyle = `rgb(${woodGray - 30}, ${woodGray - 40}, ${woodGray - 50})`;
        ctx.lineWidth = 0.5;
        for (let g = 0; g < 2; g++) {
            ctx.beginPath();
            ctx.moveTo(-length / 2, -thickness / 4 + g * thickness / 2);
            ctx.lineTo(length / 2, -thickness / 4 + g * thickness / 2 + (seededRandom(index * 440 + g) - 0.5) * thickness * 0.3);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Draw seaweed
    drawSeaweed(ctx, x, y, baseSize, seededRandom, index, edge) {
        const numStrands = 2 + Math.floor(seededRandom(index * 500) * 3);

        for (let s = 0; s < numStrands; s++) {
            const sx = x + (seededRandom(index * 510 + s) - 0.5) * baseSize * 2;
            const strandLength = baseSize * (0.8 + seededRandom(index * 520 + s) * 1);

            ctx.strokeStyle = seededRandom(index * 530 + s) > 0.5 ? '#2d5a1d' : '#3d6b2d';
            ctx.lineWidth = baseSize * 0.1;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(sx, y);
            const curve1X = sx + (seededRandom(index * 540 + s) - 0.5) * baseSize;
            const curve1Y = y - strandLength * 0.5;
            const endX = sx + (seededRandom(index * 550 + s) - 0.5) * baseSize * 0.5;
            const endY = y - strandLength;
            ctx.quadraticCurveTo(curve1X, curve1Y, endX, endY);
            ctx.stroke();

            // Bulbs on seaweed
            if (seededRandom(index * 560 + s) > 0.5) {
                ctx.beginPath();
                ctx.arc(endX, endY, baseSize * 0.08, 0, Math.PI * 2);
                ctx.fillStyle = '#4a7a3a';
                ctx.fill();
            }
        }
    }

    // Draw foam marks on sand
    drawFoamMarks(ctx, x, y, baseSize, seededRandom, index, edge) {
        const foamWidth = baseSize * (2 + seededRandom(index * 600) * 2);
        const foamHeight = baseSize * (0.3 + seededRandom(index * 610) * 0.3);

        // Foam line
        ctx.beginPath();
        ctx.ellipse(x, y, foamWidth, foamHeight, seededRandom(index * 620) * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        // Bubbles
        const numBubbles = 3 + Math.floor(seededRandom(index * 630) * 4);
        for (let b = 0; b < numBubbles; b++) {
            const bx = x + (seededRandom(index * 640 + b) - 0.5) * foamWidth * 1.5;
            const by = y + (seededRandom(index * 650 + b) - 0.5) * foamHeight * 2;
            const bubbleSize = baseSize * (0.03 + seededRandom(index * 660 + b) * 0.05);

            ctx.beginPath();
            ctx.arc(bx, by, bubbleSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fill();
        }
    }

    // Draw sandy beach area along an ocean edge
    drawSandyBeach(ctx, screenX, screenY, size, edge, seededRandom, tileX, tileY) {
        const beachDepth = size * (0.25 + seededRandom(edge.charCodeAt(0) * 10) * 0.15);

        // Sand colors - warm beach tones
        const sandColors = [
            '#f4e4c1', // Light sand
            '#e8d5a8', // Medium sand
            '#dcc898', // Warm sand
            '#d4bc7f', // Golden sand
            '#c8af72', // Darker sand
        ];

        // Base sand gradient
        ctx.save();

        // Define the beach strip area based on edge
        let x1, y1, x2, y2, gradX1, gradY1, gradX2, gradY2;
        switch (edge) {
            case 'top':
                x1 = screenX; y1 = screenY;
                x2 = screenX + size; y2 = screenY + beachDepth;
                gradX1 = screenX; gradY1 = screenY;
                gradX2 = screenX; gradY2 = screenY + beachDepth;
                break;
            case 'bottom':
                x1 = screenX; y1 = screenY + size - beachDepth;
                x2 = screenX + size; y2 = screenY + size;
                gradX1 = screenX; gradY1 = screenY + size;
                gradX2 = screenX; gradY2 = screenY + size - beachDepth;
                break;
            case 'left':
                x1 = screenX; y1 = screenY;
                x2 = screenX + beachDepth; y2 = screenY + size;
                gradX1 = screenX; gradY1 = screenY;
                gradX2 = screenX + beachDepth; gradY2 = screenY;
                break;
            case 'right':
                x1 = screenX + size - beachDepth; y1 = screenY;
                x2 = screenX + size; y2 = screenY + size;
                gradX1 = screenX + size; gradY1 = screenY;
                gradX2 = screenX + size - beachDepth; gradY2 = screenY;
                break;
        }

        // Draw main sand strip with gradient (wet to dry)
        const sandGradient = ctx.createLinearGradient(gradX1, gradY1, gradX2, gradY2);
        sandGradient.addColorStop(0, '#c8af72');   // Wet sand near water
        sandGradient.addColorStop(0.3, '#d4bc7f'); // Damp sand
        sandGradient.addColorStop(0.7, '#e8d5a8'); // Dry sand
        sandGradient.addColorStop(1, 'rgba(244, 228, 193, 0.4)'); // Fade into terrain

        ctx.fillStyle = sandGradient;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

        // Add irregular sand patches that extend beyond the base strip
        const numPatches = 3 + Math.floor(seededRandom(edge.charCodeAt(0) * 20) * 4);
        for (let p = 0; p < numPatches; p++) {
            const patchProgress = (p + 0.5) / numPatches;
            const patchSize = size * (0.08 + seededRandom(p * 100 + edge.charCodeAt(0)) * 0.12);
            const extraDepth = beachDepth * (0.3 + seededRandom(p * 110 + edge.charCodeAt(0)) * 0.5);

            let patchX, patchY;
            switch (edge) {
                case 'top':
                    patchX = screenX + patchProgress * size + (seededRandom(p * 120) - 0.5) * size * 0.2;
                    patchY = screenY + beachDepth + extraDepth * 0.5;
                    break;
                case 'bottom':
                    patchX = screenX + patchProgress * size + (seededRandom(p * 120) - 0.5) * size * 0.2;
                    patchY = screenY + size - beachDepth - extraDepth * 0.5;
                    break;
                case 'left':
                    patchX = screenX + beachDepth + extraDepth * 0.5;
                    patchY = screenY + patchProgress * size + (seededRandom(p * 120) - 0.5) * size * 0.2;
                    break;
                case 'right':
                    patchX = screenX + size - beachDepth - extraDepth * 0.5;
                    patchY = screenY + patchProgress * size + (seededRandom(p * 120) - 0.5) * size * 0.2;
                    break;
            }

            // Draw irregular sand patch
            ctx.beginPath();
            const points = 6 + Math.floor(seededRandom(p * 130) * 4);
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const radius = patchSize * (0.7 + seededRandom(p * 140 + i) * 0.4);
                const px = patchX + Math.cos(angle) * radius;
                const py = patchY + Math.sin(angle) * radius * 0.6;
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();

            const colorIndex = Math.floor(seededRandom(p * 150) * sandColors.length);
            ctx.fillStyle = sandColors[colorIndex] + 'aa'; // Semi-transparent
            ctx.fill();
        }

        // Add sand grains/texture dots
        const numGrains = 8 + Math.floor(seededRandom(edge.charCodeAt(0) * 30) * 12);
        for (let g = 0; g < numGrains; g++) {
            let gx, gy;
            const grainInset = beachDepth * 0.8;
            switch (edge) {
                case 'top':
                    gx = screenX + seededRandom(g * 200) * size;
                    gy = screenY + seededRandom(g * 210) * grainInset;
                    break;
                case 'bottom':
                    gx = screenX + seededRandom(g * 200) * size;
                    gy = screenY + size - seededRandom(g * 210) * grainInset;
                    break;
                case 'left':
                    gx = screenX + seededRandom(g * 210) * grainInset;
                    gy = screenY + seededRandom(g * 200) * size;
                    break;
                case 'right':
                    gx = screenX + size - seededRandom(g * 210) * grainInset;
                    gy = screenY + seededRandom(g * 200) * size;
                    break;
            }

            const grainSize = size * (0.003 + seededRandom(g * 220) * 0.007);
            const grainColor = seededRandom(g * 230);

            ctx.beginPath();
            ctx.arc(gx, gy, grainSize, 0, Math.PI * 2);
            if (grainColor < 0.3) {
                ctx.fillStyle = '#ffffff88'; // Light grain
            } else if (grainColor < 0.6) {
                ctx.fillStyle = '#b8984088'; // Dark grain
            } else {
                ctx.fillStyle = '#d4bc7f88'; // Medium grain
            }
            ctx.fill();
        }

        // Add wet sand line at the water's edge
        ctx.beginPath();
        const waveVariation = size * 0.02;
        switch (edge) {
            case 'top':
                ctx.moveTo(screenX, screenY);
                for (let w = 0; w <= size; w += size / 8) {
                    const waveY = screenY + Math.sin(w * 0.1 + tileX) * waveVariation;
                    ctx.lineTo(screenX + w, waveY);
                }
                break;
            case 'bottom':
                ctx.moveTo(screenX, screenY + size);
                for (let w = 0; w <= size; w += size / 8) {
                    const waveY = screenY + size - Math.sin(w * 0.1 + tileX) * waveVariation;
                    ctx.lineTo(screenX + w, waveY);
                }
                break;
            case 'left':
                ctx.moveTo(screenX, screenY);
                for (let w = 0; w <= size; w += size / 8) {
                    const waveX = screenX + Math.sin(w * 0.1 + tileY) * waveVariation;
                    ctx.lineTo(waveX, screenY + w);
                }
                break;
            case 'right':
                ctx.moveTo(screenX + size, screenY);
                for (let w = 0; w <= size; w += size / 8) {
                    const waveX = screenX + size - Math.sin(w * 0.1 + tileY) * waveVariation;
                    ctx.lineTo(waveX, screenY + w);
                }
                break;
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = size * 0.02;
        ctx.stroke();

        // Add foam line slightly inward
        ctx.beginPath();
        const foamOffset = size * 0.05;
        switch (edge) {
            case 'top':
                ctx.moveTo(screenX, screenY + foamOffset);
                for (let w = 0; w <= size; w += size / 6) {
                    const waveY = screenY + foamOffset + Math.sin(w * 0.15 + tileX + 1) * waveVariation * 1.5;
                    ctx.lineTo(screenX + w, waveY);
                }
                break;
            case 'bottom':
                ctx.moveTo(screenX, screenY + size - foamOffset);
                for (let w = 0; w <= size; w += size / 6) {
                    const waveY = screenY + size - foamOffset - Math.sin(w * 0.15 + tileX + 1) * waveVariation * 1.5;
                    ctx.lineTo(screenX + w, waveY);
                }
                break;
            case 'left':
                ctx.moveTo(screenX + foamOffset, screenY);
                for (let w = 0; w <= size; w += size / 6) {
                    const waveX = screenX + foamOffset + Math.sin(w * 0.15 + tileY + 1) * waveVariation * 1.5;
                    ctx.lineTo(waveX, screenY + w);
                }
                break;
            case 'right':
                ctx.moveTo(screenX + size - foamOffset, screenY);
                for (let w = 0; w <= size; w += size / 6) {
                    const waveX = screenX + size - foamOffset - Math.sin(w * 0.15 + tileY + 1) * waveVariation * 1.5;
                    ctx.lineTo(waveX, screenY + w);
                }
                break;
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = size * 0.015;
        ctx.stroke();

        ctx.restore();
    }

    // Draw sandy beach corner where two edges meet
    drawSandyBeachCorner(ctx, screenX, screenY, size, corner, seededRandom, tileX, tileY) {
        const beachDepth = size * (0.25 + seededRandom(corner.charCodeAt(0) * 10) * 0.15);

        ctx.save();

        // Determine corner position
        let cornerX, cornerY;
        let angle1, angle2;
        switch (corner) {
            case 'topLeft':
                cornerX = screenX;
                cornerY = screenY;
                angle1 = 0;
                angle2 = Math.PI / 2;
                break;
            case 'topRight':
                cornerX = screenX + size;
                cornerY = screenY;
                angle1 = Math.PI / 2;
                angle2 = Math.PI;
                break;
            case 'bottomRight':
                cornerX = screenX + size;
                cornerY = screenY + size;
                angle1 = Math.PI;
                angle2 = Math.PI * 1.5;
                break;
            case 'bottomLeft':
                cornerX = screenX;
                cornerY = screenY + size;
                angle1 = Math.PI * 1.5;
                angle2 = Math.PI * 2;
                break;
        }

        // Draw corner arc fill with gradient
        const cornerRadius = beachDepth * 1.5;
        const gradient = ctx.createRadialGradient(
            cornerX, cornerY, 0,
            cornerX, cornerY, cornerRadius
        );
        gradient.addColorStop(0, '#c8af72');   // Wet sand near corner
        gradient.addColorStop(0.4, '#d4bc7f'); // Damp sand
        gradient.addColorStop(0.7, '#e8d5a8'); // Dry sand
        gradient.addColorStop(1, 'rgba(244, 228, 193, 0)'); // Fade out

        ctx.beginPath();
        ctx.moveTo(cornerX, cornerY);
        ctx.arc(cornerX, cornerY, cornerRadius, angle1, angle2);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add irregular sand patches in corner
        const numPatches = 2 + Math.floor(seededRandom(corner.charCodeAt(0) * 20) * 3);
        for (let p = 0; p < numPatches; p++) {
            const patchAngle = angle1 + (angle2 - angle1) * (0.2 + seededRandom(p * 100 + corner.charCodeAt(0)) * 0.6);
            const patchDist = cornerRadius * (0.4 + seededRandom(p * 110 + corner.charCodeAt(0)) * 0.5);
            const patchX = cornerX + Math.cos(patchAngle) * patchDist;
            const patchY = cornerY + Math.sin(patchAngle) * patchDist;
            const patchSize = size * (0.05 + seededRandom(p * 120 + corner.charCodeAt(0)) * 0.08);

            ctx.beginPath();
            const points = 5 + Math.floor(seededRandom(p * 130) * 3);
            for (let i = 0; i <= points; i++) {
                const a = (i / points) * Math.PI * 2;
                const radius = patchSize * (0.7 + seededRandom(p * 140 + i) * 0.4);
                const px = patchX + Math.cos(a) * radius;
                const py = patchY + Math.sin(a) * radius * 0.7;
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();

            const sandColors = ['#f4e4c1', '#e8d5a8', '#dcc898', '#d4bc7f'];
            const colorIndex = Math.floor(seededRandom(p * 150) * sandColors.length);
            ctx.fillStyle = sandColors[colorIndex] + '99';
            ctx.fill();
        }

        // Add sand grains in corner
        const numGrains = 4 + Math.floor(seededRandom(corner.charCodeAt(0) * 30) * 6);
        for (let g = 0; g < numGrains; g++) {
            const grainAngle = angle1 + (angle2 - angle1) * seededRandom(g * 200);
            const grainDist = cornerRadius * 0.3 * seededRandom(g * 210);
            const gx = cornerX + Math.cos(grainAngle) * grainDist;
            const gy = cornerY + Math.sin(grainAngle) * grainDist;
            const grainSize = size * (0.003 + seededRandom(g * 220) * 0.006);

            ctx.beginPath();
            ctx.arc(gx, gy, grainSize, 0, Math.PI * 2);
            const grainColor = seededRandom(g * 230);
            if (grainColor < 0.3) {
                ctx.fillStyle = '#ffffff88';
            } else if (grainColor < 0.6) {
                ctx.fillStyle = '#b8984088';
            } else {
                ctx.fillStyle = '#d4bc7f88';
            }
            ctx.fill();
        }

        // Draw curved foam line at corner edge
        ctx.beginPath();
        ctx.arc(cornerX, cornerY, beachDepth * 0.15, angle1, angle2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = size * 0.02;
        ctx.stroke();

        // Second foam arc
        ctx.beginPath();
        ctx.arc(cornerX, cornerY, beachDepth * 0.35, angle1, angle2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = size * 0.015;
        ctx.stroke();

        ctx.restore();
    }

    // Draw decorations where multiple terrain types meet (sand, rocks, stones)
    drawTerrainTransitionDecorations(tile, tileX, tileY, screenX, screenY, size, variation) {
        const ctx = this.ctx;
        const currentTerrain = tile.terrain;

        // Check all 8 neighbors and collect different terrain types with their positions
        const directions = [
            { dx: 0, dy: -1, edge: 'top' },
            { dx: 0, dy: 1, edge: 'bottom' },
            { dx: -1, dy: 0, edge: 'left' },
            { dx: 1, dy: 0, edge: 'right' },
            { dx: -1, dy: -1, corner: 'topLeft' },
            { dx: 1, dy: -1, corner: 'topRight' },
            { dx: -1, dy: 1, corner: 'bottomLeft' },
            { dx: 1, dy: 1, corner: 'bottomRight' }
        ];

        const transitionEdges = [];

        for (const dir of directions) {
            const neighbor = gameState.getTile(tileX + dir.dx, tileY + dir.dy);
            if (!neighbor) continue;
            if (neighbor.terrain === 'Ocean') continue; // Skip ocean, handled separately
            if (neighbor.terrain !== currentTerrain) {
                if (dir.edge) {
                    transitionEdges.push({ edge: dir.edge, terrain: neighbor.terrain });
                }
            }
        }

        // Draw if any neighbor has a different terrain type
        if (transitionEdges.length === 0) return;

        // Seeded random for consistent placement
        const seededRandom = (offset) => {
            const x = Math.sin((tileX * 127.1 + tileY * 311.7 + offset) * 43758.5453);
            return x - Math.floor(x);
        };

        const baseSize = size / 16;

        // Draw transition sand/gravel along edges where different terrains meet
        for (const trans of transitionEdges) {
            this.drawTransitionSand(ctx, screenX, screenY, size, trans.edge, seededRandom, tileX, tileY, trans.terrain);
        }

        // Draw rocks and stones at the center where terrains converge
        this.drawTransitionRocks(ctx, screenX, screenY, size, seededRandom, transitionEdges.length);
    }

    // Draw irregular sand/gravel patches along terrain transition edge
    drawTransitionSand(ctx, screenX, screenY, size, edge, seededRandom, tileX, tileY, adjacentTerrain) {
        ctx.save();

        // Choose colors based on adjacent terrain type
        let patchColors;
        let colorType;

        switch (adjacentTerrain) {
            case 'Mountains':
                colorType = 'snow';
                patchColors = [
                    '#ffffff', // Pure white
                    '#f8f8ff', // Ghost white
                    '#f0f5ff', // Light blue-white
                    '#e8eef8', // Pale ice
                    '#f5f9ff', // Snow white
                ];
                break;
            case 'Forest':
                colorType = 'grass';
                patchColors = [
                    '#4a7a3a', // Dark forest green
                    '#5a8a4a', // Medium green
                    '#3d6b2d', // Deep green
                    '#6a9a5a', // Light forest green
                    '#4d7d3d', // Moss green
                ];
                break;
            case 'Grassland':
                colorType = 'grass';
                patchColors = [
                    '#7cb868', // Light grass green
                    '#8cc878', // Bright green
                    '#6aa858', // Medium green
                    '#9ad888', // Pale green
                    '#7ac060', // Fresh green
                ];
                break;
            case 'Hills':
                colorType = 'earth';
                patchColors = [
                    '#a89070', // Brown earth
                    '#b8a080', // Light brown
                    '#988060', // Medium brown
                    '#c8b090', // Tan
                    '#a08868', // Warm brown
                ];
                break;
            case 'Desert':
                colorType = 'sand';
                patchColors = [
                    '#e8d8a8', // Light sand
                    '#d8c898', // Medium sand
                    '#f0e0b0', // Pale sand
                    '#c8b888', // Darker sand
                    '#e0d0a0', // Warm sand
                ];
                break;
            case 'Plains':
            default:
                colorType = 'grass';
                patchColors = [
                    '#b8c878', // Yellow-green
                    '#a8b868', // Olive green
                    '#c8d888', // Pale yellow-green
                    '#98a858', // Medium olive
                    '#c0d080', // Light olive
                ];
                break;
        }

        // Draw irregular sand patches along the edge
        const numPatches = 4 + Math.floor(seededRandom(edge.charCodeAt(0) * 5) * 4);

        for (let p = 0; p < numPatches; p++) {
            const progress = (p + seededRandom(p * 50)) / numPatches;
            const patchDepth = size * (0.08 + seededRandom(p * 60 + edge.charCodeAt(0)) * 0.15);
            const patchWidth = size * (0.1 + seededRandom(p * 70 + edge.charCodeAt(0)) * 0.15);

            let patchX, patchY;
            switch (edge) {
                case 'top':
                    patchX = screenX + progress * size;
                    patchY = screenY + patchDepth * 0.5;
                    break;
                case 'bottom':
                    patchX = screenX + progress * size;
                    patchY = screenY + size - patchDepth * 0.5;
                    break;
                case 'left':
                    patchX = screenX + patchDepth * 0.5;
                    patchY = screenY + progress * size;
                    break;
                case 'right':
                    patchX = screenX + size - patchDepth * 0.5;
                    patchY = screenY + progress * size;
                    break;
            }

            // Draw irregular blob shape
            ctx.beginPath();
            const points = 6 + Math.floor(seededRandom(p * 80) * 4);
            for (let i = 0; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const radiusVar = 0.6 + seededRandom(p * 90 + i * 10) * 0.5;
                let rx, ry;
                if (edge === 'top' || edge === 'bottom') {
                    rx = patchWidth * radiusVar;
                    ry = patchDepth * radiusVar;
                } else {
                    rx = patchDepth * radiusVar;
                    ry = patchWidth * radiusVar;
                }
                const px = patchX + Math.cos(angle) * rx;
                const py = patchY + Math.sin(angle) * ry;
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();

            // Fill with terrain-appropriate color
            const colorIndex = Math.floor(seededRandom(p * 100) * patchColors.length);
            ctx.fillStyle = patchColors[colorIndex] + 'cc'; // Semi-transparent
            ctx.fill();
        }

        // Add scattered pebbles
        const numPebbles = 6 + Math.floor(seededRandom(edge.charCodeAt(0) * 20) * 8);
        for (let p = 0; p < numPebbles; p++) {
            let px, py;
            const edgeDepth = size * 0.2;
            switch (edge) {
                case 'top':
                    px = screenX + seededRandom(p * 300) * size;
                    py = screenY + seededRandom(p * 310) * edgeDepth;
                    break;
                case 'bottom':
                    px = screenX + seededRandom(p * 300) * size;
                    py = screenY + size - seededRandom(p * 310) * edgeDepth;
                    break;
                case 'left':
                    px = screenX + seededRandom(p * 310) * edgeDepth;
                    py = screenY + seededRandom(p * 300) * size;
                    break;
                case 'right':
                    px = screenX + size - seededRandom(p * 310) * edgeDepth;
                    py = screenY + seededRandom(p * 300) * size;
                    break;
            }

            const pebbleSize = size * (0.01 + seededRandom(p * 320) * 0.015);
            ctx.beginPath();
            ctx.ellipse(px, py, pebbleSize, pebbleSize * 0.7, seededRandom(p * 330) * Math.PI, 0, Math.PI * 2);

            // Color pebbles based on terrain type
            if (colorType === 'snow') {
                // Icy/gray pebbles for mountains
                const iceVal = 180 + Math.floor(seededRandom(p * 340) * 50);
                ctx.fillStyle = `rgb(${iceVal}, ${iceVal + 5}, ${iceVal + 10})`;
            } else if (colorType === 'grass') {
                // Green-tinted pebbles for grass areas
                const baseVal = 80 + Math.floor(seededRandom(p * 340) * 40);
                ctx.fillStyle = `rgb(${baseVal - 10}, ${baseVal + 20}, ${baseVal - 20})`;
            } else if (colorType === 'earth') {
                // Brown pebbles for hills
                const brownVal = 100 + Math.floor(seededRandom(p * 340) * 50);
                ctx.fillStyle = `rgb(${brownVal + 20}, ${brownVal}, ${brownVal - 20})`;
            } else {
                // Sandy pebbles for desert/default
                const sandVal = 150 + Math.floor(seededRandom(p * 340) * 50);
                ctx.fillStyle = `rgb(${sandVal + 10}, ${sandVal}, ${sandVal - 20})`;
            }
            ctx.fill();
        }

        ctx.restore();
    }

    // Draw rocks and stones at terrain transition convergence point
    drawTransitionRocks(ctx, screenX, screenY, size, seededRandom, numTerrains) {
        // More rocks when more terrains meet
        const numRocks = Math.min(2 + numTerrains, 5) + Math.floor(seededRandom(100) * 3);

        // Rock colors - gray tones
        const rockColors = [
            '#8a8a8a', // Medium gray
            '#7a7a7a', // Darker gray
            '#9a9a9a', // Lighter gray
            '#6a6a6a', // Dark gray
            '#a0a0a0', // Light gray
        ];

        for (let r = 0; r < numRocks; r++) {
            // Position rocks more towards center/edges where transitions meet
            const angle = seededRandom(r * 400) * Math.PI * 2;
            const dist = size * (0.15 + seededRandom(r * 410) * 0.25);
            const rx = screenX + size / 2 + Math.cos(angle) * dist;
            const ry = screenY + size / 2 + Math.sin(angle) * dist;

            const rockWidth = size * (0.04 + seededRandom(r * 420) * 0.06);
            const rockHeight = rockWidth * (0.5 + seededRandom(r * 430) * 0.4);
            const rockAngle = seededRandom(r * 440) * Math.PI;

            // Shadow
            ctx.beginPath();
            ctx.ellipse(rx + rockWidth * 0.1, ry + rockHeight * 0.15, rockWidth, rockHeight, rockAngle, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fill();

            // Rock body
            ctx.beginPath();
            ctx.ellipse(rx, ry, rockWidth, rockHeight, rockAngle, 0, Math.PI * 2);
            const colorIndex = Math.floor(seededRandom(r * 450) * rockColors.length);
            ctx.fillStyle = rockColors[colorIndex];
            ctx.fill();

            // Highlight
            ctx.beginPath();
            ctx.ellipse(rx - rockWidth * 0.2, ry - rockHeight * 0.2, rockWidth * 0.3, rockHeight * 0.25, rockAngle, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fill();
        }

        // Add small stones/pebbles scattered around
        const numStones = 5 + Math.floor(seededRandom(200) * 8);
        for (let s = 0; s < numStones; s++) {
            const sx = screenX + seededRandom(s * 500) * size;
            const sy = screenY + seededRandom(s * 510) * size;
            const stoneSize = size * (0.01 + seededRandom(s * 520) * 0.015);

            ctx.beginPath();
            ctx.arc(sx, sy, stoneSize, 0, Math.PI * 2);

            const stoneGray = 100 + Math.floor(seededRandom(s * 530) * 80);
            ctx.fillStyle = `rgb(${stoneGray}, ${stoneGray}, ${stoneGray})`;
            ctx.fill();
        }
    }

    // Render all rivers as smooth bezier paths with variable width
    renderRivers() {
        if (!gameState.map || !gameState.map.rivers || gameState.map.rivers.length === 0) {
            return;
        }

        const scaledTileSize = this.tileSize * this.camera.zoom;
        const ctx = this.ctx;

        for (const river of gameState.map.rivers) {
            if (!river.points || river.points.length < 2) continue;

            // Convert river points to screen coordinates
            const screenPoints = river.points.map(p => this.worldToScreen(p.x, p.y));

            // Draw river with variable width (thin at source, wide at mouth)
            this.drawVariableWidthRiver(screenPoints, scaledTileSize, river);

            // Draw delta if river has delta branches
            if (river.delta && river.delta.length > 0) {
                for (const branch of river.delta) {
                    const branchPoints = branch.map(p => this.worldToScreen(p.x, p.y));
                    this.drawDeltaBranch(branchPoints, scaledTileSize);
                }
            }
        }
    }

    // Draw a river with variable width - thin at start, wide at end
    // Uses filled polygons for smooth continuous appearance
    drawVariableWidthRiver(screenPoints, scaledTileSize, river) {
        if (screenPoints.length < 2) return;

        const ctx = this.ctx;
        const numPoints = screenPoints.length;

        // Calculate widths at each point
        const widths = [];
        const minWidth = scaledTileSize / 16;
        const maxWidth = scaledTileSize / 4;

        for (let i = 0; i < numPoints; i++) {
            const progress = i / (numPoints - 1);
            const easedProgress = progress * progress;
            widths.push(minWidth + (maxWidth - minWidth) * easedProgress);
        }

        // Calculate perpendicular offsets for left and right edges
        const leftEdge = [];
        const rightEdge = [];

        for (let i = 0; i < numPoints; i++) {
            const p = screenPoints[i];
            const width = widths[i];

            // Calculate direction (tangent)
            let dx, dy;
            if (i === 0) {
                dx = screenPoints[1].x - p.x;
                dy = screenPoints[1].y - p.y;
            } else if (i === numPoints - 1) {
                dx = p.x - screenPoints[i - 1].x;
                dy = p.y - screenPoints[i - 1].y;
            } else {
                dx = screenPoints[i + 1].x - screenPoints[i - 1].x;
                dy = screenPoints[i + 1].y - screenPoints[i - 1].y;
            }

            // Normalize and get perpendicular
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len;
            const perpY = dx / len;

            leftEdge.push({ x: p.x + perpX * width / 2, y: p.y + perpY * width / 2 });
            rightEdge.push({ x: p.x - perpX * width / 2, y: p.y - perpY * width / 2 });
        }

        // Helper to draw filled river shape with given width multiplier
        const drawRiverShape = (widthMult, fillStyle) => {
            ctx.beginPath();

            // Left edge (forward)
            ctx.moveTo(
                screenPoints[0].x + (leftEdge[0].x - screenPoints[0].x) * widthMult,
                screenPoints[0].y + (leftEdge[0].y - screenPoints[0].y) * widthMult
            );

            for (let i = 1; i < numPoints; i++) {
                const lx = screenPoints[i].x + (leftEdge[i].x - screenPoints[i].x) * widthMult;
                const ly = screenPoints[i].y + (leftEdge[i].y - screenPoints[i].y) * widthMult;
                ctx.lineTo(lx, ly);
            }

            // Right edge (backward)
            for (let i = numPoints - 1; i >= 0; i--) {
                const rx = screenPoints[i].x + (rightEdge[i].x - screenPoints[i].x) * widthMult;
                const ry = screenPoints[i].y + (rightEdge[i].y - screenPoints[i].y) * widthMult;
                ctx.lineTo(rx, ry);
            }

            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
        };

        // Draw layers from outside in
        drawRiverShape(2.5, 'rgba(60, 40, 20, 0.5)');      // Outer shadow (brown)
        drawRiverShape(1.8, 'rgba(80, 50, 25, 0.6)');     // Inner shadow (brown)
        drawRiverShape(1.3, '#6B4423');                    // Bank/outline (brown)
        drawRiverShape(1.0, '#4499dd');                    // Main water
        drawRiverShape(0.4, 'rgba(102, 187, 255, 0.7)');  // Highlight

        // Draw white foam/shadow at river source (spring effect)
        const startPoint = screenPoints[0];
        const startWidth = widths[0];
        const springSize = startWidth * 2.5;

        const springGradient = ctx.createRadialGradient(
            startPoint.x, startPoint.y, 0,
            startPoint.x, startPoint.y, springSize
        );
        springGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        springGradient.addColorStop(0.4, 'rgba(200, 230, 255, 0.3)');
        springGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, springSize, 0, Math.PI * 2);
        ctx.fillStyle = springGradient;
        ctx.fill();

        // Draw white foam/shadow at river end only if it touches ocean
        const endPoint = screenPoints[numPoints - 1];
        const endWidth = widths[numPoints - 1];

        // Get world coordinates of river end to check for ocean
        const lastRiverPoint = river.points[river.points.length - 1];
        const endTileX = Math.floor(lastRiverPoint.x);
        const endTileY = Math.floor(lastRiverPoint.y);

        // Check if river end directly touches ocean (cardinal directions only, no diagonals)
        let touchesOcean = false;
        const cardinalDirs = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
        for (const dir of cardinalDirs) {
            const tile = gameState.getTile(endTileX + dir.dx, endTileY + dir.dy);
            if (tile && tile.terrain === 'Ocean') {
                touchesOcean = true;
                break;
            }
        }
        // Also check the tile the river ends on
        const endTile = gameState.getTile(endTileX, endTileY);
        if (endTile && endTile.terrain === 'Ocean') {
            touchesOcean = true;
        }

        // Only draw foam if river touches ocean
        if (touchesOcean) {
            const foamSize = endWidth * 1.5;

            const gradient = ctx.createRadialGradient(
                endPoint.x, endPoint.y, 0,
                endPoint.x, endPoint.y, foamSize
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.beginPath();
            ctx.arc(endPoint.x, endPoint.y, foamSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw vegetation along river banks
        this.drawRiverVegetation(screenPoints, leftEdge, rightEdge, widths, scaledTileSize, river);
    }

    // Draw plants, reeds, and bushes along river banks
    drawRiverVegetation(screenPoints, leftEdge, rightEdge, widths, scaledTileSize, river) {
        const ctx = this.ctx;
        const numPoints = screenPoints.length;

        // Use river points to create a seed for consistent random placement
        const seed = river.points.length > 0 ?
            (river.points[0].x * 1000 + river.points[0].y) : 0;

        // Simple seeded random function
        const seededRandom = (i, offset = 0) => {
            const x = Math.sin(seed + i * 127.1 + offset * 311.7) * 43758.5453;
            return x - Math.floor(x);
        };

        // Draw vegetation at intervals along the river - very dense spacing
        const spacing = Math.max(1, Math.floor(numPoints / 60)); // Much more frequent

        for (let i = spacing; i < numPoints - spacing; i += spacing) {
            const rnd = seededRandom(i);

            // Almost never skip - very dense vegetation
            if (rnd < 0.05) continue;

            const width = widths[i];
            const baseSize = scaledTileSize / 16;

            // Always place on both sides
            const sides = ['left', 'right'];

            for (const side of sides) {
                const edge = side === 'left' ? leftEdge[i] : rightEdge[i];
                const center = screenPoints[i];

                // Draw multiple layers of vegetation at different distances from bank
                const numLayers = 2 + Math.floor(seededRandom(i, 800 + (side === 'left' ? 0 : 100)) * 2);

                for (let layer = 0; layer < numLayers; layer++) {
                    // Position at varying distances from the bank
                    const offsetMult = 1.3 + layer * 0.5 + seededRandom(i, 3 + layer * 10) * 0.4;
                    const lateralOffset = (seededRandom(i, 810 + layer) - 0.5) * baseSize * 2;
                    const plantX = center.x + (edge.x - center.x) * offsetMult + lateralOffset;
                    const plantY = center.y + (edge.y - center.y) * offsetMult;

                    // Choose plant type based on random value and layer
                    const plantType = seededRandom(i, 4 + layer * 20 + (side === 'left' ? 0 : 10));

                    // Inner layer (close to water) - more reeds, rocks, stones, flowers
                    // Outer layers - more trees, bushes, ferns
                    if (layer === 0) {
                        if (plantType < 0.25) {
                            this.drawReeds(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.4) {
                            this.drawRocks(ctx, plantX, plantY, baseSize * 0.8, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.55) {
                            this.drawStones(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.75) {
                            this.drawFlowers(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else {
                            this.drawGrassTuft(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        }
                    } else {
                        if (plantType < 0.18) {
                            this.drawBush(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.35) {
                            this.drawFerns(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.50) {
                            this.drawStones(ctx, plantX, plantY, baseSize * 0.8, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.68) {
                            this.drawGrassTuft(ctx, plantX, plantY, baseSize, seededRandom, i + layer * 100, side);
                        } else if (plantType < 0.85) {
                            this.drawFlowers(ctx, plantX, plantY, baseSize * 0.9, seededRandom, i + layer * 100, side);
                        } else {
                            this.drawRocks(ctx, plantX, plantY, baseSize * 0.7, seededRandom, i + layer * 100, side);
                        }
                    }
                }

                // Add extra scattered stones near the water
                if (seededRandom(i, 950 + (side === 'left' ? 0 : 50)) > 0.4) {
                    const stoneOffsetMult = 1.1 + seededRandom(i, 960) * 0.4;
                    const stoneLateral = (seededRandom(i, 970) - 0.5) * baseSize * 3;
                    const stoneX = center.x + (edge.x - center.x) * stoneOffsetMult + stoneLateral;
                    const stoneY = center.y + (edge.y - center.y) * stoneOffsetMult;
                    this.drawStones(ctx, stoneX, stoneY, baseSize * 0.6, seededRandom, i + 3000, side);
                }

                // Add rocks close to the river (larger boulders near water's edge)
                if (seededRandom(i, 980 + (side === 'left' ? 0 : 50)) > 0.5) {
                    const rockOffsetMult = 1.05 + seededRandom(i, 985) * 0.3;
                    const rockLateral = (seededRandom(i, 990) - 0.5) * baseSize * 2;
                    const rockX = center.x + (edge.x - center.x) * rockOffsetMult + rockLateral;
                    const rockY = center.y + (edge.y - center.y) * rockOffsetMult;
                    this.drawRocks(ctx, rockX, rockY, baseSize * (0.6 + seededRandom(i, 995) * 0.4), seededRandom, i + 4000, side);
                }

                // Sometimes add a second rock cluster slightly further from water
                if (seededRandom(i, 1000 + (side === 'left' ? 0 : 50)) > 0.7) {
                    const rockOffsetMult = 1.4 + seededRandom(i, 1005) * 0.5;
                    const rockLateral = (seededRandom(i, 1010) - 0.5) * baseSize * 3;
                    const rockX = center.x + (edge.x - center.x) * rockOffsetMult + rockLateral;
                    const rockY = center.y + (edge.y - center.y) * rockOffsetMult;
                    this.drawRocks(ctx, rockX, rockY, baseSize * (0.5 + seededRandom(i, 1015) * 0.5), seededRandom, i + 5000, side);
                }

                // Add extra scattered grass tufts
                const numExtraGrass = 1 + Math.floor(seededRandom(i, 900 + (side === 'left' ? 0 : 50)) * 3);
                for (let g = 0; g < numExtraGrass; g++) {
                    const grassOffsetMult = 1.2 + seededRandom(i, 910 + g) * 1.5;
                    const grassLateral = (seededRandom(i, 920 + g) - 0.5) * baseSize * 4;
                    const grassX = center.x + (edge.x - center.x) * grassOffsetMult + grassLateral;
                    const grassY = center.y + (edge.y - center.y) * grassOffsetMult;
                    this.drawGrassTuft(ctx, grassX, grassY, baseSize * (0.5 + seededRandom(i, 930 + g) * 0.5), seededRandom, i + 2000 + g, side);
                }
            }
        }

        // Draw more lily pads in the water
        this.drawLilyPads(ctx, screenPoints, widths, scaledTileSize, seededRandom, numPoints);
    }

    // Draw lily pads floating on the river
    drawLilyPads(ctx, screenPoints, widths, scaledTileSize, seededRandom, numPoints) {
        const spacing = Math.max(2, Math.floor(numPoints / 30)); // More frequent

        for (let i = spacing; i < numPoints - spacing; i += spacing) {
            // Only add lily pads where river is wide enough
            if (widths[i] < scaledTileSize / 12) continue;
            if (seededRandom(i, 300) < 0.3) continue; // More likely to spawn

            const center = screenPoints[i];
            const numPads = 2 + Math.floor(seededRandom(i, 310) * 4); // More pads per cluster

            for (let p = 0; p < numPads; p++) {
                const offsetX = (seededRandom(i, 320 + p) - 0.5) * widths[i] * 0.6;
                const offsetY = (seededRandom(i, 330 + p) - 0.5) * widths[i] * 0.4;
                const padX = center.x + offsetX;
                const padY = center.y + offsetY;
                const padSize = scaledTileSize / 30 * (0.8 + seededRandom(i, 340 + p) * 0.4);

                // Lily pad (circle with a slice cut out)
                ctx.save();
                ctx.translate(padX, padY);
                ctx.rotate(seededRandom(i, 350 + p) * Math.PI * 2);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, padSize, 0.2, Math.PI * 2 - 0.2);
                ctx.closePath();
                ctx.fillStyle = '#2d6b2d';
                ctx.fill();
                ctx.strokeStyle = '#1d4b1d';
                ctx.lineWidth = 0.5;
                ctx.stroke();

                // Sometimes add a flower on the lily pad
                if (seededRandom(i, 360 + p) > 0.7) {
                    ctx.beginPath();
                    ctx.arc(padSize * 0.3, 0, padSize * 0.25, 0, Math.PI * 2);
                    ctx.fillStyle = seededRandom(i, 370 + p) > 0.5 ? '#ffb7c5' : '#fff';
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(padSize * 0.3, 0, padSize * 0.1, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffeb3b';
                    ctx.fill();
                }

                ctx.restore();
            }
        }
    }

    // Draw a cluster of reeds/cattails
    drawReeds(ctx, x, y, baseSize, seededRandom, i, side) {
        const numReeds = 2 + Math.floor(seededRandom(i, 20) * 3);

        for (let r = 0; r < numReeds; r++) {
            const offsetX = (seededRandom(i, 30 + r) - 0.5) * baseSize * 2;
            const reedX = x + offsetX;
            const reedHeight = baseSize * (1.5 + seededRandom(i, 40 + r) * 1.5);

            // Reed stem
            ctx.beginPath();
            ctx.moveTo(reedX, y);
            ctx.lineTo(reedX - baseSize * 0.1, y - reedHeight);
            ctx.strokeStyle = '#4a6b35';
            ctx.lineWidth = Math.max(1, baseSize * 0.15);
            ctx.stroke();

            // Cattail top (brown oval)
            if (seededRandom(i, 50 + r) > 0.4) {
                ctx.beginPath();
                ctx.ellipse(reedX - baseSize * 0.1, y - reedHeight - baseSize * 0.3,
                           baseSize * 0.15, baseSize * 0.4, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#5c4033';
                ctx.fill();
            }
        }
    }

    // Draw a small bush
    drawBush(ctx, x, y, baseSize, seededRandom, i, side) {
        const bushSize = baseSize * (1 + seededRandom(i, 60) * 0.5);

        // Shadow
        ctx.beginPath();
        ctx.ellipse(x + bushSize * 0.1, y + bushSize * 0.1, bushSize, bushSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 40, 0, 0.3)';
        ctx.fill();

        // Main bush body (multiple overlapping circles)
        const colors = ['#2d5a1d', '#3d6b2d', '#4a7d3a', '#2a4f1a'];
        for (let c = 0; c < 3; c++) {
            const offX = (seededRandom(i, 70 + c) - 0.5) * bushSize * 0.5;
            const offY = (seededRandom(i, 80 + c) - 0.5) * bushSize * 0.3;
            ctx.beginPath();
            ctx.arc(x + offX, y - bushSize * 0.3 + offY, bushSize * (0.5 + seededRandom(i, 90 + c) * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = colors[c % colors.length];
            ctx.fill();
        }
    }

    // Draw a grass tuft
    drawGrassTuft(ctx, x, y, baseSize, seededRandom, i, side) {
        const numBlades = 4 + Math.floor(seededRandom(i, 100) * 4);

        ctx.strokeStyle = '#5a8a4a';
        ctx.lineWidth = Math.max(1, baseSize * 0.1);

        for (let b = 0; b < numBlades; b++) {
            const angle = (seededRandom(i, 110 + b) - 0.5) * 0.8;
            const height = baseSize * (0.8 + seededRandom(i, 120 + b) * 0.8);
            const curve = (seededRandom(i, 130 + b) - 0.5) * baseSize * 0.5;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(
                x + curve,
                y - height * 0.6,
                x + Math.sin(angle) * height * 0.3,
                y - height
            );
            ctx.stroke();
        }
    }

    // Draw a small tree near the river
    drawRiverTree(ctx, x, y, baseSize, seededRandom, i, side) {
        const treeHeight = baseSize * (2.5 + seededRandom(i, 400) * 1.5);
        const trunkWidth = baseSize * 0.3;
        const canopySize = baseSize * (1.2 + seededRandom(i, 410) * 0.6);

        // Shadow
        ctx.beginPath();
        ctx.ellipse(x + baseSize * 0.3, y + baseSize * 0.1, canopySize * 0.8, canopySize * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 30, 0, 0.25)';
        ctx.fill();

        // Trunk
        ctx.beginPath();
        ctx.moveTo(x - trunkWidth / 2, y);
        ctx.lineTo(x - trunkWidth / 3, y - treeHeight * 0.6);
        ctx.lineTo(x + trunkWidth / 3, y - treeHeight * 0.6);
        ctx.lineTo(x + trunkWidth / 2, y);
        ctx.closePath();
        ctx.fillStyle = '#5d4037';
        ctx.fill();

        // Canopy layers (multiple circles for natural look)
        const canopyColors = ['#1b5e20', '#2e7d32', '#388e3c', '#43a047'];
        const numLayers = 3 + Math.floor(seededRandom(i, 420) * 2);

        for (let c = 0; c < numLayers; c++) {
            const layerX = x + (seededRandom(i, 430 + c) - 0.5) * canopySize * 0.5;
            const layerY = y - treeHeight * 0.6 - canopySize * 0.3 + (seededRandom(i, 440 + c) - 0.5) * canopySize * 0.4;
            const layerSize = canopySize * (0.6 + seededRandom(i, 450 + c) * 0.4);

            ctx.beginPath();
            ctx.arc(layerX, layerY, layerSize, 0, Math.PI * 2);
            ctx.fillStyle = canopyColors[c % canopyColors.length];
            ctx.fill();
        }

        // Top highlight
        ctx.beginPath();
        ctx.arc(x, y - treeHeight * 0.7, canopySize * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#4caf50';
        ctx.fill();
    }

    // Draw rocks/stones (larger rocks)
    drawRocks(ctx, x, y, baseSize, seededRandom, i, side) {
        const numRocks = 2 + Math.floor(seededRandom(i, 500) * 3);

        for (let r = 0; r < numRocks; r++) {
            const rockX = x + (seededRandom(i, 510 + r) - 0.5) * baseSize * 2.5;
            const rockY = y + (seededRandom(i, 520 + r) - 0.5) * baseSize * 1.2;
            const rockWidth = baseSize * (0.5 + seededRandom(i, 530 + r) * 0.9);
            const rockHeight = rockWidth * (0.5 + seededRandom(i, 540 + r) * 0.3);

            // Shadow
            ctx.beginPath();
            ctx.ellipse(rockX + rockWidth * 0.15, rockY + rockHeight * 0.25,
                       rockWidth * 0.95, rockHeight * 0.45, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.fill();

            // Rock body (irregular ellipse)
            ctx.beginPath();
            ctx.ellipse(rockX, rockY - rockHeight * 0.3, rockWidth, rockHeight,
                       seededRandom(i, 550 + r) * 0.3, 0, Math.PI * 2);

            // Gradient for 3D effect - gray/white tones
            const rockGrad = ctx.createRadialGradient(
                rockX - rockWidth * 0.3, rockY - rockHeight * 0.5, 0,
                rockX, rockY - rockHeight * 0.3, rockWidth
            );

            // Color variation - grays and whites
            const colorType = seededRandom(i, 555 + r);
            let grayBase;
            if (colorType < 0.4) {
                // Light gray/white
                grayBase = 160 + Math.floor(seededRandom(i, 560 + r) * 50);
            } else if (colorType < 0.7) {
                // Medium gray
                grayBase = 120 + Math.floor(seededRandom(i, 560 + r) * 40);
            } else {
                // Blue-gray
                grayBase = 100 + Math.floor(seededRandom(i, 560 + r) * 35);
            }

            rockGrad.addColorStop(0, `rgb(${grayBase + 35}, ${grayBase + 35}, ${grayBase + 40})`);
            rockGrad.addColorStop(0.6, `rgb(${grayBase}, ${grayBase}, ${grayBase + 5})`);
            rockGrad.addColorStop(1, `rgb(${grayBase - 25}, ${grayBase - 25}, ${grayBase - 20})`);

            ctx.fillStyle = rockGrad;
            ctx.fill();

            // Highlight
            ctx.beginPath();
            ctx.ellipse(rockX - rockWidth * 0.3, rockY - rockHeight * 0.5,
                       rockWidth * 0.25, rockHeight * 0.18, -0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fill();
        }
    }

    // Draw scattered small stones/pebbles
    drawStones(ctx, x, y, baseSize, seededRandom, i, side) {
        const numStones = 5 + Math.floor(seededRandom(i, 1500) * 8); // More stones

        for (let s = 0; s < numStones; s++) {
            const stoneX = x + (seededRandom(i, 1510 + s) - 0.5) * baseSize * 4;
            const stoneY = y + (seededRandom(i, 1520 + s) - 0.5) * baseSize * 2.5;
            const stoneSize = baseSize * (0.12 + seededRandom(i, 1530 + s) * 0.3);

            // Tiny shadow
            ctx.beginPath();
            ctx.ellipse(stoneX + stoneSize * 0.2, stoneY + stoneSize * 0.15,
                       stoneSize * 0.9, stoneSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fill();

            // Stone body - varied shapes
            ctx.beginPath();
            const shapeType = seededRandom(i, 1540 + s);
            if (shapeType < 0.4) {
                // Round pebble
                ctx.arc(stoneX, stoneY, stoneSize, 0, Math.PI * 2);
            } else if (shapeType < 0.7) {
                // Oval pebble
                ctx.ellipse(stoneX, stoneY, stoneSize * 1.3, stoneSize * 0.8,
                           seededRandom(i, 1550 + s) * Math.PI, 0, Math.PI * 2);
            } else {
                // Irregular stone (polygon)
                const points = 5 + Math.floor(seededRandom(i, 1560 + s) * 3);
                for (let p = 0; p < points; p++) {
                    const angle = (p / points) * Math.PI * 2;
                    const radius = stoneSize * (0.7 + seededRandom(i, 1570 + s * 10 + p) * 0.5);
                    const px = stoneX + Math.cos(angle) * radius;
                    const py = stoneY + Math.sin(angle) * radius;
                    if (p === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            }

            // Color variation - mostly gray/white tones
            const colorType = seededRandom(i, 1580 + s);
            let stoneColor;
            if (colorType < 0.35) {
                // Light gray / white
                const gray = 180 + Math.floor(seededRandom(i, 1590 + s) * 60);
                stoneColor = `rgb(${gray}, ${gray}, ${gray - 5})`;
            } else if (colorType < 0.6) {
                // Medium gray
                const gray = 130 + Math.floor(seededRandom(i, 1600 + s) * 50);
                stoneColor = `rgb(${gray}, ${gray - 3}, ${gray - 5})`;
            } else if (colorType < 0.8) {
                // Blue-gray (river stones)
                const gray = 120 + Math.floor(seededRandom(i, 1610 + s) * 40);
                stoneColor = `rgb(${gray - 10}, ${gray}, ${gray + 15})`;
            } else {
                // Dark gray
                const gray = 80 + Math.floor(seededRandom(i, 1620 + s) * 40);
                stoneColor = `rgb(${gray}, ${gray - 2}, ${gray - 5})`;
            }

            ctx.fillStyle = stoneColor;
            ctx.fill();

            // White highlight on stones
            ctx.beginPath();
            ctx.arc(stoneX - stoneSize * 0.25, stoneY - stoneSize * 0.25,
                   stoneSize * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
        }
    }

    // Draw wildflowers
    drawFlowers(ctx, x, y, baseSize, seededRandom, i, side) {
        const numFlowers = 2 + Math.floor(seededRandom(i, 600) * 4);
        const flowerColors = ['#e91e63', '#9c27b0', '#ffeb3b', '#ff9800', '#fff', '#81d4fa'];

        for (let f = 0; f < numFlowers; f++) {
            const flowerX = x + (seededRandom(i, 610 + f) - 0.5) * baseSize * 2.5;
            const flowerY = y + (seededRandom(i, 620 + f) - 0.5) * baseSize * 1.5;
            const stemHeight = baseSize * (0.5 + seededRandom(i, 630 + f) * 0.5);
            const petalSize = baseSize * (0.15 + seededRandom(i, 640 + f) * 0.15);

            // Stem
            ctx.beginPath();
            ctx.moveTo(flowerX, flowerY);
            ctx.quadraticCurveTo(
                flowerX + (seededRandom(i, 650 + f) - 0.5) * baseSize * 0.3,
                flowerY - stemHeight * 0.5,
                flowerX, flowerY - stemHeight
            );
            ctx.strokeStyle = '#4a7c3f';
            ctx.lineWidth = Math.max(0.5, baseSize * 0.05);
            ctx.stroke();

            // Petals
            const numPetals = 4 + Math.floor(seededRandom(i, 660 + f) * 3);
            const color = flowerColors[Math.floor(seededRandom(i, 670 + f) * flowerColors.length)];

            for (let p = 0; p < numPetals; p++) {
                const angle = (p / numPetals) * Math.PI * 2;
                const petalX = flowerX + Math.cos(angle) * petalSize * 0.8;
                const petalY = flowerY - stemHeight + Math.sin(angle) * petalSize * 0.8;

                ctx.beginPath();
                ctx.ellipse(petalX, petalY, petalSize * 0.5, petalSize * 0.3,
                           angle, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }

            // Center
            ctx.beginPath();
            ctx.arc(flowerX, flowerY - stemHeight, petalSize * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffc107';
            ctx.fill();
        }
    }

    // Draw ferns
    drawFerns(ctx, x, y, baseSize, seededRandom, i, side) {
        const numFronds = 2 + Math.floor(seededRandom(i, 700) * 3);

        for (let f = 0; f < numFronds; f++) {
            const startX = x + (seededRandom(i, 710 + f) - 0.5) * baseSize;
            const frondLength = baseSize * (1.2 + seededRandom(i, 720 + f) * 0.8);
            const angle = (seededRandom(i, 730 + f) - 0.5) * 1.2 - 0.3; // Mostly upward, slight lean

            ctx.save();
            ctx.translate(startX, y);
            ctx.rotate(angle);

            // Main stem
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(frondLength * 0.1, -frondLength * 0.5, 0, -frondLength);
            ctx.strokeStyle = '#3d6b35';
            ctx.lineWidth = Math.max(0.5, baseSize * 0.08);
            ctx.stroke();

            // Leaflets along the stem
            const numLeaflets = 6 + Math.floor(seededRandom(i, 740 + f) * 4);
            ctx.fillStyle = '#4a8b3a';

            for (let l = 0; l < numLeaflets; l++) {
                const progress = (l + 1) / (numLeaflets + 1);
                const leafY = -frondLength * progress;
                const leafSize = baseSize * 0.3 * (1 - progress * 0.5);

                // Left leaflet
                ctx.beginPath();
                ctx.moveTo(0, leafY);
                ctx.quadraticCurveTo(-leafSize, leafY - leafSize * 0.3, -leafSize * 0.8, leafY + leafSize * 0.2);
                ctx.fill();

                // Right leaflet
                ctx.beginPath();
                ctx.moveTo(0, leafY);
                ctx.quadraticCurveTo(leafSize, leafY - leafSize * 0.3, leafSize * 0.8, leafY + leafSize * 0.2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // Draw a delta branch (thinner, with shadows) using filled polygons
    drawDeltaBranch(screenPoints, scaledTileSize) {
        if (screenPoints.length < 2) return;

        const ctx = this.ctx;
        const numPoints = screenPoints.length;

        // Calculate widths at each point (starts medium, gets thinner)
        const widths = [];
        for (let i = 0; i < numPoints; i++) {
            const progress = i / (numPoints - 1);
            widths.push(scaledTileSize / 8 * (1 - progress * 0.7));
        }

        // Calculate perpendicular offsets for left and right edges
        const leftEdge = [];
        const rightEdge = [];

        for (let i = 0; i < numPoints; i++) {
            const p = screenPoints[i];
            const width = widths[i];

            let dx, dy;
            if (i === 0) {
                dx = screenPoints[1].x - p.x;
                dy = screenPoints[1].y - p.y;
            } else if (i === numPoints - 1) {
                dx = p.x - screenPoints[i - 1].x;
                dy = p.y - screenPoints[i - 1].y;
            } else {
                dx = screenPoints[i + 1].x - screenPoints[i - 1].x;
                dy = screenPoints[i + 1].y - screenPoints[i - 1].y;
            }

            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len;
            const perpY = dx / len;

            leftEdge.push({ x: p.x + perpX * width / 2, y: p.y + perpY * width / 2 });
            rightEdge.push({ x: p.x - perpX * width / 2, y: p.y - perpY * width / 2 });
        }

        // Helper to draw filled branch shape
        const drawBranchShape = (widthMult, fillStyle) => {
            ctx.beginPath();

            ctx.moveTo(
                screenPoints[0].x + (leftEdge[0].x - screenPoints[0].x) * widthMult,
                screenPoints[0].y + (leftEdge[0].y - screenPoints[0].y) * widthMult
            );

            for (let i = 1; i < numPoints; i++) {
                const lx = screenPoints[i].x + (leftEdge[i].x - screenPoints[i].x) * widthMult;
                const ly = screenPoints[i].y + (leftEdge[i].y - screenPoints[i].y) * widthMult;
                ctx.lineTo(lx, ly);
            }

            for (let i = numPoints - 1; i >= 0; i--) {
                const rx = screenPoints[i].x + (rightEdge[i].x - screenPoints[i].x) * widthMult;
                const ry = screenPoints[i].y + (rightEdge[i].y - screenPoints[i].y) * widthMult;
                ctx.lineTo(rx, ry);
            }

            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
        };

        // Draw layers from outside in
        drawBranchShape(2.0, 'rgba(60, 40, 20, 0.4)');     // Outer shadow (brown)
        drawBranchShape(1.5, 'rgba(80, 50, 25, 0.5)');    // Inner shadow (brown)
        drawBranchShape(1.2, 'rgba(107, 68, 35, 0.9)');   // Bank/outline (brown)
        drawBranchShape(1.0, 'rgba(68, 153, 221, 0.9)');  // Main water
    }

    // Draw resource icon on tile
    drawResource(resourceType, x, y, s) {
        if (!spriteManager || !spriteManager.isResourcesReady()) return;

        const resourceSprite = spriteManager.getResource(resourceType);
        if (resourceSprite) {
            // Some resources need to be larger
            const sizeMultipliers = {
                'Silk': 0.8,
                'Gems': 0.8,
                'Spices': 0.8
            };
            const multiplier = sizeMultipliers[resourceType] || 0.6;

            const iconSize = s * multiplier;
            const iconX = x + (s - iconSize) / 2;
            const iconY = y + (s - iconSize) / 2;
            this.ctx.drawImage(resourceSprite, iconX, iconY, iconSize, iconSize);
        }
    }

    // Draw edge blending between different terrain types
    drawTerrainEdgeBlend(tile, tileX, tileY, screenX, screenY, size) {
        const ctx = this.ctx;

        // Draw shadows for ocean borders (instead of transition tiles)
        this.drawOceanShadows(tile, tileX, tileY, screenX, screenY, size);

        if (!spriteManager || !spriteManager.isTransitionsReady()) {
            return;
        }

        // Check right neighbor for horizontal transition (skip ocean)
        const rightTile = gameState.getTile(tileX + 1, tileY);
        if (rightTile && rightTile.terrain !== tile.terrain) {
            // Skip if ocean is involved
            if (tile.terrain === 'Ocean' || rightTile.terrain === 'Ocean') {
                // handled by shadows
            } else {
                const trans = spriteManager.getTransition(tile.terrain, rightTile.terrain, 'right');
                if (trans) {
                    const transX = screenX + size * 0.5;
                    ctx.save();
                    if (trans.flip) {
                        ctx.translate(transX + size, screenY);
                        ctx.scale(-1, 1);
                        ctx.drawImage(trans.tile, 0, 0, size, size);
                    } else {
                        ctx.drawImage(trans.tile, transX, screenY, size, size);
                    }
                    ctx.restore();
                }
            }
        }

        // Check bottom neighbor for vertical transition (skip ocean)
        const bottomTile = gameState.getTile(tileX, tileY + 1);
        if (bottomTile && bottomTile.terrain !== tile.terrain) {
            // Skip if ocean is involved
            if (tile.terrain === 'Ocean' || bottomTile.terrain === 'Ocean') {
                // handled by shadows
            } else {
                const trans = spriteManager.getTransition(tile.terrain, bottomTile.terrain, 'bottom');
                if (trans) {
                    const transY = screenY + size * 0.5;
                    ctx.save();
                    ctx.translate(screenX + size / 2, transY + size / 2);
                    if (trans.flip) {
                        ctx.rotate(-Math.PI / 2);
                    } else {
                        ctx.rotate(Math.PI / 2);
                    }
                    ctx.drawImage(trans.tile, -size / 2, -size / 2, size, size);
                    ctx.restore();
                }
            }
        }
    }

    // Draw shadow gradients for ocean borders
    drawOceanShadows(tile, tileX, tileY, screenX, screenY, size) {
        const ctx = this.ctx;
        const blendSize = size * 0.4;
        const oceanColor = 'rgba(0, 60, 130, 0.8)';

        const thisIsOcean = tile.terrain === 'Ocean';

        // Draw blue shadow on plains side (land tiles adjacent to ocean)
        if (!thisIsOcean) {
            const landDirections = [
                { dx: 0, dy: -1, edge: 'top' },
                { dx: 0, dy: 1, edge: 'bottom' },
                { dx: -1, dy: 0, edge: 'left' },
                { dx: 1, dy: 0, edge: 'right' }
            ];

            for (const dir of landDirections) {
                const adjTile = gameState.getTile(tileX + dir.dx, tileY + dir.dy);
                if (!adjTile || adjTile.terrain !== 'Ocean') continue;

                let gradient;
                switch (dir.edge) {
                    case 'top':
                        gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + blendSize);
                        break;
                    case 'bottom':
                        gradient = ctx.createLinearGradient(screenX, screenY + size, screenX, screenY + size - blendSize);
                        break;
                    case 'left':
                        gradient = ctx.createLinearGradient(screenX, screenY, screenX + blendSize, screenY);
                        break;
                    case 'right':
                        gradient = ctx.createLinearGradient(screenX + size, screenY, screenX + size - blendSize, screenY);
                        break;
                }

                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
                gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = gradient;
                switch (dir.edge) {
                    case 'top':
                        ctx.fillRect(screenX, screenY, size, blendSize);
                        break;
                    case 'bottom':
                        ctx.fillRect(screenX, screenY + size - blendSize, size, blendSize);
                        break;
                    case 'left':
                        ctx.fillRect(screenX, screenY, blendSize, size);
                        break;
                    case 'right':
                        ctx.fillRect(screenX + size - blendSize, screenY, blendSize, size);
                        break;
                }
            }
            return;
        }

        // Below is for ocean tiles only - draw white waves

        const directions = [
            { dx: 0, dy: -1, edge: 'top' },
            { dx: 0, dy: 1, edge: 'bottom' },
            { dx: -1, dy: 0, edge: 'left' },
            { dx: 1, dy: 0, edge: 'right' }
        ];

        // Cardinal directions
        for (const dir of directions) {
            const adjTile = gameState.getTile(tileX + dir.dx, tileY + dir.dy);
            if (!adjTile || adjTile.terrain === 'Ocean') continue;

            let gradient;
            switch (dir.edge) {
                case 'top':
                    gradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + blendSize);
                    break;
                case 'bottom':
                    gradient = ctx.createLinearGradient(screenX, screenY + size, screenX, screenY + size - blendSize);
                    break;
                case 'left':
                    gradient = ctx.createLinearGradient(screenX, screenY, screenX + blendSize, screenY);
                    break;
                case 'right':
                    gradient = ctx.createLinearGradient(screenX + size, screenY, screenX + size - blendSize, screenY);
                    break;
            }

            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            switch (dir.edge) {
                case 'top':
                    ctx.fillRect(screenX, screenY, size, blendSize);
                    break;
                case 'bottom':
                    ctx.fillRect(screenX, screenY + size - blendSize, size, blendSize);
                    break;
                case 'left':
                    ctx.fillRect(screenX, screenY, blendSize, size);
                    break;
                case 'right':
                    ctx.fillRect(screenX + size - blendSize, screenY, blendSize, size);
                    break;
            }
        }

        // Corner directions - draw radial gradient in corners
        const corners = [
            { dx: -1, dy: -1, corner: 'topLeft' },
            { dx: 1, dy: -1, corner: 'topRight' },
            { dx: -1, dy: 1, corner: 'bottomLeft' },
            { dx: 1, dy: 1, corner: 'bottomRight' }
        ];

        for (const corner of corners) {
            const diagTile = gameState.getTile(tileX + corner.dx, tileY + corner.dy);
            if (!diagTile || diagTile.terrain === 'Ocean') continue;

            // Check if adjacent cardinal tiles are ocean (only draw corner if it's a true corner)
            const horzTile = gameState.getTile(tileX + corner.dx, tileY);
            const vertTile = gameState.getTile(tileX, tileY + corner.dy);
            if (horzTile && horzTile.terrain !== 'Ocean') continue;
            if (vertTile && vertTile.terrain !== 'Ocean') continue;

            let cx, cy;
            switch (corner.corner) {
                case 'topLeft':
                    cx = screenX;
                    cy = screenY;
                    break;
                case 'topRight':
                    cx = screenX + size;
                    cy = screenY;
                    break;
                case 'bottomLeft':
                    cx = screenX;
                    cy = screenY + size;
                    break;
                case 'bottomRight':
                    cx = screenX + size;
                    cy = screenY + size;
                    break;
            }

            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, blendSize);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
            gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, blendSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw terrain based on type
    drawTerrain(terrain, x, y, s, variation, tileX, tileY) {
        const ctx = this.ctx;

        // Try to use loaded terrain tiles first
        if (spriteManager && spriteManager.isTerrainReady()) {
            const tile = spriteManager.getTerrain(terrain);
            if (tile) {
                ctx.drawImage(tile, x, y, s + 1, s + 1);
                return;
            }
        }

        // Fallback to programmatic drawing
        switch(terrain) {
            case 'Ocean':
                this.drawOcean(ctx, x, y, s, variation);
                break;
            case 'Grassland':
                this.drawGrassland(ctx, x, y, s, variation);
                break;
            case 'Plains':
                this.drawPlains(ctx, x, y, s, variation);
                break;
            case 'Desert':
                this.drawDesert(ctx, x, y, s, variation);
                break;
            case 'Hills':
                this.drawHills(ctx, x, y, s, variation);
                break;
            case 'Mountains':
                this.drawMountains(ctx, x, y, s, variation);
                break;
            case 'Forest':
                this.drawForest(ctx, x, y, s, variation);
                break;
            default:
                ctx.fillStyle = '#888';
                ctx.fillRect(x, y, s, s);
        }
    }

    // Ocean - Classic Civ 1 style: solid blue with simple wave pattern
    drawOcean(ctx, x, y, s, v) {
        // Solid deep blue base
        ctx.fillStyle = '#0040a0';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Simple wave lines (Civ 1 style)
        ctx.strokeStyle = '#0050c0';
        ctx.lineWidth = Math.max(1, s * 0.06);

        // Two simple wave arcs
        ctx.beginPath();
        ctx.arc(x + s * 0.25, y + s * 0.4, s * 0.15, 0, Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + s * 0.7, y + s * 0.65, s * 0.12, 0, Math.PI);
        ctx.stroke();
    }

    // Grassland - Classic Civ 1 style: bright green with small tufts
    drawGrassland(ctx, x, y, s, v) {
        // Solid bright green
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Simple grass tufts (small vertical lines)
        ctx.strokeStyle = '#008000';
        ctx.lineWidth = Math.max(1, s * 0.04);

        const positions = [
            [0.2, 0.3], [0.5, 0.25], [0.8, 0.35],
            [0.3, 0.6], [0.6, 0.55], [0.75, 0.7],
            [0.15, 0.8], [0.45, 0.75], [0.85, 0.85]
        ];

        for (const [px, py] of positions) {
            ctx.beginPath();
            ctx.moveTo(x + s * px, y + s * py);
            ctx.lineTo(x + s * px, y + s * (py - 0.08));
            ctx.stroke();
        }
    }

    // Plains - Classic Civ 1 style: tan/yellow with simple grass
    drawPlains(ctx, x, y, s, v) {
        // Tan/wheat color base
        ctx.fillStyle = '#c8b040';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Simple dry grass lines
        ctx.strokeStyle = '#a89030';
        ctx.lineWidth = Math.max(1, s * 0.03);

        for (let i = 0; i < 6; i++) {
            const px = x + s * (0.15 + i * 0.14);
            const py = y + s * (0.5 + (i % 2) * 0.2);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - s * 0.03, py - s * 0.12);
            ctx.moveTo(px, py);
            ctx.lineTo(px + s * 0.03, py - s * 0.1);
            ctx.stroke();
        }

        // Optional shield/resource icon (like Civ 1)
        if (v > 0.8) {
            ctx.fillStyle = '#a08020';
            ctx.beginPath();
            ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Desert - Classic Civ 1 style: bright yellow/sand
    drawDesert(ctx, x, y, s, v) {
        // Bright sand yellow
        ctx.fillStyle = '#e8d858';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Simple dune shading
        ctx.fillStyle = '#d0c048';
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.7);
        ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.4, x + s, y + s * 0.6);
        ctx.lineTo(x + s, y + s);
        ctx.lineTo(x, y + s);
        ctx.closePath();
        ctx.fill();

        // Cactus (occasional, like Civ 1 oasis)
        if (v > 0.75) {
            ctx.fillStyle = '#208020';
            // Cactus trunk
            ctx.fillRect(x + s * 0.47, y + s * 0.45, s * 0.06, s * 0.25);
            // Cactus arms
            ctx.fillRect(x + s * 0.35, y + s * 0.5, s * 0.12, s * 0.05);
            ctx.fillRect(x + s * 0.35, y + s * 0.45, s * 0.05, s * 0.1);
            ctx.fillRect(x + s * 0.53, y + s * 0.55, s * 0.12, s * 0.05);
            ctx.fillRect(x + s * 0.6, y + s * 0.5, s * 0.05, s * 0.1);
        }
    }

    // Hills - Classic Civ 1 style: brown mounds
    drawHills(ctx, x, y, s, v) {
        // Green-brown base
        ctx.fillStyle = '#689030';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Front hill (brown/tan)
        ctx.fillStyle = '#987850';
        ctx.beginPath();
        ctx.moveTo(x, y + s);
        ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.35, x + s * 0.55, y + s * 0.45);
        ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.55, x + s, y + s);
        ctx.closePath();
        ctx.fill();

        // Hill highlight
        ctx.fillStyle = '#a89060';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.1, y + s * 0.85);
        ctx.quadraticCurveTo(x + s * 0.3, y + s * 0.4, x + s * 0.5, y + s * 0.48);
        ctx.lineTo(x + s * 0.35, y + s * 0.65);
        ctx.closePath();
        ctx.fill();

        // Back hill
        ctx.fillStyle = '#786840';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.4, y + s * 0.5);
        ctx.quadraticCurveTo(x + s * 0.65, y + s * 0.25, x + s * 0.9, y + s * 0.4);
        ctx.lineTo(x + s * 0.9, y + s * 0.55);
        ctx.quadraticCurveTo(x + s * 0.65, y + s * 0.45, x + s * 0.4, y + s * 0.5);
        ctx.closePath();
        ctx.fill();
    }

    // Mountains - Classic Civ 1 style: gray triangular peaks with snow
    drawMountains(ctx, x, y, s, v) {
        // Dark base
        ctx.fillStyle = '#585858';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Back mountain
        ctx.fillStyle = '#686868';
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.9);
        ctx.lineTo(x + s * 0.25, y + s * 0.35);
        ctx.lineTo(x + s * 0.5, y + s * 0.9);
        ctx.closePath();
        ctx.fill();

        // Main mountain (lighter gray)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.15, y + s);
        ctx.lineTo(x + s * 0.5, y + s * 0.1);
        ctx.lineTo(x + s * 0.85, y + s);
        ctx.closePath();
        ctx.fill();

        // Shaded right side
        ctx.fillStyle = '#606060';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y + s * 0.1);
        ctx.lineTo(x + s * 0.85, y + s);
        ctx.lineTo(x + s * 0.5, y + s);
        ctx.closePath();
        ctx.fill();

        // Snow cap (classic white triangle)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y + s * 0.1);
        ctx.lineTo(x + s * 0.38, y + s * 0.32);
        ctx.lineTo(x + s * 0.62, y + s * 0.32);
        ctx.closePath();
        ctx.fill();

        // Snow cap shaded side
        ctx.fillStyle = '#d0d0d0';
        ctx.beginPath();
        ctx.moveTo(x + s * 0.5, y + s * 0.1);
        ctx.lineTo(x + s * 0.62, y + s * 0.32);
        ctx.lineTo(x + s * 0.5, y + s * 0.32);
        ctx.closePath();
        ctx.fill();
    }

    // Forest - Classic Civ 1 style: green with iconic pine trees
    drawForest(ctx, x, y, s, v) {
        // Dark green base
        ctx.fillStyle = '#006800';
        ctx.fillRect(x, y, s + 1, s + 1);

        // Draw 3 iconic pine trees (like Civ 1)
        this.drawPineTree(ctx, x + s * 0.25, y + s * 0.85, s * 0.35);
        this.drawPineTree(ctx, x + s * 0.6, y + s * 0.9, s * 0.4);
        this.drawPineTree(ctx, x + s * 0.8, y + s * 0.75, s * 0.28);
    }

    // Draw a simple Civ 1 style pine tree
    drawPineTree(ctx, tx, ty, size) {
        // Brown trunk
        ctx.fillStyle = '#604020';
        ctx.fillRect(tx - size * 0.08, ty - size * 0.15, size * 0.16, size * 0.2);

        // Dark green triangle (tree body)
        ctx.fillStyle = '#008000';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size);
        ctx.lineTo(tx - size * 0.4, ty - size * 0.1);
        ctx.lineTo(tx + size * 0.4, ty - size * 0.1);
        ctx.closePath();
        ctx.fill();

        // Lighter highlight on left side
        ctx.fillStyle = '#00a000';
        ctx.beginPath();
        ctx.moveTo(tx, ty - size);
        ctx.lineTo(tx - size * 0.35, ty - size * 0.15);
        ctx.lineTo(tx, ty - size * 0.3);
        ctx.closePath();
        ctx.fill();
    }

    // Draw road improvement - connects to neighboring roads
    drawRoad(x, y, s, tileX, tileY) {
        const ctx = this.ctx;
        const roadWidth = s * 0.22;
        const centerX = x + s / 2;
        const centerY = y + s / 2;
        const halfRoad = roadWidth / 2;

        // Check which neighbors have roads
        const hasRoadNorth = this.tileHasRoad(tileX, tileY - 1);
        const hasRoadSouth = this.tileHasRoad(tileX, tileY + 1);
        const hasRoadWest = this.tileHasRoad(tileX - 1, tileY);
        const hasRoadEast = this.tileHasRoad(tileX + 1, tileY);

        // If no neighbors have roads, draw a small circle (road endpoint)
        const hasAnyConnection = hasRoadNorth || hasRoadSouth || hasRoadWest || hasRoadEast;

        // Draw shadow first
        ctx.fillStyle = 'rgba(30, 20, 10, 0.6)';
        if (hasRoadNorth) {
            ctx.fillRect(centerX - halfRoad + 2, y + 2, roadWidth, s / 2);
        }
        if (hasRoadSouth) {
            ctx.fillRect(centerX - halfRoad + 2, centerY + 2, roadWidth, s / 2);
        }
        if (hasRoadWest) {
            ctx.fillRect(x + 2, centerY - halfRoad + 2, s / 2, roadWidth);
        }
        if (hasRoadEast) {
            ctx.fillRect(centerX + 2, centerY - halfRoad + 2, s / 2, roadWidth);
        }
        if (!hasAnyConnection) {
            // Shadow for endpoint circle
            ctx.beginPath();
            ctx.arc(centerX + 2, centerY + 2, roadWidth * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw main road (brown)
        ctx.fillStyle = '#8B5A2B';
        if (hasRoadNorth) {
            ctx.fillRect(centerX - halfRoad, y, roadWidth, s / 2 + halfRoad);
        }
        if (hasRoadSouth) {
            ctx.fillRect(centerX - halfRoad, centerY - halfRoad, roadWidth, s / 2 + halfRoad);
        }
        if (hasRoadWest) {
            ctx.fillRect(x, centerY - halfRoad, s / 2 + halfRoad, roadWidth);
        }
        if (hasRoadEast) {
            ctx.fillRect(centerX - halfRoad, centerY - halfRoad, s / 2 + halfRoad, roadWidth);
        }
        if (!hasAnyConnection) {
            // Endpoint circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, roadWidth * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw center highlight
        ctx.fillStyle = '#A0724A';
        const highlightWidth = roadWidth * 0.4;
        const halfHighlight = highlightWidth / 2;
        if (hasRoadNorth) {
            ctx.fillRect(centerX - halfHighlight, y, highlightWidth, s / 2 + halfHighlight);
        }
        if (hasRoadSouth) {
            ctx.fillRect(centerX - halfHighlight, centerY - halfHighlight, highlightWidth, s / 2 + halfHighlight);
        }
        if (hasRoadWest) {
            ctx.fillRect(x, centerY - halfHighlight, s / 2 + halfHighlight, highlightWidth);
        }
        if (hasRoadEast) {
            ctx.fillRect(centerX - halfHighlight, centerY - halfHighlight, s / 2 + halfHighlight, highlightWidth);
        }
        if (!hasAnyConnection) {
            // Endpoint highlight
            ctx.beginPath();
            ctx.arc(centerX, centerY, roadWidth * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Check if a tile has a road
    tileHasRoad(x, y) {
        const tile = gameState.getTile(x, y);
        return tile && tile.has_road;
    }

    // Render cities
    renderCities() {
        const scaledTileSize = this.tileSize * this.camera.zoom;

        for (const player of gameState.players) {
            for (const city of player.cities) {
                const screen = this.worldToScreen(city.x, city.y);
                const cx = screen.x + scaledTileSize / 2;
                const cy = screen.y + scaledTileSize / 2;

                // City walls/fortification (outer rectangle)
                this.ctx.fillStyle = '#4a4a4a';
                this.ctx.fillRect(
                    screen.x + scaledTileSize * 0.1,
                    screen.y + scaledTileSize * 0.1,
                    scaledTileSize * 0.8,
                    scaledTileSize * 0.8
                );

                // City inner area with player color
                this.ctx.fillStyle = player.color;
                this.ctx.fillRect(
                    screen.x + scaledTileSize * 0.15,
                    screen.y + scaledTileSize * 0.15,
                    scaledTileSize * 0.7,
                    scaledTileSize * 0.7
                );

                // City center (tower/building)
                this.ctx.fillStyle = '#2a2a2a';
                this.ctx.fillRect(
                    screen.x + scaledTileSize * 0.35,
                    screen.y + scaledTileSize * 0.25,
                    scaledTileSize * 0.3,
                    scaledTileSize * 0.4
                );

                // Tower top
                this.ctx.fillStyle = '#5a5a5a';
                this.ctx.beginPath();
                this.ctx.moveTo(screen.x + scaledTileSize * 0.3, screen.y + scaledTileSize * 0.25);
                this.ctx.lineTo(screen.x + scaledTileSize * 0.5, screen.y + scaledTileSize * 0.1);
                this.ctx.lineTo(screen.x + scaledTileSize * 0.7, screen.y + scaledTileSize * 0.25);
                this.ctx.fill();

                // Population number in shield
                const shieldX = screen.x + scaledTileSize * 0.65;
                const shieldY = screen.y + scaledTileSize * 0.65;

                // Shield background
                this.ctx.fillStyle = '#1a1a4a';
                this.ctx.beginPath();
                this.ctx.moveTo(shieldX, shieldY - scaledTileSize * 0.15);
                this.ctx.lineTo(shieldX + scaledTileSize * 0.18, shieldY);
                this.ctx.lineTo(shieldX, shieldY + scaledTileSize * 0.2);
                this.ctx.lineTo(shieldX - scaledTileSize * 0.18, shieldY);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffd700';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                // Population number
                this.ctx.fillStyle = '#fff';
                this.ctx.font = `bold ${Math.max(8, scaledTileSize * 0.3)}px sans-serif`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(city.population.toString(), shieldX, shieldY);

                // City name (if zoomed in enough)
                if (this.camera.zoom >= 0.7) {
                    // Name background
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    const nameWidth = this.ctx.measureText(city.name).width + 6;
                    this.ctx.fillRect(
                        cx - nameWidth / 2,
                        screen.y + scaledTileSize + 2,
                        nameWidth,
                        14
                    );

                    // Name text
                    this.ctx.fillStyle = '#ffd700';
                    this.ctx.font = `${Math.max(9, scaledTileSize * 0.28)}px MedievalSharp, serif`;
                    this.ctx.fillText(
                        city.name,
                        cx,
                        screen.y + scaledTileSize + 11
                    );
                }
            }
        }
    }

    // Render units
    renderUnits() {
        const scaledTileSize = this.tileSize * this.camera.zoom;

        if (!gameState.players || gameState.players.length === 0) {
            return;
        }

        for (const player of gameState.players) {
            if (!player.units || player.units.length === 0) {
                continue;
            }
            for (const unit of player.units) {
                const screen = this.worldToScreen(unit.x, unit.y);

                // Draw unit background (player color border)
                this.ctx.fillStyle = player.color;
                this.ctx.fillRect(
                    screen.x + scaledTileSize * 0.05,
                    screen.y + scaledTileSize * 0.05,
                    scaledTileSize * 0.9,
                    scaledTileSize * 0.9
                );

                // Draw unit sprite background
                this.ctx.fillStyle = '#1a1a2a';
                this.ctx.fillRect(
                    screen.x + scaledTileSize * 0.1,
                    screen.y + scaledTileSize * 0.1,
                    scaledTileSize * 0.8,
                    scaledTileSize * 0.8
                );

                // Draw the unit sprite
                this.drawUnitSprite(
                    unit.type,
                    screen.x + scaledTileSize * 0.1,
                    screen.y + scaledTileSize * 0.1,
                    scaledTileSize * 0.8,
                    player.color
                );

                // Veteran star (gold) in corner
                if (unit.is_veteran) {
                    this.ctx.fillStyle = '#ffd700';
                    this.ctx.font = `bold ${Math.max(10, scaledTileSize * 0.3)}px sans-serif`;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('\u2605', screen.x + scaledTileSize * 0.85, screen.y + scaledTileSize * 0.15);
                }

                // Fortified indicator (blue glow border)
                if (unit.is_fortified) {
                    this.ctx.strokeStyle = '#4a9eff';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(
                        screen.x + scaledTileSize * 0.02,
                        screen.y + scaledTileSize * 0.02,
                        scaledTileSize * 0.96,
                        scaledTileSize * 0.96
                    );
                }

                // Movement indicator (dim overlay if no movement left)
                if (unit.movement_left === 0) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    this.ctx.fillRect(
                        screen.x + scaledTileSize * 0.05,
                        screen.y + scaledTileSize * 0.05,
                        scaledTileSize * 0.9,
                        scaledTileSize * 0.9
                    );
                }

                // Blinking highlight for selected unit
                if (gameState.selectedUnit && unit.id === gameState.selectedUnit.id) {
                    if (Math.floor(Date.now() / 400) % 2 === 0) {
                        this.ctx.strokeStyle = '#fff';
                        this.ctx.lineWidth = 3;
                        this.ctx.strokeRect(
                            screen.x + scaledTileSize * 0.02,
                            screen.y + scaledTileSize * 0.02,
                            scaledTileSize * 0.96,
                            scaledTileSize * 0.96
                        );
                    }
                }
                // Blinking border for units that can still act (my units with movement left)
                else if (player.id === gameState.myPlayerId && unit.movement_left > 0 && !unit.is_fortified) {
                    if (Math.floor(Date.now() / 600) % 2 === 0) {
                        this.ctx.strokeStyle = '#ffff00';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(
                            screen.x + scaledTileSize * 0.02,
                            screen.y + scaledTileSize * 0.02,
                            scaledTileSize * 0.96,
                            scaledTileSize * 0.96
                        );
                    }
                }
            }
        }
    }

    // Get unit letter for display (fallback)
    getUnitLetter(unitType) {
        const letters = {
            'Settler': 'S',
            'Warrior': 'W',
            'Phalanx': 'P',
            'Archer': 'A',
            'Horseman': 'H',
            'Catapult': 'C'
        };
        return letters[unitType] || '?';
    }

    // Draw detailed unit sprite
    drawUnitSprite(unitType, x, y, size, playerColor) {
        const ctx = this.ctx;
        const s = size; // shorthand for size

        // Try to use loaded sprite first
        if (spriteManager && spriteManager.isReady()) {
            const sprite = spriteManager.getSprite(unitType);
            if (sprite) {
                // Draw the sprite scaled to fit
                ctx.drawImage(sprite, x, y, s, s);
                return;
            }
        }

        // Fallback to procedural drawing if sprites not loaded
        const skin = '#deb887';
        const dark = '#2a2a2a';
        const metal = '#708090';
        const wood = '#8b4513';

        ctx.save();
        ctx.translate(x, y);

        switch(unitType) {
            case 'Settler':
                this.drawSettler(ctx, s, skin, dark, wood, playerColor);
                break;
            case 'Warrior':
                this.drawWarrior(ctx, s, skin, dark, wood, playerColor);
                break;
            case 'Phalanx':
                this.drawPhalanx(ctx, s, skin, dark, metal, playerColor);
                break;
            case 'Archer':
                this.drawArcher(ctx, s, skin, dark, wood, playerColor);
                break;
            case 'Horseman':
                this.drawHorseman(ctx, s, skin, dark, playerColor);
                break;
            case 'Catapult':
                this.drawCatapult(ctx, s, dark, wood);
                break;
            default:
                // Fallback to letter
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${s * 0.5}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.getUnitLetter(unitType), s/2, s/2);
        }

        ctx.restore();
    }

    // Settler: Person with cart
    drawSettler(ctx, s, skin, dark, wood, color) {
        // Cart wheels
        ctx.fillStyle = wood;
        ctx.beginPath();
        ctx.arc(s * 0.7, s * 0.75, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.4, s * 0.75, s * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Cart body
        ctx.fillStyle = wood;
        ctx.fillRect(s * 0.3, s * 0.5, s * 0.5, s * 0.2);

        // Supplies on cart
        ctx.fillStyle = '#c4a35a';
        ctx.fillRect(s * 0.35, s * 0.38, s * 0.15, s * 0.14);
        ctx.fillStyle = '#8fbc8f';
        ctx.fillRect(s * 0.52, s * 0.4, s * 0.18, s * 0.12);

        // Person body
        ctx.fillStyle = color;
        ctx.fillRect(s * 0.12, s * 0.4, s * 0.18, s * 0.25);

        // Person head
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(s * 0.21, s * 0.32, s * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Hat
        ctx.fillStyle = '#654321';
        ctx.fillRect(s * 0.11, s * 0.22, s * 0.2, s * 0.06);

        // Legs
        ctx.fillStyle = dark;
        ctx.fillRect(s * 0.14, s * 0.65, s * 0.06, s * 0.15);
        ctx.fillRect(s * 0.22, s * 0.65, s * 0.06, s * 0.15);
    }

    // Warrior: Figure with club
    drawWarrior(ctx, s, skin, dark, wood, color) {
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(s * 0.35, s * 0.35, s * 0.3, s * 0.3);

        // Head
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.25, s * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Hair/headband
        ctx.fillStyle = dark;
        ctx.fillRect(s * 0.38, s * 0.15, s * 0.24, s * 0.06);

        // Club
        ctx.fillStyle = wood;
        ctx.save();
        ctx.translate(s * 0.72, s * 0.25);
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(-s * 0.04, 0, s * 0.08, s * 0.35);
        // Club head
        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.arc(0, s * 0.35, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Shield arm
        ctx.fillStyle = skin;
        ctx.fillRect(s * 0.22, s * 0.38, s * 0.15, s * 0.08);

        // Small shield
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s * 0.2, s * 0.45, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Legs
        ctx.fillStyle = skin;
        ctx.fillRect(s * 0.38, s * 0.65, s * 0.08, s * 0.18);
        ctx.fillRect(s * 0.54, s * 0.65, s * 0.08, s * 0.18);
    }

    // Phalanx: Soldier with spear and large shield
    drawPhalanx(ctx, s, skin, dark, metal, color) {
        // Large shield
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s * 0.15, s * 0.25);
        ctx.lineTo(s * 0.45, s * 0.2);
        ctx.lineTo(s * 0.45, s * 0.75);
        ctx.lineTo(s * 0.15, s * 0.7);
        ctx.closePath();
        ctx.fill();

        // Shield decoration
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s * 0.3, s * 0.3);
        ctx.lineTo(s * 0.3, s * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.3, s * 0.47, s * 0.1, 0, Math.PI * 2);
        ctx.stroke();

        // Helmet
        ctx.fillStyle = metal;
        ctx.beginPath();
        ctx.arc(s * 0.6, s * 0.25, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        // Helmet crest
        ctx.fillStyle = '#8b0000';
        ctx.fillRect(s * 0.57, s * 0.1, s * 0.06, s * 0.12);

        // Face
        ctx.fillStyle = skin;
        ctx.fillRect(s * 0.54, s * 0.25, s * 0.12, s * 0.1);

        // Body armor
        ctx.fillStyle = metal;
        ctx.fillRect(s * 0.5, s * 0.35, s * 0.2, s * 0.25);

        // Spear
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(s * 0.75, s * 0.1, s * 0.04, s * 0.7);
        // Spear tip
        ctx.fillStyle = metal;
        ctx.beginPath();
        ctx.moveTo(s * 0.77, s * 0.1);
        ctx.lineTo(s * 0.72, s * 0.2);
        ctx.lineTo(s * 0.82, s * 0.2);
        ctx.closePath();
        ctx.fill();

        // Legs
        ctx.fillStyle = metal;
        ctx.fillRect(s * 0.52, s * 0.6, s * 0.07, s * 0.2);
        ctx.fillRect(s * 0.61, s * 0.6, s * 0.07, s * 0.2);
    }

    // Archer: Figure with bow
    drawArcher(ctx, s, skin, dark, wood, color) {
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(s * 0.4, s * 0.35, s * 0.2, s * 0.28);

        // Head
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.25, s * 0.11, 0, Math.PI * 2);
        ctx.fill();

        // Hood/cap
        ctx.fillStyle = '#228b22';
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.22, s * 0.12, Math.PI, 0);
        ctx.fill();

        // Bow
        ctx.strokeStyle = wood;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s * 0.25, s * 0.45, s * 0.25, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();

        // Bowstring
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s * 0.35, s * 0.22);
        ctx.lineTo(s * 0.35, s * 0.68);
        ctx.stroke();

        // Arrow
        ctx.fillStyle = wood;
        ctx.fillRect(s * 0.35, s * 0.43, s * 0.35, s * 0.03);
        // Arrow tip
        ctx.fillStyle = '#708090';
        ctx.beginPath();
        ctx.moveTo(s * 0.7, s * 0.445);
        ctx.lineTo(s * 0.78, s * 0.445);
        ctx.lineTo(s * 0.7, s * 0.42);
        ctx.lineTo(s * 0.7, s * 0.47);
        ctx.closePath();
        ctx.fill();
        // Arrow fletching
        ctx.fillStyle = '#8b0000';
        ctx.beginPath();
        ctx.moveTo(s * 0.35, s * 0.445);
        ctx.lineTo(s * 0.28, s * 0.4);
        ctx.lineTo(s * 0.28, s * 0.49);
        ctx.closePath();
        ctx.fill();

        // Quiver on back
        ctx.fillStyle = '#654321';
        ctx.fillRect(s * 0.58, s * 0.3, s * 0.1, s * 0.28);

        // Legs
        ctx.fillStyle = '#556b2f';
        ctx.fillRect(s * 0.42, s * 0.63, s * 0.07, s * 0.18);
        ctx.fillRect(s * 0.51, s * 0.63, s * 0.07, s * 0.18);
    }

    // Horseman: Mounted figure
    drawHorseman(ctx, s, skin, dark, color) {
        // Horse body
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.ellipse(s * 0.5, s * 0.6, s * 0.3, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horse legs
        ctx.fillStyle = '#6b3a0a';
        ctx.fillRect(s * 0.25, s * 0.68, s * 0.06, s * 0.18);
        ctx.fillRect(s * 0.35, s * 0.7, s * 0.06, s * 0.16);
        ctx.fillRect(s * 0.58, s * 0.7, s * 0.06, s * 0.16);
        ctx.fillRect(s * 0.68, s * 0.68, s * 0.06, s * 0.18);

        // Horse neck
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.moveTo(s * 0.72, s * 0.55);
        ctx.lineTo(s * 0.85, s * 0.35);
        ctx.lineTo(s * 0.78, s * 0.35);
        ctx.lineTo(s * 0.65, s * 0.55);
        ctx.closePath();
        ctx.fill();

        // Horse head
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.ellipse(s * 0.88, s * 0.32, s * 0.08, s * 0.1, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();

        // Horse eye
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(s * 0.9, s * 0.3, s * 0.02, 0, Math.PI * 2);
        ctx.fill();

        // Mane
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(s * 0.72, s * 0.35, s * 0.08, s * 0.15);

        // Tail
        ctx.fillStyle = '#2a1a0a';
        ctx.beginPath();
        ctx.moveTo(s * 0.2, s * 0.55);
        ctx.quadraticCurveTo(s * 0.08, s * 0.65, s * 0.12, s * 0.8);
        ctx.lineTo(s * 0.18, s * 0.78);
        ctx.quadraticCurveTo(s * 0.15, s * 0.65, s * 0.22, s * 0.58);
        ctx.closePath();
        ctx.fill();

        // Rider body
        ctx.fillStyle = color;
        ctx.fillRect(s * 0.42, s * 0.28, s * 0.16, s * 0.22);

        // Rider head
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.2, s * 0.09, 0, Math.PI * 2);
        ctx.fill();

        // Helmet
        ctx.fillStyle = '#708090';
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.17, s * 0.09, Math.PI, 0);
        ctx.fill();

        // Sword
        ctx.fillStyle = '#c0c0c0';
        ctx.save();
        ctx.translate(s * 0.62, s * 0.3);
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(0, 0, s * 0.04, s * 0.25);
        ctx.restore();

        // Sword handle
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(s * 0.6, s * 0.28, s * 0.06, s * 0.08);
    }

    // Catapult: Siege weapon
    drawCatapult(ctx, s, dark, wood) {
        // Base/wheels
        ctx.fillStyle = wood;
        ctx.fillRect(s * 0.15, s * 0.7, s * 0.7, s * 0.08);

        // Wheels
        ctx.fillStyle = '#5a4a3a';
        ctx.beginPath();
        ctx.arc(s * 0.25, s * 0.78, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.75, s * 0.78, s * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Wheel spokes
        ctx.strokeStyle = wood;
        ctx.lineWidth = 2;
        for (let wheel of [[s * 0.25, s * 0.78], [s * 0.75, s * 0.78]]) {
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(wheel[0], wheel[1]);
                ctx.lineTo(
                    wheel[0] + Math.cos(i * Math.PI / 2) * s * 0.08,
                    wheel[1] + Math.sin(i * Math.PI / 2) * s * 0.08
                );
                ctx.stroke();
            }
        }

        // Frame uprights
        ctx.fillStyle = wood;
        ctx.fillRect(s * 0.3, s * 0.35, s * 0.08, s * 0.35);
        ctx.fillRect(s * 0.62, s * 0.35, s * 0.08, s * 0.35);

        // Crossbar
        ctx.fillRect(s * 0.28, s * 0.35, s * 0.44, s * 0.06);

        // Throwing arm
        ctx.fillStyle = '#6b4423';
        ctx.save();
        ctx.translate(s * 0.5, s * 0.38);
        ctx.rotate(-Math.PI / 4);
        ctx.fillRect(-s * 0.04, -s * 0.35, s * 0.08, s * 0.45);
        ctx.restore();

        // Bucket/sling
        ctx.fillStyle = '#4a3a2a';
        ctx.beginPath();
        ctx.arc(s * 0.26, s * 0.15, s * 0.08, 0, Math.PI);
        ctx.fill();

        // Stone in bucket
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.arc(s * 0.26, s * 0.18, s * 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Rope/tension
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s * 0.5, s * 0.55);
        ctx.lineTo(s * 0.5, s * 0.68);
        ctx.stroke();
    }

    // Render selection highlight
    renderSelection() {
        const scaledTileSize = this.tileSize * this.camera.zoom;

        // Selected unit
        if (gameState.selectedUnit) {
            const unit = gameState.selectedUnit;
            const screen = this.worldToScreen(unit.x, unit.y);

            // Highlight - black border, larger
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 5;
            this.ctx.strokeRect(
                screen.x - 2,
                screen.y - 2,
                scaledTileSize + 4,
                scaledTileSize + 4
            );

            // Show movement range when in move mode
            if (gameState.mode === 'move' && unit.movement_left > 0) {
                this.renderMovementRange(unit);
            }

            // Show attack range when in attack mode
            if (gameState.mode === 'attack') {
                this.renderAttackRange(unit);
            }
        }

        // Selected city
        if (gameState.selectedCity) {
            const city = gameState.selectedCity;
            const screen = this.worldToScreen(city.x, city.y);

            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 5;
            this.ctx.strokeRect(
                screen.x - 2,
                screen.y - 2,
                scaledTileSize + 4,
                scaledTileSize + 4
            );
        }
    }

    // Check if a line segment intersects a rectangle (tile)
    lineIntersectsTile(x1, y1, x2, y2, tileX, tileY) {
        const left = tileX;
        const right = tileX + 1;
        const top = tileY;
        const bottom = tileY + 1;

        // Check if either endpoint is inside the tile
        if ((x1 >= left && x1 < right && y1 >= top && y1 < bottom) ||
            (x2 >= left && x2 < right && y2 >= top && y2 < bottom)) {
            return true;
        }

        // Check if line crosses any of the tile edges
        // Left edge
        if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, top, left, bottom)) return true;
        // Right edge
        if (this.lineSegmentsIntersect(x1, y1, x2, y2, right, top, right, bottom)) return true;
        // Top edge
        if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, top, right, top)) return true;
        // Bottom edge
        if (this.lineSegmentsIntersect(x1, y1, x2, y2, left, bottom, right, bottom)) return true;

        return false;
    }

    // Check if two line segments intersect
    lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
        const d1 = this.direction(x3, y3, x4, y4, x1, y1);
        const d2 = this.direction(x3, y3, x4, y4, x2, y2);
        const d3 = this.direction(x1, y1, x2, y2, x3, y3);
        const d4 = this.direction(x1, y1, x2, y2, x4, y4);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        if (d1 === 0 && this.onSegment(x3, y3, x4, y4, x1, y1)) return true;
        if (d2 === 0 && this.onSegment(x3, y3, x4, y4, x2, y2)) return true;
        if (d3 === 0 && this.onSegment(x1, y1, x2, y2, x3, y3)) return true;
        if (d4 === 0 && this.onSegment(x1, y1, x2, y2, x4, y4)) return true;

        return false;
    }

    direction(xi, yi, xj, yj, xk, yk) {
        return (xk - xi) * (yj - yi) - (xj - xi) * (yk - yi);
    }

    onSegment(xi, yi, xj, yj, xk, yk) {
        return Math.min(xi, xj) <= xk && xk <= Math.max(xi, xj) &&
               Math.min(yi, yj) <= yk && yk <= Math.max(yi, yj);
    }

    // Check if a tile has a river passing through it
    tileHasRiver(tileX, tileY) {
        if (!gameState.map || !gameState.map.rivers) return false;

        const checkPoints = (points) => {
            if (!points || points.length === 0) return false;

            // Check individual points
            for (const point of points) {
                if (point.x >= tileX && point.x < tileX + 1 &&
                    point.y >= tileY && point.y < tileY + 1) {
                    return true;
                }
            }

            // Check line segments between consecutive points
            for (let i = 0; i < points.length - 1; i++) {
                if (this.lineIntersectsTile(
                    points[i].x, points[i].y,
                    points[i + 1].x, points[i + 1].y,
                    tileX, tileY)) {
                    return true;
                }
            }
            return false;
        };

        for (const river of gameState.map.rivers) {
            if (checkPoints(river.points)) return true;

            // Also check delta branches
            if (river.delta) {
                for (const branch of river.delta) {
                    if (checkPoints(branch)) return true;
                }
            }
        }
        return false;
    }

    // Render hover tooltip showing tile info
    renderHoverTooltip() {
        if (!inputHandler || inputHandler.hoverTileX < 0 || inputHandler.hoverTileY < 0) {
            return;
        }

        const tileX = inputHandler.hoverTileX;
        const tileY = inputHandler.hoverTileY;
        const tile = gameState.getTile(tileX, tileY);

        if (!tile) return;

        // Build tooltip text with coordinates
        let tooltipText = `(${tileX},${tileY}) ${tile.terrain}`;

        // Check for river (only use accurate point check, not tile.has_river which includes neighbors)
        if (this.tileHasRiver(tileX, tileY)) {
            tooltipText += ' + River';
        }

        // Check for resource
        if (tile.resource && tile.resource !== '') {
            tooltipText += ' + ' + tile.resource;
        }

        // Get screen position of the tile
        const screen = this.worldToScreen(tileX, tileY);
        const scaledTileSize = this.tileSize * this.camera.zoom;

        // Position tooltip at the center of the tile
        const tooltipX = screen.x + scaledTileSize / 2;
        const tooltipY = screen.y + scaledTileSize / 2;

        const ctx = this.ctx;

        // Set up text style
        ctx.font = `bold ${Math.max(12, scaledTileSize * 0.25)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Measure text for background
        const textWidth = ctx.measureText(tooltipText).width;
        const padding = 4;

        // Draw semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(
            tooltipX - textWidth / 2 - padding,
            tooltipY - 8 - padding,
            textWidth + padding * 2,
            16 + padding * 2
        );

        // Draw text with slight shadow for readability
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(tooltipText, tooltipX, tooltipY);
    }

    // Render movement range overlay
    renderMovementRange(unit) {
        const scaledTileSize = this.tileSize * this.camera.zoom;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const x = unit.x + dx;
                const y = unit.y + dy;

                const tile = gameState.getTile(x, y);
                if (!tile) continue;
                if (tile.terrain === 'Ocean') continue;
                if (tile.terrain === 'Mountains') continue;

                const screen = this.worldToScreen(x, y);

                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                this.ctx.fillRect(screen.x, screen.y, scaledTileSize, scaledTileSize);

                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(screen.x, screen.y, scaledTileSize, scaledTileSize);
            }
        }
    }

    // Render attack range overlay
    renderAttackRange(unit) {
        const scaledTileSize = this.tileSize * this.camera.zoom;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const x = unit.x + dx;
                const y = unit.y + dy;

                // Check for enemies
                const enemies = gameState.getEnemyUnitsAt(x, y);
                const enemyCity = gameState.getCityAt(x, y);
                const hasEnemy = enemies.length > 0 || (enemyCity && enemyCity.owner_id !== gameState.myPlayerId);

                if (hasEnemy) {
                    const screen = this.worldToScreen(x, y);

                    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    this.ctx.fillRect(screen.x, screen.y, scaledTileSize, scaledTileSize);

                    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(screen.x, screen.y, scaledTileSize, scaledTileSize);
                }
            }
        }
    }

    // Render minimap
    renderMinimap() {
        if (!gameState.map) return;

        const ctx = this.minimapCtx;
        const width = this.minimap.width;
        const height = this.minimap.height;

        // Clear with dark ocean color
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, width, height);

        // Calculate scale
        const scaleX = width / gameState.map.width;
        const scaleY = height / gameState.map.height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (width - gameState.map.width * scale) / 2;
        const offsetY = (height - gameState.map.height * scale) / 2;

        // Draw terrain with classic Civ 1 minimap colors
        const minimapColors = {
            'Ocean': '#0040a0',
            'Grassland': '#00a800',
            'Plains': '#c8b040',
            'Desert': '#e8d858',
            'Hills': '#987850',
            'Mountains': '#808080',
            'Forest': '#006800'
        };

        for (let y = 0; y < gameState.map.height; y++) {
            for (let x = 0; x < gameState.map.width; x++) {
                const tile = gameState.getTile(x, y);
                if (!tile) continue;

                ctx.fillStyle = minimapColors[tile.terrain] || '#888';
                ctx.fillRect(
                    offsetX + x * scale,
                    offsetY + y * scale,
                    Math.ceil(scale),
                    Math.ceil(scale)
                );
            }
        }

        // Draw units as visible dots with white outline
        for (const player of gameState.players) {
            if (player.units) {
                for (const unit of player.units) {
                    const unitX = offsetX + unit.x * scale;
                    const unitY = offsetY + unit.y * scale;
                    const unitSize = Math.max(4, scale + 2);

                    // White outline for visibility
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(
                        unitX - 1,
                        unitY - 1,
                        unitSize + 2,
                        unitSize + 2
                    );

                    // Player color fill
                    ctx.fillStyle = player.color;
                    ctx.fillRect(unitX, unitY, unitSize, unitSize);

                    // Blinking effect for current player's units
                    if (player.id === gameState.myPlayerId && Math.floor(Date.now() / 500) % 2 === 0) {
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(
                            unitX + 1,
                            unitY + 1,
                            unitSize - 2,
                            unitSize - 2
                        );
                    }
                }
            }
        }

        // Draw cities as larger squares
        for (const player of gameState.players) {
            for (const city of player.cities) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(
                    offsetX + city.x * scale - 1,
                    offsetY + city.y * scale - 1,
                    Math.max(4, scale + 2),
                    Math.max(4, scale + 2)
                );
                ctx.fillStyle = player.color;
                ctx.fillRect(
                    offsetX + city.x * scale,
                    offsetY + city.y * scale,
                    Math.max(3, scale),
                    Math.max(3, scale)
                );
            }
        }

        // Draw viewport rectangle with classic yellow
        const viewStart = this.screenToWorld(0, 0);
        const viewEnd = this.screenToWorld(this.canvas.width, this.canvas.height);

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            offsetX + viewStart.x * scale,
            offsetY + viewStart.y * scale,
            (viewEnd.x - viewStart.x) * scale,
            (viewEnd.y - viewStart.y) * scale
        );

        // Store minimap transform info for click handling
        this.minimapScale = scale;
        this.minimapOffsetX = offsetX;
        this.minimapOffsetY = offsetY;
    }

    // Handle click on minimap - navigate to that location
    onMinimapClick(e) {
        if (!gameState.map) return;

        const rect = this.minimap.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert minimap coordinates to world coordinates
        const scale = this.minimapScale || 1;
        const offsetX = this.minimapOffsetX || 0;
        const offsetY = this.minimapOffsetY || 0;

        const worldX = (clickX - offsetX) / scale;
        const worldY = (clickY - offsetY) / scale;

        // Center camera on clicked location
        if (worldX >= 0 && worldX < gameState.map.width &&
            worldY >= 0 && worldY < gameState.map.height) {
            this.centerOn(worldX, worldY);
        }
    }

    // Camera controls
    pan(dx, dy) {
        this.camera.x += dx / this.camera.zoom;
        this.camera.y += dy / this.camera.zoom;
        this.clampCamera();
    }

    zoom(delta, centerX, centerY) {
        const oldZoom = this.camera.zoom;
        this.camera.zoom *= (1 + delta * Config.CAMERA.ZOOM_SPEED);
        this.camera.zoom = Math.max(Config.CAMERA.MIN_ZOOM, Math.min(Config.CAMERA.MAX_ZOOM, this.camera.zoom));

        // Zoom toward mouse position
        const zoomRatio = this.camera.zoom / oldZoom;
        this.camera.x += centerX / oldZoom * (1 - zoomRatio);
        this.camera.y += centerY / oldZoom * (1 - zoomRatio);

        this.clampCamera();
    }

    centerOn(x, y) {
        if (!gameState.map) return;

        this.camera.x = x * this.tileSize - this.canvas.width / (2 * this.camera.zoom);
        this.camera.y = y * this.tileSize - this.canvas.height / (2 * this.camera.zoom);
        this.clampCamera();
    }

    clampCamera() {
        if (!gameState.map) return;

        const maxX = gameState.map.width * this.tileSize - this.canvas.width / this.camera.zoom;
        const maxY = gameState.map.height * this.tileSize - this.canvas.height / this.camera.zoom;

        this.camera.x = Math.max(0, Math.min(maxX, this.camera.x));
        this.camera.y = Math.max(0, Math.min(maxY, this.camera.y));
    }
}

// Global renderer instance (created in main.js)
let renderer = null;
