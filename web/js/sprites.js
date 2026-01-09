// Sprite loader and manager for unit and terrain graphics
class SpriteManager {
    constructor() {
        this.sprites = {};
        this.terrain = {};
        this.transitions = {};
        this.loaded = false;
        this.terrainLoaded = false;
        this.transitionsLoaded = false;
        this.loadPromise = null;
    }

    // Load all sprites (units, terrain, and transitions)
    loadAll() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        const unitTypes = ['settler', 'warrior', 'phalanx', 'archer', 'horseman', 'catapult'];
        const terrainTypes = ['ocean', 'grassland', 'plains', 'desert', 'hills', 'mountains', 'forest'];
        const transitionTypes = [
            // Ocean transitions (no forest - forest only borders grassland)
            'ocean_grassland_h',
            'ocean_plains_h',
            'ocean_desert_h',
            'ocean_hills_h',
            'ocean_mountains_h',
            // Grassland transitions (no forest - forest has grassland background)
            'grassland_plains_h',
            'grassland_desert_h',
            'grassland_hills_h',
            'grassland_mountains_h',
            // Plains transitions
            'plains_desert_h',
            'plains_hills_h',
            'plains_mountains_h',
            // Desert transitions
            'desert_hills_h',
            'desert_mountains_h',
            // Hills transitions
            'hills_mountains_h'
        ];
        const loadPromises = [];

        for (const unitType of unitTypes) {
            loadPromises.push(this.loadSprite(unitType, `assets/units/${unitType}.png`));
        }

        for (const terrainType of terrainTypes) {
            loadPromises.push(this.loadTerrain(terrainType, `assets/terrain/${terrainType}.png`));
        }

        for (const transType of transitionTypes) {
            loadPromises.push(this.loadTransition(transType, `assets/terrain/transitions/${transType}.png`));
        }

        this.loadPromise = Promise.all(loadPromises).then(() => {
            this.loaded = true;
            this.terrainLoaded = true;
            this.transitionsLoaded = true;
            console.log('All sprites, terrain and transitions loaded successfully');
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

    // Load a transition tile
    loadTransition(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.transitions[name] = img;
                console.log(`Loaded transition: ${name}`);
                resolve(img);
            };
            img.onerror = (err) => {
                console.warn(`Failed to load transition: ${name}`);
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

    // Get a transition tile for two adjacent terrain types
    // Returns { tile, flipH, flipV } or null
    getTransition(terrain1, terrain2, direction) {
        const t1 = terrain1.toLowerCase();
        const t2 = terrain2.toLowerCase();

        // Try both orderings
        let key = `${t1}_${t2}_h`;
        let flip = false;

        if (!this.transitions[key]) {
            key = `${t2}_${t1}_h`;
            flip = true;
        }

        if (this.transitions[key]) {
            return { tile: this.transitions[key], flip: flip };
        }
        return null;
    }

    // Check if sprites are ready
    isReady() {
        return this.loaded;
    }

    // Check if terrain is ready
    isTerrainReady() {
        return this.terrainLoaded;
    }

    // Check if transitions are ready
    isTransitionsReady() {
        return this.transitionsLoaded;
    }
}

// Global sprite manager instance
let spriteManager = null;
