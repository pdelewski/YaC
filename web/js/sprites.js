// Sprite loader and manager for unit and terrain graphics
class SpriteManager {
    constructor() {
        this.sprites = {};
        this.terrain = {};
        this.loaded = false;
        this.terrainLoaded = false;
        this.loadPromise = null;
    }

    // Load all sprites (units and terrain)
    loadAll() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        const unitTypes = ['settler', 'warrior', 'phalanx', 'archer', 'horseman', 'catapult'];
        const terrainTypes = ['ocean', 'grassland', 'plains', 'desert', 'hills', 'mountains', 'forest'];
        const loadPromises = [];

        for (const unitType of unitTypes) {
            loadPromises.push(this.loadSprite(unitType, `assets/units/${unitType}.png`));
        }

        for (const terrainType of terrainTypes) {
            loadPromises.push(this.loadTerrain(terrainType, `assets/terrain/${terrainType}.png`));
        }

        this.loadPromise = Promise.all(loadPromises).then(() => {
            this.loaded = true;
            this.terrainLoaded = true;
            console.log('All sprites and terrain loaded successfully');
        }).catch(err => {
            console.warn('Some assets failed to load, using fallback rendering:', err);
        });

        return this.loadPromise;
    }

    // Load a single sprite
    loadSprite(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.sprites[name] = img;
                console.log(`Loaded sprite: ${name}`);
                resolve(img);
            };
            img.onerror = (err) => {
                console.warn(`Failed to load sprite: ${name}`);
                reject(err);
            };
            img.src = path;
        });
    }

    // Load a terrain tile
    loadTerrain(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.terrain[name] = img;
                console.log(`Loaded terrain: ${name}`);
                resolve(img);
            };
            img.onerror = (err) => {
                console.warn(`Failed to load terrain: ${name}`);
                reject(err);
            };
            img.src = path;
        });
    }

    // Get a sprite by unit type name
    getSprite(unitType) {
        const key = unitType.toLowerCase();
        return this.sprites[key] || null;
    }

    // Get a terrain tile by terrain type name
    getTerrain(terrainType) {
        const key = terrainType.toLowerCase();
        return this.terrain[key] || null;
    }

    // Check if sprites are ready
    isReady() {
        return this.loaded;
    }

    // Check if terrain is ready
    isTerrainReady() {
        return this.terrainLoaded;
    }
}

// Global sprite manager instance
let spriteManager = null;
