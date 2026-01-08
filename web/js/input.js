// Input handler
class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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

    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -1 : 1;
        renderer.zoom(delta, centerX, centerY);
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

    onKeyDown(e) {
        // Don't handle if typing in input
        if (e.target.tagName === 'INPUT') return;

        switch (e.key) {
            case 'Escape':
                gameState.clearSelection();
                gameState.setMode('normal');
                ui.hideCityModal();
                ui.updateSelectionPanel();
                break;

            case 'm':
            case 'M':
                if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                    gameState.setMode('move');
                    ui.updateModeButtons();
                }
                break;

            case 'a':
            case 'A':
                if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                    gameState.setMode('attack');
                    ui.updateModeButtons();
                }
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
                if (gameState.selectedUnit) {
                    gameSocket.skipUnit(gameState.selectedUnit.id);
                }
                break;

            case 'Enter':
                if (gameState.isMyTurn()) {
                    gameSocket.endTurn();
                }
                break;

            // Camera movement with arrow keys
            case 'ArrowUp':
                renderer.pan(0, -Config.CAMERA.PAN_SPEED * 5);
                break;
            case 'ArrowDown':
                renderer.pan(0, Config.CAMERA.PAN_SPEED * 5);
                break;
            case 'ArrowLeft':
                renderer.pan(-Config.CAMERA.PAN_SPEED * 5, 0);
                break;
            case 'ArrowRight':
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
                    console.log('Centering on first unit at', unit.x, unit.y);
                    renderer.centerOn(unit.x, unit.y);
                } else {
                    console.log('No units to center on. Players:', gameState.players);
                }
                break;
        }
    }
}

// Global input handler (created in main.js)
let inputHandler = null;
