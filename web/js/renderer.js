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
                    this.drawRoad(screen.x, screen.y, s);
                }
            }
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

    // Draw road improvement
    drawRoad(x, y, s) {
        const ctx = this.ctx;

        // Brown road (cross pattern like Civ 1)
        ctx.fillStyle = '#806040';
        ctx.fillRect(x + s * 0.4, y, s * 0.2, s);
        ctx.fillRect(x, y + s * 0.4, s, s * 0.2);
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

            // Highlight
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
                screen.x + 2,
                screen.y + 2,
                scaledTileSize - 4,
                scaledTileSize - 4
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

            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(
                screen.x + 2,
                screen.y + 2,
                scaledTileSize - 4,
                scaledTileSize - 4
            );
        }
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

                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                this.ctx.fillRect(screen.x, screen.y, scaledTileSize, scaledTileSize);

                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
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
