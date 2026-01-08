// Game configuration constants
const Config = {
    // Tile rendering
    TILE_SIZE: 32,

    // Map sizes
    MAP_SIZES: {
        small: { width: 60, height: 40 },
        medium: { width: 80, height: 50 },
        large: { width: 100, height: 60 }
    },

    // Terrain colors (Classic Civ 1 style)
    TERRAIN_COLORS: {
        'Ocean': '#1a4a6e',
        'Grassland': '#3a7a3a',
        'Plains': '#8b8b5a',
        'Desert': '#c4a860',
        'Hills': '#6b5a42',
        'Mountains': '#5a5a5a',
        'Forest': '#2a5a2a'
    },

    // Player colors (matching server)
    PLAYER_COLORS: [
        '#FF0000', // Red
        '#0000FF', // Blue
        '#00FF00', // Green
        '#FFFF00', // Yellow
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFA500', // Orange
        '#800080'  // Purple
    ],

    // Unit type indices (matching server)
    UNIT_TYPES: {
        SETTLER: 0,
        WARRIOR: 1,
        PHALANX: 2,
        ARCHER: 3,
        HORSEMAN: 4,
        CATAPULT: 5
    },

    // Building type indices (matching server)
    BUILDING_TYPES: {
        NONE: 0,
        BARRACKS: 1,
        GRANARY: 2,
        WALLS: 3,
        MARKETPLACE: 4,
        LIBRARY: 5
    },

    // Production options
    PRODUCTION_OPTIONS: {
        units: [
            { type: 0, name: 'Settler', cost: 40 },
            { type: 1, name: 'Warrior', cost: 10 },
            { type: 2, name: 'Phalanx', cost: 20 },
            { type: 3, name: 'Archer', cost: 20 },
            { type: 4, name: 'Horseman', cost: 20 },
            { type: 5, name: 'Catapult', cost: 40 }
        ],
        buildings: [
            { type: 1, name: 'Barracks', cost: 40 },
            { type: 2, name: 'Granary', cost: 60 },
            { type: 3, name: 'Walls', cost: 80 },
            { type: 4, name: 'Marketplace', cost: 80 },
            { type: 5, name: 'Library', cost: 80 }
        ]
    },

    // Camera settings
    CAMERA: {
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 2.0,
        ZOOM_SPEED: 0.1,
        PAN_SPEED: 10
    },

    // API endpoints
    API: {
        NEW_GAME: '/api/game/new',
        GET_GAME: '/api/game',
        WEBSOCKET: `ws://${window.location.host}/ws`
    }
};
