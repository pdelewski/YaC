// Sprite loader and manager for unit graphics
class SpriteManager {
    constructor() {
        this.sprites = {};
        this.loaded = false;
        this.loadPromise = null;
    }

    // Load all unit sprites
    loadAll() {
        if (this.loadPromise) {
            return this.loadPromise;
        }

        const unitTypes = ['settler', 'warrior', 'phalanx', 'archer', 'horseman', 'catapult'];
        const loadPromises = [];

        for (const unitType of unitTypes) {
            loadPromises.push(this.loadSprite(unitType, `assets/units/${unitType}.png`));
        }

        this.loadPromise = Promise.all(loadPromises).then(() => {
            this.loaded = true;
            console.log('All sprites loaded successfully');
        }).catch(err => {
            console.warn('Some sprites failed to load, using fallback rendering:', err);
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

    // Get a sprite by unit type name
    getSprite(unitType) {
        const key = unitType.toLowerCase();
        return this.sprites[key] || null;
    }

    // Check if sprites are ready
    isReady() {
        return this.loaded;
    }
}

// Global sprite manager instance
let spriteManager = null;
