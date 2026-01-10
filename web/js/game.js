// Game state manager
class GameState {
    constructor() {
        this.id = null;
        this.turn = 0;
        this.currentPlayerId = null;
        this.phase = 'setup';
        this.map = null;
        this.players = [];
        this.myPlayerId = null;
        this.winner = null;

        // Selection state
        this.selectedUnit = null;
        this.selectedCity = null;

        // Input mode
        this.mode = 'normal'; // 'normal', 'move', 'attack'
    }

    // Update state from server
    updateFromServer(data) {
        this.id = data.id;
        this.turn = data.turn;
        this.currentPlayerId = data.current_player;
        this.phase = data.phase;
        this.map = this.processMap(data.map);
        this.players = data.players;
        this.winner = data.winner;

        // Find my player (the human player)
        const humanPlayer = this.players.find(p => p.is_human);
        if (humanPlayer) {
            this.myPlayerId = humanPlayer.id;
        }

        // Clear selection if unit no longer exists
        if (this.selectedUnit) {
            const unit = this.getUnit(this.selectedUnit.id);
            if (!unit) {
                this.selectedUnit = null;
            } else {
                this.selectedUnit = unit;
            }
        }

        // Auto-select first available unit if none selected and it's my turn
        if (!this.selectedUnit && this.isMyTurn()) {
            const myPlayer = this.getMyPlayer();
            if (myPlayer && myPlayer.units.length > 0) {
                // Prefer units that can still move
                const activeUnit = myPlayer.units.find(u => u.movement_left > 0 && !u.is_fortified);
                if (activeUnit) {
                    this.selectedUnit = activeUnit;
                } else {
                    // Otherwise select first unit
                    this.selectedUnit = myPlayer.units[0];
                }
            }
        }
    }

    // Process map data into a 2D array for faster access
    processMap(mapData) {
        if (!mapData) return null;

        const tiles = new Array(mapData.height);
        for (let y = 0; y < mapData.height; y++) {
            tiles[y] = new Array(mapData.width);
        }

        // Count tiles with rivers for debugging
        let riverTileCount = 0;
        for (const tile of mapData.tiles) {
            tiles[tile.y][tile.x] = tile;
            if (tile.has_river) {
                riverTileCount++;
            }
        }
        console.log('Tiles with rivers:', riverTileCount);
        console.log('Number of river paths:', mapData.rivers ? mapData.rivers.length : 0);

        return {
            width: mapData.width,
            height: mapData.height,
            tiles: tiles,
            rivers: mapData.rivers || []
        };
    }

    // Get tile at coordinates
    getTile(x, y) {
        if (!this.map) return null;
        if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return null;
        return this.map.tiles[y][x];
    }

    // Get my player
    getMyPlayer() {
        return this.players.find(p => p.id === this.myPlayerId);
    }

    // Check if it's my turn
    isMyTurn() {
        return this.currentPlayerId === this.myPlayerId && this.phase === 'player_turn';
    }

    // Get unit by ID
    getUnit(unitId) {
        for (const player of this.players) {
            for (const unit of player.units) {
                if (unit.id === unitId) {
                    return unit;
                }
            }
        }
        return null;
    }

    // Get city by ID
    getCity(cityId) {
        for (const player of this.players) {
            for (const city of player.cities) {
                if (city.id === cityId) {
                    return city;
                }
            }
        }
        return null;
    }

    // Get all units at a position
    getUnitsAt(x, y) {
        const units = [];
        for (const player of this.players) {
            for (const unit of player.units) {
                if (unit.x === x && unit.y === y) {
                    units.push({ ...unit, playerColor: player.color });
                }
            }
        }
        return units;
    }

    // Get city at a position
    getCityAt(x, y) {
        for (const player of this.players) {
            for (const city of player.cities) {
                if (city.x === x && city.y === y) {
                    return { ...city, playerColor: player.color };
                }
            }
        }
        return null;
    }

    // Get my units at a position
    getMyUnitsAt(x, y) {
        const myPlayer = this.getMyPlayer();
        if (!myPlayer) return [];
        return myPlayer.units.filter(u => u.x === x && u.y === y);
    }

    // Get enemy units at a position
    getEnemyUnitsAt(x, y) {
        const units = [];
        for (const player of this.players) {
            if (player.id !== this.myPlayerId) {
                for (const unit of player.units) {
                    if (unit.x === x && unit.y === y) {
                        units.push({ ...unit, playerColor: player.color });
                    }
                }
            }
        }
        return units;
    }

    // Get player by ID
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    // Get player color
    getPlayerColor(playerId) {
        const player = this.getPlayer(playerId);
        return player ? player.color : '#888';
    }

    // Select a unit
    selectUnit(unit) {
        this.selectedUnit = unit;
        this.selectedCity = null;
        this.mode = 'normal';
    }

    // Select a city
    selectCity(city) {
        this.selectedCity = city;
        this.selectedUnit = null;
        this.mode = 'normal';
    }

    // Clear selection
    clearSelection() {
        this.selectedUnit = null;
        this.selectedCity = null;
        this.mode = 'normal';
    }

    // Set input mode
    setMode(mode) {
        this.mode = mode;
    }

    // Check if a tile is adjacent to selected unit
    isAdjacentToSelected(x, y) {
        if (!this.selectedUnit) return false;
        const dx = Math.abs(x - this.selectedUnit.x);
        const dy = Math.abs(y - this.selectedUnit.y);
        return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
    }

    // Check if unit can move
    canUnitMove(unit) {
        return unit && unit.movement_left > 0 && !unit.is_fortified;
    }

    // Check if there are units that can still act
    hasActiveUnits() {
        const myPlayer = this.getMyPlayer();
        if (!myPlayer) return false;
        return myPlayer.units.some(u => u.movement_left > 0 && !u.is_fortified);
    }

    // Get count of active units
    getActiveUnitsCount() {
        const myPlayer = this.getMyPlayer();
        if (!myPlayer) return 0;
        return myPlayer.units.filter(u => u.movement_left > 0 && !u.is_fortified).length;
    }

    // Check if selected unit can found city
    canFoundCity() {
        if (!this.selectedUnit) return false;
        if (!this.selectedUnit.can_found_city) return false;

        // Check terrain
        const tile = this.getTile(this.selectedUnit.x, this.selectedUnit.y);
        if (!tile) return false;
        if (tile.terrain === 'Ocean' || tile.terrain === 'Mountains') return false;

        // Check for existing city
        const city = this.getCityAt(this.selectedUnit.x, this.selectedUnit.y);
        if (city) return false;

        return true;
    }
}

// Global game state
const gameState = new GameState();
