// Input handler
class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Hover state for tooltip
        this.hoverTileX = -1;
        this.hoverTileY = -1;
        this.hoverScreenX = 0;
        this.hoverScreenY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());

        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onMouseDown(e) {
        if (e.button === 2) {
            // Right click - start dragging
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        } else if (e.button === 0) {
            // Left click - select or action
            this.onClick(e);
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Update hover position for tooltip
        this.hoverScreenX = screenX;
        this.hoverScreenY = screenY;

        if (renderer && gameState.map) {
            const world = renderer.screenToWorld(screenX, screenY);
            if (world.x >= 0 && world.x < gameState.map.width &&
                world.y >= 0 && world.y < gameState.map.height) {
                this.hoverTileX = world.x;
                this.hoverTileY = world.y;
            } else {
                this.hoverTileX = -1;
                this.hoverTileY = -1;
            }
        }

        if (this.isDragging) {
            const dx = this.lastMouseX - e.clientX;
            const dy = this.lastMouseY - e.clientY;
            renderer.pan(dx, dy);
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        }
    }

    onMouseUp(e) {
        if (e.button === 2) {
            this.isDragging = false;
        }
    }

    onMouseLeave() {
        this.hoverTileX = -1;
        this.hoverTileY = -1;
    }

    onWheel(e) {
        e.preventDefault();

        // Use scroll wheel/touchpad for panning
        const panSpeed = 1.5;
        renderer.pan(e.deltaX * panSpeed, e.deltaY * panSpeed);
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = renderer.screenToWorld(screenX, screenY);

        // Check bounds
        if (!gameState.map || world.x < 0 || world.x >= gameState.map.width ||
            world.y < 0 || world.y >= gameState.map.height) {
            return;
        }

        // Handle based on current mode
        switch (gameState.mode) {
            case 'move':
                this.handleMoveClick(world.x, world.y);
                break;
            case 'attack':
                this.handleAttackClick(world.x, world.y);
                break;
            default:
                this.handleNormalClick(world.x, world.y);
        }
    }

    handleNormalClick(x, y) {
        // Check for my units at this location
        const myUnits = gameState.getMyUnitsAt(x, y);
        if (myUnits.length > 0) {
            // Select the first unit
            gameState.selectUnit(myUnits[0]);
            ui.updateSelectionPanel();
            return;
        }

        // Check for my city at this location
        const city = gameState.getCityAt(x, y);
        if (city && city.owner_id === gameState.myPlayerId) {
            gameState.selectCity(city);
            ui.updateSelectionPanel();
            ui.showCityModal(city);
            return;
        }

        // Click on empty tile - clear selection
        gameState.clearSelection();
        ui.updateSelectionPanel();
    }

    handleMoveClick(x, y) {
        if (!gameState.selectedUnit) {
            gameState.setMode('normal');
            return;
        }

        // Check if valid move (adjacent)
        if (!gameState.isAdjacentToSelected(x, y)) {
            gameState.setMode('normal');
            return;
        }

        // Check terrain
        const tile = gameState.getTile(x, y);
        if (!tile || tile.terrain === 'Ocean' || tile.terrain === 'Mountains') {
            gameState.setMode('normal');
            return;
        }

        // Send move action
        gameSocket.moveUnit(gameState.selectedUnit.id, x, y);
        gameState.setMode('normal');
    }

    handleAttackClick(x, y) {
        if (!gameState.selectedUnit) {
            gameState.setMode('normal');
            return;
        }

        // Check if valid attack (adjacent)
        if (!gameState.isAdjacentToSelected(x, y)) {
            gameState.setMode('normal');
            return;
        }

        // Check for enemies
        const enemies = gameState.getEnemyUnitsAt(x, y);
        const enemyCity = gameState.getCityAt(x, y);
        const hasEnemy = enemies.length > 0 || (enemyCity && enemyCity.owner_id !== gameState.myPlayerId);

        if (!hasEnemy) {
            gameState.setMode('normal');
            return;
        }

        // Send attack action
        gameSocket.attackUnit(gameState.selectedUnit.id, x, y);
        gameState.setMode('normal');
    }

    // Try to move or attack in a direction (like original Civ)
    tryMoveOrAttack(dx, dy) {
        if (!gameState.selectedUnit || !gameState.isMyTurn()) return false;
        if (!gameState.canUnitMove(gameState.selectedUnit)) return false;

        const unit = gameState.selectedUnit;
        const newX = unit.x + dx;
        const newY = unit.y + dy;

        // Check bounds
        if (!gameState.map || newX < 0 || newX >= gameState.map.width ||
            newY < 0 || newY >= gameState.map.height) {
            return false;
        }

        // Check for enemies - attack if present
        const enemies = gameState.getEnemyUnitsAt(newX, newY);
        const enemyCity = gameState.getCityAt(newX, newY);
        const hasEnemy = enemies.length > 0 || (enemyCity && enemyCity.owner_id !== gameState.myPlayerId);

        if (hasEnemy) {
            gameSocket.attackUnit(unit.id, newX, newY);
            return true;
        }

        // Check terrain for movement
        const tile = gameState.getTile(newX, newY);
        if (!tile || tile.terrain === 'Ocean' || tile.terrain === 'Mountains') {
            return false;
        }

        // Move the unit
        gameSocket.moveUnit(unit.id, newX, newY);
        return true;
    }

    onKeyDown(e) {
        // Don't handle if typing in input
        if (e.target.tagName === 'INPUT') return;

        // Direction keys for unit movement (like original Civ)
        // Numpad: 7=NW, 8=N, 9=NE, 4=W, 6=E, 1=SW, 2=S, 3=SE
        // Arrow keys: move in 4 directions
        const directionKeys = {
            // Numpad
            'Numpad7': { dx: -1, dy: -1 },
            'Numpad8': { dx: 0, dy: -1 },
            'Numpad9': { dx: 1, dy: -1 },
            'Numpad4': { dx: -1, dy: 0 },
            'Numpad6': { dx: 1, dy: 0 },
            'Numpad1': { dx: -1, dy: 1 },
            'Numpad2': { dx: 0, dy: 1 },
            'Numpad3': { dx: 1, dy: 1 },
            // Arrow keys (when unit selected)
            'ArrowUp': { dx: 0, dy: -1 },
            'ArrowDown': { dx: 0, dy: 1 },
            'ArrowLeft': { dx: -1, dy: 0 },
            'ArrowRight': { dx: 1, dy: 0 },
        };

        // Shift+Arrow always pans camera
        if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
            const panAmount = Config.CAMERA.PAN_SPEED * 5;
            switch (e.code) {
                case 'ArrowUp': renderer.pan(0, -panAmount); break;
                case 'ArrowDown': renderer.pan(0, panAmount); break;
                case 'ArrowLeft': renderer.pan(-panAmount, 0); break;
                case 'ArrowRight': renderer.pan(panAmount, 0); break;
            }
            return;
        }

        // Arrow keys without shift: move unit if selected, otherwise pan camera
        if (directionKeys[e.code]) {
            e.preventDefault();
            const dir = directionKeys[e.code];

            // If unit selected and it's my turn, try to move/attack
            if (gameState.selectedUnit && gameState.isMyTurn() && gameState.canUnitMove(gameState.selectedUnit)) {
                if (this.tryMoveOrAttack(dir.dx, dir.dy)) {
                    return;
                }
            }

            // Otherwise pan camera (for arrow keys only, not numpad)
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                const panAmount = Config.CAMERA.PAN_SPEED * 5;
                renderer.pan(dir.dx * panAmount, dir.dy * panAmount);
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                gameState.clearSelection();
                gameState.setMode('normal');
                ui.hideCityModal();
                ui.updateSelectionPanel();
                break;

            case 'f':
            case 'F':
                if (gameState.selectedUnit && !gameState.selectedUnit.can_found_city) {
                    gameSocket.fortifyUnit(gameState.selectedUnit.id);
                }
                break;

            case 'b':
            case 'B':
                if (gameState.selectedUnit && gameState.canFoundCity()) {
                    const name = prompt('Enter city name:', 'New City');
                    if (name) {
                        gameSocket.foundCity(gameState.selectedUnit.id, name);
                    }
                }
                break;

            case 's':
            case 'S':
            case ' ': // Space bar to skip
                if (gameState.selectedUnit) {
                    gameSocket.skipUnit(gameState.selectedUnit.id);
                }
                break;

            case 'Enter':
                if (gameState.isMyTurn()) {
                    gameSocket.endTurn();
                }
                break;

            // Camera panning with WASD (always works)
            case 'w':
            case 'W':
                renderer.pan(0, -Config.CAMERA.PAN_SPEED * 5);
                break;
            case 'a':
            case 'A':
                renderer.pan(-Config.CAMERA.PAN_SPEED * 5, 0);
                break;
            case 's':
                // 's' already handled above for skip, but if no unit selected, pan
                if (!gameState.selectedUnit) {
                    renderer.pan(0, Config.CAMERA.PAN_SPEED * 5);
                }
                break;
            case 'd':
            case 'D':
                renderer.pan(Config.CAMERA.PAN_SPEED * 5, 0);
                break;

            // Center on selected
            case 'c':
            case 'C':
                if (gameState.selectedUnit) {
                    renderer.centerOn(gameState.selectedUnit.x, gameState.selectedUnit.y);
                } else if (gameState.selectedCity) {
                    renderer.centerOn(gameState.selectedCity.x, gameState.selectedCity.y);
                }
                break;

            // Home - center on first unit
            case 'h':
            case 'H':
                const myPlayer = gameState.getMyPlayer();
                if (myPlayer && myPlayer.units && myPlayer.units.length > 0) {
                    const unit = myPlayer.units[0];
                    renderer.centerOn(unit.x, unit.y);
                }
                break;

            // Next unit with movement left
            case 'n':
            case 'N':
            case 'Tab':
                e.preventDefault();
                this.selectNextUnit();
                break;
        }
    }

    // Select next unit with movement remaining
    selectNextUnit() {
        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.units || myPlayer.units.length === 0) return;

        const unitsWithMovement = myPlayer.units.filter(u => u.movement_left > 0 && !u.is_fortified);
        if (unitsWithMovement.length === 0) return;

        // Find current unit index
        let currentIndex = -1;
        if (gameState.selectedUnit) {
            currentIndex = unitsWithMovement.findIndex(u => u.id === gameState.selectedUnit.id);
        }

        // Select next unit (wrap around)
        const nextIndex = (currentIndex + 1) % unitsWithMovement.length;
        const nextUnit = unitsWithMovement[nextIndex];

        gameState.selectUnit(nextUnit);
        renderer.centerOn(nextUnit.x, nextUnit.y);
        ui.updateSelectionPanel();
    }
}

// Global input handler (created in main.js)
let inputHandler = null;
