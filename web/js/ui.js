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
            if (gameState.isMyTurn()) {
                gameSocket.endTurn();
            }
        });

        // Unit action buttons
        document.getElementById('btn-move').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                gameState.setMode('move');
                this.updateModeButtons();
            }
        });

        document.getElementById('btn-attack').addEventListener('click', () => {
            if (gameState.selectedUnit && gameState.canUnitMove(gameState.selectedUnit)) {
                gameState.setMode('attack');
                this.updateModeButtons();
            }
        });

        document.getElementById('btn-fortify').addEventListener('click', () => {
            if (gameState.selectedUnit) {
                gameSocket.fortifyUnit(gameState.selectedUnit.id);
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
            if (data.save_data) {
                const blob = new Blob([JSON.stringify(data.save_data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `civilization_save_${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        })
        .catch(error => {
            console.error('Error saving game:', error);
            alert('Failed to save game.');
        });
    }

    // Open save file
    openSaveFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const saveData = JSON.parse(event.target.result);
                        this.loadGame(saveData);
                    } catch (err) {
                        alert('Invalid save file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    // Load game from save data
    loadGame(saveData) {
        fetch(Config.API.LOAD_GAME, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
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

    startGame() {
        const playerName = document.getElementById('player-name').value || 'Player';
        const mapSize = document.getElementById('map-size').value;
        const opponents = parseInt(document.getElementById('opponents').value);

        const size = Config.MAP_SIZES[mapSize];

        const config = {
            map_width: size.width,
            map_height: size.height,
            player_count: opponents + 1,
            player_name: playerName,
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
        if (gameState.selectedUnit) {
            const unit = gameState.selectedUnit;
            const owner = gameState.getPlayer(unit.owner_id);
            const isMine = unit.owner_id === gameState.myPlayerId;

            this.selectionInfo.innerHTML = `
                <p><strong>${unit.type}</strong></p>
                <p><span class="stat-label">Owner:</span> ${owner ? owner.name : 'Unknown'}</p>
                <p><span class="stat-label">Attack:</span> ${unit.attack} | <span class="stat-label">Defense:</span> ${unit.defense}</p>
                <p><span class="stat-label">Movement:</span> ${unit.movement_left}</p>
                <p><span class="stat-label">Health:</span> ${unit.health}%</p>
                ${unit.is_veteran ? '<p>Veteran</p>' : ''}
                ${unit.is_fortified ? '<p>Fortified</p>' : ''}
            `;

            // Show unit actions if it's my unit and my turn
            if (isMine && gameState.isMyTurn()) {
                this.unitActions.classList.remove('hidden');

                // Show/hide found city button
                const foundCityBtn = document.getElementById('btn-found-city');
                if (unit.can_found_city) {
                    foundCityBtn.classList.remove('hidden');
                } else {
                    foundCityBtn.classList.add('hidden');
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

        moveBtn.classList.toggle('active', gameState.mode === 'move');
        attackBtn.classList.toggle('active', gameState.mode === 'attack');
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
