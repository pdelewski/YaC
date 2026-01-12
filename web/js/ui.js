// UI manager
class UI {
    constructor() {
        // Cache DOM elements
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.turnNumber = document.getElementById('turn-number');
        this.currentPlayer = document.getElementById('current-player');
        this.goldDisplay = document.getElementById('gold-display');
        this.endTurnBtn = document.getElementById('end-turn-btn');
        this.selectionInfo = document.getElementById('selection-info');
        this.unitActions = document.getElementById('unit-actions');

        // City modal
        this.cityModal = document.getElementById('city-modal');
        this.cityName = document.getElementById('city-name');
        this.cityPop = document.getElementById('city-pop');
        this.cityFood = document.getElementById('city-food');
        this.cityFoodNeeded = document.getElementById('city-food-needed');
        this.cityProd = document.getElementById('city-prod');
        this.cityProdNeeded = document.getElementById('city-prod-needed');
        this.cityBuildingList = document.getElementById('city-building-list');
        this.garrisonUnits = document.getElementById('garrison-units');
        this.productionOptions = document.getElementById('production-options');

        // Game over modal
        this.gameOverModal = document.getElementById('game-over-modal');
        this.gameOverTitle = document.getElementById('game-over-title');
        this.gameOverMessage = document.getElementById('game-over-message');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Start game button
        document.getElementById('start-game').addEventListener('click', () => this.startGame());

        // End turn button
        this.endTurnBtn.addEventListener('click', () => {
            this.tryEndTurn();
        });

        // Unit action buttons
        document.getElementById('btn-move').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                // Toggle mode - if already in move mode, go back to select mode
                if (gameState.mode === 'move') {
                    gameState.setMode('select');
                } else {
                    gameState.setMode('move');
                }
                this.updateModeButtons();
            }
        });

        document.getElementById('btn-attack').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                // Toggle mode - if already in attack mode, go back to select mode
                if (gameState.mode === 'attack') {
                    gameState.setMode('select');
                } else {
                    gameState.setMode('attack');
                }
                this.updateModeButtons();
            }
        });

        document.getElementById('btn-fortify').addEventListener('click', () => {
            if (gameState.selectedUnit) {
                gameSocket.fortifyUnit(gameState.selectedUnit.id);
            }
        });

        document.getElementById('btn-unfortify').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.selectedUnit.is_fortified) {
                gameSocket.unfortifyUnit(gameState.selectedUnit.id);
            }
        });

        document.getElementById('btn-found-city').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.canFoundCity()) {
                const name = prompt('Enter city name:', 'New City');
                if (name) {
                    gameSocket.foundCity(gameState.selectedUnit.id, name);
                }
            }
        });

        document.getElementById('btn-skip').addEventListener('click', () => {
            if (gameState.selectedUnit) {
                gameSocket.skipUnit(gameState.selectedUnit.id);
            }
        });

        document.getElementById('btn-build-road').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.selectedUnit.can_found_city) {
                gameSocket.buildRoad(gameState.selectedUnit.id);
            }
        });

        // Group button
        document.getElementById('btn-group').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.isMyTurn()) {
                const myUnits = gameState.getMyUnitsAt(gameState.selectedUnit.x, gameState.selectedUnit.y);
                const ungroupedUnits = myUnits.filter(u => !u.group_id);
                if (ungroupedUnits.length >= 2) {
                    gameSocket.groupUnits(ungroupedUnits.map(u => u.id));
                }
            }
        });

        // Ungroup button
        document.getElementById('btn-ungroup').addEventListener('click', () => {
            if (gameState.isMyTurn()) {
                if (gameState.selectedGroup) {
                    gameSocket.ungroupUnits(gameState.selectedGroup);
                    gameState.selectedGroup = null;
                } else if (gameState.selectedUnit && gameState.selectedUnit.group_id) {
                    gameSocket.ungroupUnits(gameState.selectedUnit.group_id);
                }
            }
        });

        // Goto button
        document.getElementById('btn-goto').addEventListener('click', () => {
            if ((gameState.selectedUnit || gameState.selectedGroup) && gameState.isMyTurn()) {
                if (gameState.mode === 'goto') {
                    gameState.setMode('normal');
                } else {
                    gameState.setMode('goto');
                }
                this.updateModeButtons();
            }
        });

        // City modal close
        this.cityModal.querySelector('.close-btn').addEventListener('click', () => {
            this.hideCityModal();
        });

        // New game button (from game over)
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.hideGameOverModal();
            this.showStartScreen();
        });

        // Menu handlers
        document.getElementById('menu-new').addEventListener('click', () => {
            if (confirm('Start a new game? Current progress will be lost.')) {
                this.showStartScreen();
            }
        });

        document.getElementById('menu-open').addEventListener('click', () => {
            this.openSaveFile();
        });

        document.getElementById('menu-save').addEventListener('click', () => {
            this.saveGame();
        });

        document.getElementById('menu-quit').addEventListener('click', () => {
            if (confirm('Quit to main menu?')) {
                this.showStartScreen();
            }
        });

        document.getElementById('menu-center-unit').addEventListener('click', () => {
            if (gameState.selectedUnit) {
                renderer.centerOn(gameState.selectedUnit.x, gameState.selectedUnit.y);
            }
        });

        document.getElementById('menu-find-city').addEventListener('click', () => {
            const myPlayer = gameState.getMyPlayer();
            if (myPlayer && myPlayer.cities && myPlayer.cities.length > 0) {
                const city = myPlayer.cities[0];
                renderer.centerOn(city.x, city.y);
            }
        });

        document.getElementById('menu-view-units').addEventListener('click', () => {
            this.showUnitsGallery();
        });

        document.getElementById('menu-view-resources').addEventListener('click', () => {
            this.showResourcesGallery();
        });

        document.getElementById('menu-view-goto').addEventListener('click', () => {
            this.showGotoDashboard();
        });

        document.getElementById('menu-view-cities').addEventListener('click', () => {
            this.showCitiesDashboard();
        });

        document.getElementById('menu-view-units-dashboard').addEventListener('click', () => {
            this.showUnitsDashboard();
        });

        document.getElementById('units-modal-close').addEventListener('click', () => {
            document.getElementById('units-modal').classList.add('hidden');
        });

        document.getElementById('goto-modal-close').addEventListener('click', () => {
            document.getElementById('goto-modal').classList.add('hidden');
        });

        document.getElementById('cities-modal-close').addEventListener('click', () => {
            document.getElementById('cities-modal').classList.add('hidden');
        });

        document.getElementById('units-dashboard-modal-close').addEventListener('click', () => {
            document.getElementById('units-dashboard-modal').classList.add('hidden');
        });

        document.getElementById('resources-modal-close').addEventListener('click', () => {
            document.getElementById('resources-modal').classList.add('hidden');
        });

        // Orders menu handlers
        document.getElementById('menu-new-order').addEventListener('click', () => {
            this.showNewOrderModal();
        });

        document.getElementById('menu-orders-dashboard').addEventListener('click', () => {
            this.showOrdersDashboard();
        });

        document.getElementById('new-order-modal-close').addEventListener('click', () => {
            document.getElementById('new-order-modal').classList.add('hidden');
            this.currentEditingOrder = null;
        });

        document.getElementById('orders-dashboard-modal-close').addEventListener('click', () => {
            document.getElementById('orders-dashboard-modal').classList.add('hidden');
        });

        document.getElementById('order-detail-modal-close').addEventListener('click', () => {
            document.getElementById('order-detail-modal').classList.add('hidden');
        });

        document.getElementById('btn-save-order').addEventListener('click', () => {
            this.saveCurrentOrder();
        });

        document.getElementById('btn-cancel-order').addEventListener('click', () => {
            document.getElementById('new-order-modal').classList.add('hidden');
            this.currentEditingOrder = null;
        });

        document.getElementById('step-type-select').addEventListener('change', (e) => {
            this.showStepParamsForm(e.target.value);
        });

        // Toolbar handlers
        document.getElementById('tb-new').addEventListener('click', () => {
            if (confirm('Start a new game? Current progress will be lost.')) {
                this.showStartScreen();
            }
        });

        document.getElementById('tb-open').addEventListener('click', () => {
            this.openSaveFile();
        });

        document.getElementById('tb-save').addEventListener('click', () => {
            this.saveGame();
        });

        document.getElementById('tb-center').addEventListener('click', () => {
            if (gameState.selectedUnit) {
                renderer.centerOn(gameState.selectedUnit.x, gameState.selectedUnit.y);
            } else if (gameState.selectedCity) {
                renderer.centerOn(gameState.selectedCity.x, gameState.selectedCity.y);
            }
        });

        document.getElementById('tb-next-unit').addEventListener('click', () => {
            inputHandler.selectNextUnit();
        });

        document.getElementById('tb-end-turn').addEventListener('click', () => {
            if (gameState.isMyTurn()) {
                gameSocket.endTurn();
            }
        });
    }

    // Save game to file
    saveGame() {
        fetch(Config.API.SAVE_GAME, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(`Game saved: ${data.filename}`);
            } else {
                alert('Failed to save game: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error saving game:', error);
            alert('Failed to save game.');
        });
    }

    // Open load game modal
    openSaveFile() {
        this.showLoadModal();
    }

    // Show load game modal with list of saves
    showLoadModal() {
        const modal = document.getElementById('load-modal');
        const savesList = document.getElementById('saves-list');

        // Fetch list of saves
        fetch(Config.API.LIST_SAVES)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.saves && data.saves.length > 0) {
                    savesList.innerHTML = data.saves.map(save => `
                        <div class="save-item" data-filename="${save.filename}">
                            <span class="save-name">${save.filename}</span>
                            <span class="save-date">${save.modified}</span>
                        </div>
                    `).join('');

                    // Add click handlers
                    savesList.querySelectorAll('.save-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const filename = item.dataset.filename;
                            this.loadGameByFilename(filename);
                        });
                    });
                } else {
                    savesList.innerHTML = '<p class="no-saves">No saved games found</p>';
                }
            })
            .catch(error => {
                console.error('Error fetching saves:', error);
                savesList.innerHTML = '<p class="no-saves">Failed to load saves list</p>';
            });

        modal.classList.remove('hidden');

        // Setup close handler
        document.getElementById('load-modal-close').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    // Load game by filename
    loadGameByFilename(filename) {
        fetch(Config.API.LOAD_GAME, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: filename })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('load-modal').classList.add('hidden');
                // Reset first load flag so camera centers on units
                isFirstLoad = true;
                // Disconnect and reconnect websocket
                gameSocket.disconnect();
                gameSocket.connect();
                this.showGameScreen();
            } else {
                alert('Failed to load game: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error loading game:', error);
            alert('Failed to load game.');
        });
    }

    // Show units gallery modal
    showUnitsGallery() {
        const modal = document.getElementById('units-modal');
        const gallery = document.getElementById('units-gallery');

        // List of all available units
        const units = [
            'settler', 'warrior', 'phalanx', 'archer', 'horseman', 'catapult',
            'rifleman', 'armor', 'artillery',
            'fighter', 'bomber',
            'submarine', 'cruiser', 'battleship', 'carrier'
        ];

        gallery.innerHTML = units.map(unit => `
            <div class="unit-card">
                <img src="assets/units/${unit}.png" alt="${unit}">
                <span class="unit-name">${unit}</span>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    // Show resources gallery modal
    showResourcesGallery() {
        const modal = document.getElementById('resources-modal');
        const gallery = document.getElementById('resources-gallery');

        // List of all available resources
        const resources = [
            'oil', 'coal', 'gold', 'iron', 'gems', 'uranium',
            'wheat', 'horses', 'fish', 'silk', 'spices', 'furs'
        ];

        gallery.innerHTML = resources.map(resource => `
            <div class="unit-card">
                <img src="assets/resources/${resource}.png" alt="${resource}">
                <span class="unit-name">${resource}</span>
            </div>
        `).join('');

        modal.classList.remove('hidden');
    }

    // Show goto dashboard modal
    showGotoDashboard() {
        const modal = document.getElementById('goto-modal');
        const list = document.getElementById('goto-list');

        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.units) {
            list.innerHTML = '<p class="no-selection">No units available</p>';
            modal.classList.remove('hidden');
            return;
        }

        const gotoUnits = myPlayer.units.filter(u => u.has_goto);

        if (gotoUnits.length === 0) {
            list.innerHTML = '<p class="no-selection">No active goto orders</p>';
        } else {
            list.innerHTML = gotoUnits.map(u => `
                <div class="goto-item" data-unit-id="${u.id}">
                    <div class="goto-unit-info">
                        <strong>${u.type}</strong> at (${u.x}, ${u.y})
                    </div>
                    <div class="goto-dest">
                        &rarr; (${u.goto_x}, ${u.goto_y})
                    </div>
                    <div class="goto-actions">
                        <button class="btn-goto-center btn-unit">Center</button>
                        <button class="btn-goto-cancel btn-unit">Cancel</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners for center buttons
            list.querySelectorAll('.btn-goto-center').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const unitId = e.target.closest('.goto-item').dataset.unitId;
                    const unit = myPlayer.units.find(u => u.id === unitId);
                    if (unit) {
                        renderer.centerOn(unit.x, unit.y);
                        gameState.selectUnit(unit);
                        this.updateSelectionPanel();
                    }
                });
            });

            // Add event listeners for cancel buttons
            list.querySelectorAll('.btn-goto-cancel').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const unitId = e.target.closest('.goto-item').dataset.unitId;
                    gameSocket.clearGoto(unitId);
                    // Remove the item from the list
                    e.target.closest('.goto-item').remove();
                    // Check if list is now empty
                    if (list.querySelectorAll('.goto-item').length === 0) {
                        list.innerHTML = '<p class="no-selection">No active goto orders</p>';
                    }
                });
            });
        }

        modal.classList.remove('hidden');
    }

    // Show cities dashboard modal
    showCitiesDashboard() {
        const modal = document.getElementById('cities-modal');
        const list = document.getElementById('cities-dashboard-list');

        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.cities || myPlayer.cities.length === 0) {
            list.innerHTML = '<p class="no-selection">No cities</p>';
            modal.classList.remove('hidden');
            return;
        }

        let html = '<table class="cities-table"><thead><tr>';
        html += '<th>City</th><th>Pop</th><th>Food</th>';
        html += '<th>Garrison</th><th>Building</th><th>Progress</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        for (const city of myPlayer.cities) {
            // City name and location
            html += `<tr data-city-id="${city.id}">`;
            html += `<td><strong>${city.name}</strong><br><small>(${city.x}, ${city.y})</small></td>`;
            html += `<td>${city.population}</td>`;
            html += `<td>${city.food_store}/${city.food_needed}</td>`;

            // Garrison - units in this city
            const garrisonedUnits = myPlayer.units.filter(u => u.x === city.x && u.y === city.y);
            if (garrisonedUnits.length > 0) {
                const garrisonSummary = garrisonedUnits.map(u => {
                    const fortified = u.is_fortified ? '⛨' : '';
                    return `${u.type}${fortified}`;
                }).join(', ');
                html += `<td class="garrison-cell" title="${garrisonSummary}">${garrisonedUnits.length} unit${garrisonedUnits.length > 1 ? 's' : ''}<br><small>${garrisonSummary}</small></td>`;
            } else {
                html += `<td class="garrison-cell garrison-empty">None</td>`;
            }

            // Current production
            const buildName = city.current_build ? city.current_build.name : 'Nothing';
            html += `<td>${buildName}</td>`;

            // Progress bar
            if (city.current_build) {
                const pct = city.production_needed > 0
                    ? Math.floor((city.production / city.production_needed) * 100)
                    : 0;
                html += `<td><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
                html += `<small>${city.production}/${city.production_needed}</small></td>`;
            } else {
                html += `<td>-</td>`;
            }

            // Actions: Center button + Production dropdown
            html += `<td class="city-actions">`;
            html += `<button class="btn-city-center btn-unit" data-city-id="${city.id}">Center</button>`;
            html += `<select class="production-select" data-city-id="${city.id}">`;
            html += `<option value="">Change...</option>`;
            html += `<optgroup label="Units">`;
            for (const unit of Config.PRODUCTION_OPTIONS.units) {
                html += `<option value="unit-${unit.type}">${unit.name} (${unit.cost})</option>`;
            }
            html += `</optgroup><optgroup label="Buildings">`;
            for (const bld of Config.PRODUCTION_OPTIONS.buildings) {
                if (!city.buildings || !city.buildings.includes(bld.name)) {
                    html += `<option value="building-${bld.type}">${bld.name} (${bld.cost})</option>`;
                }
            }
            html += `</optgroup></select></td></tr>`;
        }

        html += '</tbody></table>';
        list.innerHTML = html;

        // Event listeners for Center buttons
        list.querySelectorAll('.btn-city-center').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cityId = e.target.dataset.cityId;
                const city = myPlayer.cities.find(c => c.id === cityId);
                if (city) {
                    renderer.centerOn(city.x, city.y);
                    gameState.selectCity(city);
                    this.updateSelectionPanel();
                }
            });
        });

        // Event listeners for production dropdowns
        list.querySelectorAll('.production-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const cityId = e.target.dataset.cityId;
                const value = e.target.value;
                if (!value) return;

                const [type, index] = value.split('-');
                gameSocket.setProduction(cityId, type === 'unit', parseInt(index));
                e.target.value = '';

                // Refresh the dashboard after a short delay to show the change
                setTimeout(() => this.showCitiesDashboard(), 100);
            });
        });

        modal.classList.remove('hidden');
    }

    // Refresh cities dashboard if it's open
    refreshCitiesDashboard() {
        const modal = document.getElementById('cities-modal');
        if (!modal.classList.contains('hidden')) {
            this.showCitiesDashboard();
        }
    }

    // Show units dashboard modal
    showUnitsDashboard() {
        const modal = document.getElementById('units-dashboard-modal');
        const list = document.getElementById('units-dashboard-list');

        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.units || myPlayer.units.length === 0) {
            list.innerHTML = '<p class="no-selection">No units</p>';
            modal.classList.remove('hidden');
            return;
        }

        let html = '<table class="units-table"><thead><tr>';
        html += '<th>Unit</th><th>Location</th><th>Movement</th>';
        html += '<th>Status</th><th>Goto</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        for (const unit of myPlayer.units) {
            html += `<tr data-unit-id="${unit.id}">`;

            // Unit type with veteran indicator
            const veteranStar = unit.is_veteran ? ' <span class="veteran-star">★</span>' : '';
            html += `<td><strong>${unit.type}</strong>${veteranStar}</td>`;

            // Location
            html += `<td>(${unit.x}, ${unit.y})</td>`;

            // Movement
            html += `<td>${unit.movement_left}</td>`;

            // Status
            let status = 'Ready';
            if (unit.is_fortified) {
                status = 'Fortified';
            } else if (unit.movement_left === 0) {
                status = 'Exhausted';
            } else if (unit.group_id) {
                status = 'In Group';
            }
            html += `<td>${status}</td>`;

            // Goto destination
            if (unit.has_goto) {
                html += `<td class="goto-dest">(${unit.goto_x}, ${unit.goto_y})</td>`;
            } else {
                html += `<td>-</td>`;
            }

            // Actions
            html += `<td class="unit-dashboard-actions">`;
            html += `<button class="btn-unit-center btn-unit" data-unit-id="${unit.id}">Center</button>`;
            if (unit.has_goto) {
                html += `<button class="btn-unit-clear-goto btn-unit" data-unit-id="${unit.id}">Clear Goto</button>`;
            }
            html += `</td></tr>`;
        }

        html += '</tbody></table>';
        list.innerHTML = html;

        // Event listeners for Center buttons
        list.querySelectorAll('.btn-unit-center').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unitId = e.target.dataset.unitId;
                const unit = myPlayer.units.find(u => u.id === unitId);
                if (unit) {
                    renderer.centerOn(unit.x, unit.y);
                    gameState.selectUnit(unit);
                    this.updateSelectionPanel();
                }
            });
        });

        // Event listeners for Clear Goto buttons
        list.querySelectorAll('.btn-unit-clear-goto').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unitId = e.target.dataset.unitId;
                gameSocket.clearGoto(unitId);
                // Refresh the dashboard after a short delay
                setTimeout(() => this.showUnitsDashboard(), 100);
            });
        });

        modal.classList.remove('hidden');
    }

    // Refresh units dashboard if it's open
    refreshUnitsDashboard() {
        const modal = document.getElementById('units-dashboard-modal');
        if (!modal.classList.contains('hidden')) {
            this.showUnitsDashboard();
        }
    }

    // ============ ORDERS UI METHODS ============

    // Show new order creation modal
    showNewOrderModal() {
        const modal = document.getElementById('new-order-modal');
        const nameInput = document.getElementById('order-name');
        const descInput = document.getElementById('order-description');
        const stepsList = document.getElementById('order-steps-list');
        const stepSelect = document.getElementById('step-type-select');
        const paramsForm = document.getElementById('step-params-form');

        // Reset form
        nameInput.value = '';
        descInput.value = '';
        stepSelect.value = '';
        paramsForm.classList.add('hidden');
        paramsForm.innerHTML = '';

        // Create a new order object for editing
        this.currentEditingOrder = {
            name: '',
            description: '',
            steps: []
        };

        this.renderOrderSteps();
        modal.classList.remove('hidden');
    }

    // Show edit order modal (load existing order for editing)
    showEditOrderModal(orderId) {
        const order = ordersManager.getOrder(orderId);
        if (!order) {
            alert('Order not found');
            return;
        }

        const modal = document.getElementById('new-order-modal');
        const nameInput = document.getElementById('order-name');
        const descInput = document.getElementById('order-description');
        const stepSelect = document.getElementById('step-type-select');
        const paramsForm = document.getElementById('step-params-form');

        // Populate form with existing order data
        nameInput.value = order.name;
        descInput.value = order.description || '';
        stepSelect.value = '';
        paramsForm.classList.add('hidden');
        paramsForm.innerHTML = '';

        // Create editing object with existing order data
        // Include the order ID so saveCurrentOrder knows we're editing
        this.currentEditingOrder = {
            id: order.id,  // Important: this tells us we're editing
            name: order.name,
            description: order.description,
            steps: order.steps.map(step => ({
                type: step.type,
                params: { ...step.params },
                description: step.description
            }))
        };

        // Close the orders dashboard modal if open
        document.getElementById('orders-dashboard-modal').classList.add('hidden');

        this.renderOrderSteps();
        modal.classList.remove('hidden');
    }

    // Render the steps list in the order editor
    renderOrderSteps() {
        const stepsList = document.getElementById('order-steps-list');

        if (!this.currentEditingOrder || this.currentEditingOrder.steps.length === 0) {
            stepsList.innerHTML = '<p class="no-selection">No steps added yet</p>';
            return;
        }

        let html = '';
        this.currentEditingOrder.steps.forEach((step, index) => {
            html += `
                <div class="order-step-item" data-index="${index}">
                    <span class="step-number">${index + 1}</span>
                    <span class="step-icon">${getStepIcon(step.type)}</span>
                    <span class="step-desc">${step.description}</span>
                    <div class="step-item-actions">
                        <button class="btn-step-up btn-small" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button class="btn-step-down btn-small" data-index="${index}" ${index === this.currentEditingOrder.steps.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="btn-step-remove btn-small" data-index="${index}">×</button>
                    </div>
                </div>
            `;
        });

        stepsList.innerHTML = html;

        // Add event listeners
        stepsList.querySelectorAll('.btn-step-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveStepUp(index);
            });
        });

        stepsList.querySelectorAll('.btn-step-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.moveStepDown(index);
            });
        });

        stepsList.querySelectorAll('.btn-step-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.removeStep(index);
            });
        });
    }

    moveStepUp(index) {
        if (index > 0) {
            const temp = this.currentEditingOrder.steps[index];
            this.currentEditingOrder.steps[index] = this.currentEditingOrder.steps[index - 1];
            this.currentEditingOrder.steps[index - 1] = temp;
            this.renderOrderSteps();
        }
    }

    moveStepDown(index) {
        if (index < this.currentEditingOrder.steps.length - 1) {
            const temp = this.currentEditingOrder.steps[index];
            this.currentEditingOrder.steps[index] = this.currentEditingOrder.steps[index + 1];
            this.currentEditingOrder.steps[index + 1] = temp;
            this.renderOrderSteps();
        }
    }

    removeStep(index) {
        this.currentEditingOrder.steps.splice(index, 1);
        this.renderOrderSteps();
    }

    // Show parameter form for selected step type
    showStepParamsForm(stepType) {
        const paramsForm = document.getElementById('step-params-form');

        if (!stepType) {
            paramsForm.classList.add('hidden');
            paramsForm.innerHTML = '';
            return;
        }

        let html = this.getStepParamsForm(stepType);
        html += `<button id="btn-add-step" class="btn-primary">Add Step</button>`;

        paramsForm.innerHTML = html;
        paramsForm.classList.remove('hidden');

        // Add event listener for add step button
        document.getElementById('btn-add-step').addEventListener('click', () => {
            this.addStepFromForm(stepType);
        });
    }

    // Get parameter form HTML for a step type
    getStepParamsForm(stepType) {
        const myPlayer = gameState.getMyPlayer();

        switch (stepType) {
            case 'build_unit':
                return `
                    <div class="param-group">
                        <label>City:</label>
                        <select id="param-city">${this.getCityOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Unit Type:</label>
                        <select id="param-unit-type">${this.getUnitTypeOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Count:</label>
                        <input type="number" id="param-count" min="1" value="1">
                    </div>
                `;

            case 'build_building':
                return `
                    <div class="param-group">
                        <label>City:</label>
                        <select id="param-city">${this.getCityOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Building:</label>
                        <select id="param-building-type">${this.getBuildingTypeOptions()}</select>
                    </div>
                `;

            case 'goto':
            case 'move_unit':
                return `
                    <div class="param-group">
                        <label>Unit:</label>
                        <select id="param-unit">${this.getUnitOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Target X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Target Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                `;

            case 'goto_city_units':
                return `
                    <div class="param-group">
                        <label>City:</label>
                        <select id="param-city">${this.getCityOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Target X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Target Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                    <p class="form-hint">Sends all units at this city to the destination.</p>
                `;

            case 'send_produced_units':
                return `
                    <div class="param-group">
                        <label>City:</label>
                        <select id="param-city">${this.getCityOptions()}</select>
                    </div>
                    <div class="param-group">
                        <label>Target X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Target Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Count:</label>
                        <input type="number" id="param-count" min="1" value="1">
                    </div>
                    <p class="form-hint">Sends only NEW units produced after this step starts. Use after "Build Unit" step with matching count.</p>
                `;

            // Pipeline steps - use output from previous step
            case 'send_to':
                return `
                    <div class="param-group">
                        <label>Target X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Target Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                    <p class="form-hint">Sends all units from the previous step to this location.</p>
                `;

            case 'wait_arrival':
                return `
                    <p class="form-hint">Waits for all units from the previous step to arrive at their destination.</p>
                    <p class="form-hint">No parameters needed - uses destination from "→ Send To" step.</p>
                `;

            case 'fortify_all':
                return `
                    <p class="form-hint">Fortifies all units from the previous step.</p>
                    <p class="form-hint">No parameters needed.</p>
                `;

            case 'group_all':
                return `
                    <p class="form-hint">Groups all units from the previous step (must be at same location).</p>
                    <p class="form-hint">No parameters needed.</p>
                `;

            case 'group_units':
                return `
                    <div class="param-group">
                        <label>Location X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Location Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                `;

            case 'fortify':
                return `
                    <div class="param-group">
                        <label>Unit:</label>
                        <select id="param-unit">${this.getUnitOptions()}</select>
                    </div>
                `;

            case 'wait_unit_arrives':
                return `
                    <div class="param-group">
                        <label>Unit:</label>
                        <select id="param-unit">${this.getUnitOptions()}</select>
                    </div>
                `;

            case 'wait_units_at_location':
                return `
                    <div class="param-group">
                        <label>Location X:</label>
                        <input type="number" id="param-x" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Location Y:</label>
                        <input type="number" id="param-y" min="0" value="0">
                    </div>
                    <div class="param-group">
                        <label>Unit Count:</label>
                        <input type="number" id="param-count" min="1" value="1">
                    </div>
                `;

            case 'wait_turns':
                return `
                    <div class="param-group">
                        <label>Turns to Wait:</label>
                        <input type="number" id="param-turns" min="1" value="1">
                    </div>
                `;

            default:
                return '<p>Unknown step type</p>';
        }
    }

    // Helper to get city options HTML
    getCityOptions() {
        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.cities || myPlayer.cities.length === 0) {
            return '<option value="">No cities available</option>';
        }
        return myPlayer.cities.map(c =>
            `<option value="${c.id}">${c.name} (${c.x}, ${c.y})</option>`
        ).join('');
    }

    // Helper to get unit options HTML
    getUnitOptions() {
        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.units || myPlayer.units.length === 0) {
            return '<option value="">No units available</option>';
        }
        return myPlayer.units.map(u =>
            `<option value="${u.id}">${u.type} at (${u.x}, ${u.y})</option>`
        ).join('');
    }

    // Helper to get unit type options HTML
    getUnitTypeOptions() {
        return Config.PRODUCTION_OPTIONS.units.map(u =>
            `<option value="${u.type}">${u.name}</option>`
        ).join('');
    }

    // Helper to get building type options HTML
    getBuildingTypeOptions() {
        return Config.PRODUCTION_OPTIONS.buildings.map(b =>
            `<option value="${b.type}">${b.name}</option>`
        ).join('');
    }

    // Add step from the parameter form
    addStepFromForm(stepType) {
        const params = {};
        let description = getStepName(stepType);

        switch (stepType) {
            case 'build_unit': {
                params.cityId = document.getElementById('param-city').value;
                params.unitType = parseInt(document.getElementById('param-unit-type').value);
                params.count = parseInt(document.getElementById('param-count').value) || 1;
                const unitName = Config.PRODUCTION_OPTIONS.units.find(u => u.type === params.unitType)?.name || 'Unit';
                const cityName = this.getCityName(params.cityId);
                description = `Build ${params.count} ${unitName}(s) in ${cityName}`;
                break;
            }
            case 'build_building': {
                params.cityId = document.getElementById('param-city').value;
                params.buildingType = parseInt(document.getElementById('param-building-type').value);
                const buildingName = Config.PRODUCTION_OPTIONS.buildings.find(b => b.type === params.buildingType)?.name || 'Building';
                const cityName = this.getCityName(params.cityId);
                description = `Build ${buildingName} in ${cityName}`;
                break;
            }
            case 'goto':
            case 'move_unit': {
                params.unitId = document.getElementById('param-unit').value;
                params.targetX = parseInt(document.getElementById('param-x').value) || 0;
                params.targetY = parseInt(document.getElementById('param-y').value) || 0;
                description = `${stepType === 'goto' ? 'Send' : 'Move'} unit to (${params.targetX}, ${params.targetY})`;
                break;
            }
            case 'goto_city_units': {
                params.cityId = document.getElementById('param-city').value;
                params.targetX = parseInt(document.getElementById('param-x').value) || 0;
                params.targetY = parseInt(document.getElementById('param-y').value) || 0;
                const cityName = this.getCityName(params.cityId);
                description = `Send units from ${cityName} to (${params.targetX}, ${params.targetY})`;
                break;
            }
            case 'send_produced_units': {
                params.cityId = document.getElementById('param-city').value;
                params.targetX = parseInt(document.getElementById('param-x').value) || 0;
                params.targetY = parseInt(document.getElementById('param-y').value) || 0;
                params.count = parseInt(document.getElementById('param-count').value) || 1;
                const cityName2 = this.getCityName(params.cityId);
                description = `Send ${params.count} new unit(s) from ${cityName2} to (${params.targetX}, ${params.targetY})`;
                break;
            }
            // Pipeline steps
            case 'send_to': {
                params.targetX = parseInt(document.getElementById('param-x').value) || 0;
                params.targetY = parseInt(document.getElementById('param-y').value) || 0;
                description = `→ Send to (${params.targetX}, ${params.targetY})`;
                break;
            }
            case 'wait_arrival': {
                description = `→ Wait for arrival`;
                break;
            }
            case 'fortify_all': {
                description = `→ Fortify all`;
                break;
            }
            case 'group_all': {
                description = `→ Group all`;
                break;
            }
            case 'group_units': {
                params.locationX = parseInt(document.getElementById('param-x').value) || 0;
                params.locationY = parseInt(document.getElementById('param-y').value) || 0;
                description = `Group units at (${params.locationX}, ${params.locationY})`;
                break;
            }
            case 'fortify': {
                params.unitId = document.getElementById('param-unit').value;
                description = `Fortify unit`;
                break;
            }
            case 'wait_unit_arrives': {
                params.unitId = document.getElementById('param-unit').value;
                description = `Wait for unit to arrive`;
                break;
            }
            case 'wait_units_at_location': {
                params.locationX = parseInt(document.getElementById('param-x').value) || 0;
                params.locationY = parseInt(document.getElementById('param-y').value) || 0;
                params.count = parseInt(document.getElementById('param-count').value) || 1;
                description = `Wait for ${params.count} units at (${params.locationX}, ${params.locationY})`;
                break;
            }
            case 'wait_turns': {
                params.turns = parseInt(document.getElementById('param-turns').value) || 1;
                description = `Wait ${params.turns} turn(s)`;
                break;
            }
        }

        // Add step to current order
        this.currentEditingOrder.steps.push({
            type: stepType,
            params: params,
            description: description
        });

        // Reset form
        document.getElementById('step-type-select').value = '';
        document.getElementById('step-params-form').classList.add('hidden');
        document.getElementById('step-params-form').innerHTML = '';

        // Re-render steps
        this.renderOrderSteps();
    }

    // Helper to get city name by ID
    getCityName(cityId) {
        const myPlayer = gameState.getMyPlayer();
        if (!myPlayer || !myPlayer.cities) return 'Unknown';
        const city = myPlayer.cities.find(c => c.id === cityId);
        return city ? city.name : 'Unknown';
    }

    // Save the current order (handles both create and update)
    saveCurrentOrder() {
        const nameInput = document.getElementById('order-name');
        const descInput = document.getElementById('order-description');

        const name = nameInput.value.trim() || 'Unnamed Order';
        const description = descInput.value.trim();

        if (this.currentEditingOrder.steps.length === 0) {
            alert('Please add at least one step to the order.');
            return;
        }

        let order;
        const isEditing = !!this.currentEditingOrder.id;

        if (isEditing) {
            // Update existing order
            order = ordersManager.getOrder(this.currentEditingOrder.id);
            if (!order) {
                alert('Order not found. It may have been deleted.');
                return;
            }

            // Update order properties
            order.name = name;
            order.description = description;

            // Clear existing steps and add new ones
            order.steps = [];
            order.currentStepIndex = 0;
            for (const step of this.currentEditingOrder.steps) {
                order.addStep(step.type, step.params, step.description);
            }

            // Reset status if the order was completed or failed
            if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.FAILED) {
                order.status = OrderStatus.ACTIVE;
                order.errorMessage = null;
            }

            console.log(`Order "${name}" updated with ${order.steps.length} steps`);
        } else {
            // Create new order
            order = ordersManager.createOrder(name, description);

            // Add steps
            for (const step of this.currentEditingOrder.steps) {
                order.addStep(step.type, step.params, step.description);
            }

            console.log(`Order "${name}" created with ${order.steps.length} steps`);
        }

        // Save to localStorage
        ordersManager.saveToLocalStorage();

        // Close modal
        document.getElementById('new-order-modal').classList.add('hidden');
        this.currentEditingOrder = null;
    }

    // Show orders dashboard
    showOrdersDashboard() {
        const modal = document.getElementById('orders-dashboard-modal');
        const list = document.getElementById('orders-dashboard-list');

        const orders = ordersManager.getAllOrders();

        if (orders.length === 0) {
            list.innerHTML = '<p class="no-selection">No orders created yet</p>';
            modal.classList.remove('hidden');
            return;
        }

        let html = '<table class="orders-table"><thead><tr>';
        html += '<th>Order</th><th>Status</th><th>Progress</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        for (const order of orders) {
            const progress = order.getProgress();
            const statusClass = `status-${order.status}`;

            html += `<tr data-order-id="${order.id}">`;
            html += `<td><strong>${order.name}</strong>`;
            if (order.description) {
                html += `<br><small>${order.description}</small>`;
            }
            html += `</td>`;
            html += `<td><span class="${statusClass}">${order.status}</span>`;
            if (order.errorMessage) {
                html += `<br><small class="error-text">${order.errorMessage}</small>`;
            }
            html += `</td>`;
            html += `<td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                </div>
                <small>${order.currentStepIndex}/${order.steps.length} steps</small>
            </td>`;
            html += `<td class="order-actions">
                <button class="btn-order-view btn-small" data-order-id="${order.id}">Details</button>
                <button class="btn-order-edit btn-small" data-order-id="${order.id}">Edit</button>
                <button class="btn-order-toggle btn-small" data-order-id="${order.id}">${order.status === 'active' ? 'Pause' : 'Resume'}</button>
                <button class="btn-order-delete btn-small" data-order-id="${order.id}">Delete</button>
            </td>`;
            html += `</tr>`;
        }

        html += '</tbody></table>';
        list.innerHTML = html;

        // Add event listeners
        list.querySelectorAll('.btn-order-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                this.showOrderDetail(orderId);
            });
        });

        list.querySelectorAll('.btn-order-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                this.showEditOrderModal(orderId);
            });
        });

        list.querySelectorAll('.btn-order-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                this.toggleOrderPause(orderId);
            });
        });

        list.querySelectorAll('.btn-order-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const orderId = e.target.dataset.orderId;
                if (confirm('Delete this order?')) {
                    ordersManager.deleteOrder(orderId);
                    ordersManager.saveToLocalStorage();
                    this.showOrdersDashboard(); // Refresh
                }
            });
        });

        modal.classList.remove('hidden');
    }

    // Toggle order pause/resume
    toggleOrderPause(orderId) {
        const order = ordersManager.getOrder(orderId);
        if (!order) return;

        if (order.status === OrderStatus.ACTIVE) {
            order.pause();
        } else if (order.status === OrderStatus.PAUSED) {
            order.resume();
        }

        ordersManager.saveToLocalStorage();
        this.showOrdersDashboard(); // Refresh
    }

    // Show order detail view
    showOrderDetail(orderId) {
        const modal = document.getElementById('order-detail-modal');
        const title = document.getElementById('order-detail-title');
        const content = document.getElementById('order-detail-content');

        const order = ordersManager.getOrder(orderId);
        if (!order) {
            content.innerHTML = '<p class="no-selection">Order not found</p>';
            modal.classList.remove('hidden');
            return;
        }

        title.textContent = order.name;

        let html = `<div class="order-info">
            <p><strong>Status:</strong> <span class="status-${order.status}">${order.status}</span></p>
            <p><strong>Progress:</strong> ${order.getProgress()}% (${order.currentStepIndex}/${order.steps.length} steps)</p>
            ${order.description ? `<p><strong>Description:</strong> ${order.description}</p>` : ''}
            ${order.errorMessage ? `<p class="error-text"><strong>Error:</strong> ${order.errorMessage}</p>` : ''}
        </div>`;

        if (order.status === OrderStatus.PAUSED && order.getCurrentStep()?.status === StepStatus.FAILED) {
            html += `<div class="order-recovery-actions">
                <button class="btn-skip-step btn-small" data-order-id="${order.id}">Skip Failed Step</button>
                <button class="btn-retry-step btn-small" data-order-id="${order.id}">Retry Step</button>
            </div>`;
        }

        html += '<h4>Steps:</h4><div class="order-steps-detail">';

        order.steps.forEach((step, index) => {
            const isCurrent = index === order.currentStepIndex;
            const stepClass = `step-${step.status} ${isCurrent ? 'step-current' : ''}`;

            html += `
                <div class="order-step ${stepClass}">
                    <span class="step-number">${index + 1}</span>
                    <span class="step-icon">${getStepIcon(step.type)}</span>
                    <span class="step-desc">${step.description}</span>
                    <span class="step-status-badge">${step.status}</span>
                    ${step.progress > 0 && step.status === StepStatus.IN_PROGRESS ?
                        `<div class="mini-progress-bar"><div class="mini-progress-fill" style="width:${step.progress}%"></div></div>` : ''}
                    ${step.errorMessage ? `<div class="step-error">${step.errorMessage}</div>` : ''}
                    ${step.result ? `<div class="step-result">${step.result}</div>` : ''}
                </div>
            `;
        });

        html += '</div>';

        content.innerHTML = html;

        // Add event listeners for recovery actions
        const skipBtn = content.querySelector('.btn-skip-step');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                ordersManager.skipCurrentStep(orderId);
                ordersManager.saveToLocalStorage();
                this.showOrderDetail(orderId); // Refresh
            });
        }

        const retryBtn = content.querySelector('.btn-retry-step');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                ordersManager.retryCurrentStep(orderId);
                ordersManager.saveToLocalStorage();
                this.showOrderDetail(orderId); // Refresh
            });
        }

        modal.classList.remove('hidden');
    }

    // Show notification when orders are paused
    showOrdersPausedNotification(pausedOrders) {
        if (pausedOrders.length === 0) return;

        const names = pausedOrders.map(o => o.name).join(', ');
        console.log(`Orders paused: ${names}`);
        // Could show a toast notification here
        alert(`Order(s) paused due to errors: ${names}\n\nCheck Orders Dashboard for details.`);
    }

    // Refresh orders dashboard if open
    refreshOrdersDashboard() {
        const modal = document.getElementById('orders-dashboard-modal');
        if (!modal.classList.contains('hidden')) {
            this.showOrdersDashboard();
        }
    }

    // Try to end turn with confirmation if there are active units
    tryEndTurn() {
        if (!gameState.isMyTurn()) return;

        const activeCount = gameState.getActiveUnitsCount();
        if (activeCount > 0) {
            const message = activeCount === 1
                ? 'You have 1 unit that can still move. End turn anyway?'
                : `You have ${activeCount} units that can still move. End turn anyway?`;

            if (confirm(message)) {
                gameSocket.endTurn();
            }
        } else {
            gameSocket.endTurn();
        }
    }

    startGame() {
        const playerName = document.getElementById('player-name').value || 'Player';
        const mapSize = document.getElementById('map-size').value;
        const mapType = document.getElementById('map-type').value;
        const opponents = parseInt(document.getElementById('opponents').value);

        let size = Config.MAP_SIZES[mapSize];

        // Earth-like maps use fixed larger size for realism
        if (mapType === 'earth') {
            size = { width: 160, height: 80 };
        }

        const config = {
            map_width: size.width,
            map_height: size.height,
            player_count: opponents + 1,
            player_name: playerName,
            map_type: mapType,
            seed: 0
        };

        // Create new game via API
        fetch(Config.API.NEW_GAME, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            // Connect WebSocket
            gameSocket.connect();
            this.showGameScreen();
        })
        .catch(error => {
            console.error('Error creating game:', error);
            alert('Failed to create game. Please try again.');
        });
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        this.gameScreen.classList.add('hidden');
    }

    showGameScreen() {
        this.startScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');

        // Force canvas resize after screen becomes visible
        // Elements have 0 dimensions when display:none
        requestAnimationFrame(() => {
            if (renderer) {
                renderer.resize();
            }
        });
    }

    updateTopBar() {
        this.turnNumber.textContent = `Turn ${gameState.turn}`;

        if (gameState.isMyTurn()) {
            this.currentPlayer.textContent = 'Your Turn';
            this.currentPlayer.style.color = '#00ff00';
            this.endTurnBtn.disabled = false;
        } else {
            const currentPlayer = gameState.getPlayer(gameState.currentPlayerId);
            this.currentPlayer.textContent = currentPlayer ? `${currentPlayer.name}'s Turn` : 'Waiting...';
            this.currentPlayer.style.color = '#ff6666';
            this.endTurnBtn.disabled = true;
        }

        const myPlayer = gameState.getMyPlayer();
        if (myPlayer) {
            this.goldDisplay.textContent = `Gold: ${myPlayer.gold}`;
        }
    }

    updateSelectionPanel() {
        // Group selection
        if (gameState.selectedGroup) {
            const units = gameState.getGroupUnits(gameState.selectedGroup);
            if (units.length > 0) {
                const owner = gameState.getPlayer(units[0].owner_id);
                const isMine = units[0].owner_id === gameState.myPlayerId;
                const minMovement = gameState.getGroupMinMovement(gameState.selectedGroup);
                const totalAttack = units.reduce((sum, u) => sum + u.attack, 0);
                const totalDefense = units.reduce((sum, u) => sum + u.defense, 0);

                // Build unit list HTML
                const unitListHtml = units.map(u =>
                    `<li>${u.type} (A:${u.attack} D:${u.defense} M:${u.movement_left}${u.is_veteran ? ' ★' : ''})</li>`
                ).join('');

                this.selectionInfo.innerHTML = `
                    <p><strong>Unit Group (${units.length} units)</strong></p>
                    <p><span class="stat-label">Owner:</span> ${owner ? owner.name : 'Unknown'}</p>
                    <p><span class="stat-label">Total Attack:</span> ${totalAttack} | <span class="stat-label">Defense:</span> ${totalDefense}</p>
                    <p><span class="stat-label">Movement:</span> ${minMovement} (slowest)</p>
                    <p><strong>Units in group:</strong></p>
                    <ul class="unit-list">${unitListHtml}</ul>
                `;

                // Show group actions if it's my group and my turn
                if (isMine && gameState.isMyTurn()) {
                    this.unitActions.classList.remove('hidden');
                    this.updateGroupActionButtons();
                } else {
                    this.unitActions.classList.add('hidden');
                }
                return;
            }
        }

        // Single unit selection
        if (gameState.selectedUnit) {
            const unit = gameState.selectedUnit;
            const owner = gameState.getPlayer(unit.owner_id);
            const isMine = unit.owner_id === gameState.myPlayerId;

            let gotoHtml = '';
            if (unit.has_goto) {
                gotoHtml = `<p><span class="stat-label">Goto:</span> (${unit.goto_x}, ${unit.goto_y})
                    <button class="btn-cancel-goto btn-unit" data-unit-id="${unit.id}">Cancel</button></p>`;
            }

            // Find other units at the same location
            const myPlayer = gameState.getMyPlayer();
            let otherUnitsHtml = '';
            if (myPlayer) {
                const otherUnits = myPlayer.units.filter(u =>
                    u.id !== unit.id && u.x === unit.x && u.y === unit.y
                );
                if (otherUnits.length > 0) {
                    const unitListHtml = otherUnits.map(u =>
                        `<li class="other-unit-item" data-unit-id="${u.id}">${u.type} (M:${u.movement_left}${u.is_fortified ? ' F' : ''}${u.has_goto ? ' →' : ''})</li>`
                    ).join('');
                    otherUnitsHtml = `
                        <p class="other-units-header"><strong>Also here (${otherUnits.length}):</strong></p>
                        <ul class="unit-list other-units-list">${unitListHtml}</ul>
                    `;
                }
            }

            this.selectionInfo.innerHTML = `
                <p><strong>${unit.type}</strong></p>
                <p><span class="stat-label">Owner:</span> ${owner ? owner.name : 'Unknown'}</p>
                <p><span class="stat-label">Attack:</span> ${unit.attack} | <span class="stat-label">Defense:</span> ${unit.defense}</p>
                <p><span class="stat-label">Movement:</span> ${unit.movement_left}</p>
                <p><span class="stat-label">Health:</span> ${unit.health}%</p>
                ${unit.is_veteran ? '<p>Veteran</p>' : ''}
                ${unit.is_fortified ? '<p>Fortified</p>' : ''}
                ${gotoHtml}
                ${otherUnitsHtml}
            `;

            // Add event listener for cancel goto button
            const cancelBtn = this.selectionInfo.querySelector('.btn-cancel-goto');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    const unitId = e.target.dataset.unitId;
                    gameSocket.clearGoto(unitId);
                });
            }

            // Add click handlers for other units list
            const otherUnitItems = this.selectionInfo.querySelectorAll('.other-unit-item');
            otherUnitItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const unitId = e.target.dataset.unitId;
                    const clickedUnit = gameState.getUnit(unitId);
                    if (clickedUnit) {
                        gameState.selectUnit(clickedUnit);
                        this.updateSelectionPanel();
                    }
                });
            });

            // Show unit actions if it's my unit and my turn
            if (isMine && gameState.isMyTurn()) {
                this.unitActions.classList.remove('hidden');

                // Show/hide found city button
                const foundCityBtn = document.getElementById('btn-found-city');
                const buildRoadBtn = document.getElementById('btn-build-road');
                if (unit.can_found_city) {
                    foundCityBtn.classList.remove('hidden');
                    buildRoadBtn.classList.remove('hidden');
                } else {
                    foundCityBtn.classList.add('hidden');
                    buildRoadBtn.classList.add('hidden');
                }

                this.updateModeButtons();
            } else {
                this.unitActions.classList.add('hidden');
            }
        } else if (gameState.selectedCity) {
            const city = gameState.selectedCity;
            const owner = gameState.getPlayer(city.owner_id);

            this.selectionInfo.innerHTML = `
                <p><strong>${city.name}</strong></p>
                <p><span class="stat-label">Owner:</span> ${owner ? owner.name : 'Unknown'}</p>
                <p><span class="stat-label">Population:</span> ${city.population}</p>
                <p><span class="stat-label">Building:</span> ${city.current_build ? city.current_build.name : 'Nothing'}</p>
            `;

            this.unitActions.classList.add('hidden');
        } else {
            this.selectionInfo.innerHTML = '<p class="no-selection">Nothing selected</p>';
            this.unitActions.classList.add('hidden');
        }
    }

    updateModeButtons() {
        const moveBtn = document.getElementById('btn-move');
        const attackBtn = document.getElementById('btn-attack');
        const fortifyBtn = document.getElementById('btn-fortify');
        const unfortifyBtn = document.getElementById('btn-unfortify');
        const gotoBtn = document.getElementById('btn-goto');
        const foundCityBtn = document.getElementById('btn-found-city');
        const buildRoadBtn = document.getElementById('btn-build-road');
        const skipBtn = document.getElementById('btn-skip');
        const groupBtn = document.getElementById('btn-group');
        const ungroupBtn = document.getElementById('btn-ungroup');

        moveBtn.classList.toggle('active', gameState.mode === 'move');
        attackBtn.classList.toggle('active', gameState.mode === 'attack');
        gotoBtn.classList.toggle('active', gameState.mode === 'goto');

        // Disable buttons if unit has no movement left
        const unit = gameState.selectedUnit;
        const hasMovement = unit && unit.movement_left > 0;
        const canAct = hasMovement && !unit.is_fortified;

        moveBtn.disabled = !canAct;
        attackBtn.disabled = !canAct;
        gotoBtn.disabled = !unit; // Goto can always be set if unit is selected
        skipBtn.disabled = !hasMovement;

        // Show Fortify or Wake button based on unit state
        if (unit && unit.is_fortified) {
            fortifyBtn.classList.add('hidden');
            unfortifyBtn.classList.remove('hidden');
            unfortifyBtn.disabled = false;
        } else {
            fortifyBtn.classList.remove('hidden');
            fortifyBtn.disabled = !canAct || (unit && unit.can_found_city); // Settlers can't fortify
            unfortifyBtn.classList.add('hidden');
        }

        if (unit && unit.can_found_city) {
            foundCityBtn.disabled = !canAct || !gameState.canFoundCity();
            buildRoadBtn.disabled = !canAct;
        }

        // Handle Group/Ungroup buttons
        if (unit) {
            // Check if there are other ungrouped units at the same tile
            const myUnits = gameState.getMyUnitsAt(unit.x, unit.y);
            const ungroupedUnits = myUnits.filter(u => !u.group_id);
            const canGroup = ungroupedUnits.length >= 2;

            // If unit is already in a group, show Ungroup
            if (unit.group_id) {
                groupBtn.classList.add('hidden');
                ungroupBtn.classList.remove('hidden');
                ungroupBtn.disabled = false;
            } else {
                // Show Group if we can group, hide Ungroup
                groupBtn.classList.remove('hidden');
                groupBtn.disabled = !canGroup;
                ungroupBtn.classList.add('hidden');
            }
        } else {
            groupBtn.classList.add('hidden');
            ungroupBtn.classList.add('hidden');
        }

        // Update cursor and mode indicator
        this.updateModeIndicator();
    }

    // Update cursor and mode indicator based on current mode
    updateModeIndicator() {
        const container = document.getElementById('canvas-container');
        const indicator = document.getElementById('mode-indicator');

        // Remove all mode classes
        container.classList.remove('mode-move', 'mode-attack', 'mode-goto');

        // Add current mode class and update indicator
        switch (gameState.mode) {
            case 'move':
                container.classList.add('mode-move');
                indicator.textContent = 'Move Mode - Click destination';
                indicator.classList.remove('hidden');
                break;
            case 'attack':
                container.classList.add('mode-attack');
                indicator.textContent = 'Attack Mode - Click target';
                indicator.classList.remove('hidden');
                break;
            case 'goto':
                container.classList.add('mode-goto');
                indicator.textContent = 'Goto Mode - Click destination';
                indicator.classList.remove('hidden');
                break;
            default:
                indicator.classList.add('hidden');
                break;
        }
    }

    // Update action buttons for group selection
    updateGroupActionButtons() {
        const moveBtn = document.getElementById('btn-move');
        const attackBtn = document.getElementById('btn-attack');
        const fortifyBtn = document.getElementById('btn-fortify');
        const gotoBtn = document.getElementById('btn-goto');
        const foundCityBtn = document.getElementById('btn-found-city');
        const buildRoadBtn = document.getElementById('btn-build-road');
        const skipBtn = document.getElementById('btn-skip');
        const groupBtn = document.getElementById('btn-group');
        const ungroupBtn = document.getElementById('btn-ungroup');

        const canMove = gameState.canGroupMove(gameState.selectedGroup);

        moveBtn.classList.toggle('active', gameState.mode === 'move');
        attackBtn.classList.toggle('active', gameState.mode === 'attack');
        gotoBtn.classList.toggle('active', gameState.mode === 'goto');

        moveBtn.disabled = !canMove;
        attackBtn.disabled = !canMove;
        fortifyBtn.disabled = true; // Groups cannot fortify
        gotoBtn.disabled = false; // Goto can always be set for groups
        skipBtn.disabled = !canMove;

        // Hide city-specific buttons for groups
        foundCityBtn.classList.add('hidden');
        buildRoadBtn.classList.add('hidden');

        // Show Ungroup, hide Group for groups
        groupBtn.classList.add('hidden');
        ungroupBtn.classList.remove('hidden');
        ungroupBtn.disabled = false;

        // Update cursor and mode indicator
        this.updateModeIndicator();
    }

    showCityModal(city) {
        this.cityName.textContent = city.name;
        this.cityPop.textContent = city.population;
        this.cityFood.textContent = city.food_store;
        this.cityFoodNeeded.textContent = city.food_needed;
        this.cityProd.textContent = city.production;
        this.cityProdNeeded.textContent = city.production_needed || 0;

        // Buildings list
        this.cityBuildingList.innerHTML = '';
        if (city.buildings && city.buildings.length > 0) {
            city.buildings.forEach(building => {
                const li = document.createElement('li');
                li.textContent = building;
                this.cityBuildingList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'None';
            li.style.color = '#666';
            this.cityBuildingList.appendChild(li);
        }

        // Garrison - show units in this city
        this.garrisonUnits.innerHTML = '';
        const myPlayer = gameState.getMyPlayer();
        const garrisonedUnits = myPlayer ? myPlayer.units.filter(u => u.x === city.x && u.y === city.y) : [];

        if (garrisonedUnits.length > 0) {
            garrisonedUnits.forEach(unit => {
                const unitDiv = document.createElement('div');
                unitDiv.className = 'garrison-unit';

                const statusText = unit.is_fortified ? ' (Fortified)' : '';
                const healthText = unit.health < 100 ? ` - ${unit.health}%` : '';

                unitDiv.innerHTML = `
                    <span class="garrison-unit-info">${unit.type}${statusText}${healthText}</span>
                    <button class="btn-activate-unit btn-small" data-unit-id="${unit.id}">Activate</button>
                `;

                this.garrisonUnits.appendChild(unitDiv);
            });

            // Add event listeners for activate buttons
            this.garrisonUnits.querySelectorAll('.btn-activate-unit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const unitId = e.target.dataset.unitId;
                    const unit = garrisonedUnits.find(u => u.id === unitId);
                    if (unit) {
                        // Unfortify if fortified
                        if (unit.is_fortified) {
                            gameSocket.unfortifyUnit(unit.id);
                        }
                        // Select the unit and close modal
                        gameState.selectUnit(unit);
                        this.updateSelectionPanel();
                        this.hideCityModal();
                    }
                });
            });
        } else {
            this.garrisonUnits.innerHTML = '<p class="no-garrison">No units garrisoned</p>';
        }

        // Production options (only if it's my city)
        this.productionOptions.innerHTML = '';
        if (city.owner_id === gameState.myPlayerId) {
            // Units
            Config.PRODUCTION_OPTIONS.units.forEach(unit => {
                const btn = document.createElement('button');
                btn.className = 'production-btn';
                if (city.current_build && city.current_build.is_unit &&
                    city.current_build.name === unit.name) {
                    btn.classList.add('selected');
                }
                btn.innerHTML = `
                    <div class="name">${unit.name}</div>
                    <div class="cost">Cost: ${unit.cost}</div>
                `;
                btn.addEventListener('click', () => {
                    gameSocket.setProduction(city.id, true, unit.type);
                    this.hideCityModal();
                });
                this.productionOptions.appendChild(btn);
            });

            // Buildings (only show if not already built)
            Config.PRODUCTION_OPTIONS.buildings.forEach(building => {
                if (city.buildings && city.buildings.includes(building.name)) {
                    return; // Already built
                }

                const btn = document.createElement('button');
                btn.className = 'production-btn';
                if (city.current_build && !city.current_build.is_unit &&
                    city.current_build.name === building.name) {
                    btn.classList.add('selected');
                }
                btn.innerHTML = `
                    <div class="name">${building.name}</div>
                    <div class="cost">Cost: ${building.cost}</div>
                `;
                btn.addEventListener('click', () => {
                    gameSocket.setProduction(city.id, false, building.type);
                    this.hideCityModal();
                });
                this.productionOptions.appendChild(btn);
            });
        }

        this.cityModal.classList.remove('hidden');
    }

    hideCityModal() {
        this.cityModal.classList.add('hidden');
    }

    showGameOverModal(winner) {
        if (winner.id === gameState.myPlayerId) {
            this.gameOverTitle.textContent = 'Victory!';
            this.gameOverMessage.textContent = 'Congratulations! You have conquered the world!';
        } else {
            this.gameOverTitle.textContent = 'Defeat';
            this.gameOverMessage.textContent = `${winner.name} has conquered the world.`;
        }
        this.gameOverModal.classList.remove('hidden');
    }

    hideGameOverModal() {
        this.gameOverModal.classList.add('hidden');
    }

    showError(message) {
        console.error(message);
        // Could add a toast notification here
    }
}

// Global UI instance (created in main.js)
let ui = null;
