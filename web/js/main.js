// Main application entry point

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Civilization game initializing...');

    // Initialize UI
    ui = new UI();

    // Initialize renderer
    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap');
    renderer = new Renderer(canvas, minimap);

    // Initialize input handler
    inputHandler = new InputHandler(canvas);

    // Set up WebSocket callbacks
    setupWebSocketCallbacks();

    // Start render loop
    startRenderLoop();

    // Force resize after layout is complete
    // This fixes issues where canvas doesn't size correctly on initial load
    requestAnimationFrame(() => {
        renderer.resize();
    });

    console.log('Civilization game initialized');
});

// Additional resize trigger when window fully loads (images, fonts, etc.)
window.addEventListener('load', () => {
    if (renderer) {
        renderer.resize();
    }
});

function setupWebSocketCallbacks() {
    gameSocket.onGameState((data) => {
        console.log('Game state received:', data);
        console.log('Number of players:', data.players ? data.players.length : 0);
        if (data.players) {
            data.players.forEach(p => {
                console.log(`Player ${p.name}: ${p.units ? p.units.length : 0} units`);
                if (p.units) {
                    p.units.forEach(u => console.log(`  Unit: ${u.type} at (${u.x}, ${u.y})`));
                }
            });
        }

        gameState.updateFromServer(data);

        // Center camera on first unit if first load
        if (gameState.map) {
            const myPlayer = gameState.getMyPlayer();
            console.log('My player:', myPlayer ? myPlayer.name : 'not found');
            console.log('My units:', myPlayer ? myPlayer.units.length : 0);
            if (myPlayer && myPlayer.units.length > 0) {
                const firstUnit = myPlayer.units[0];
                console.log('Centering on unit at:', firstUnit.x, firstUnit.y);
                renderer.centerOn(firstUnit.x, firstUnit.y);
            }
        }

        ui.updateTopBar();
        ui.updateSelectionPanel();

        // Check for game over
        if (gameState.winner) {
            ui.showGameOverModal(gameState.winner);
        }
    });

    gameSocket.onTurnChange((data) => {
        console.log('Turn changed:', data);
        gameState.currentPlayerId = data.current_player;
        gameState.turn = data.turn;
        gameState.phase = data.phase;
        ui.updateTopBar();
    });

    gameSocket.onCombatResult((data) => {
        console.log('Combat result:', data);
        // Could add combat animation here
    });

    gameSocket.onError((error) => {
        console.error('Server error:', error);
        ui.showError(error.message || 'An error occurred');
    });

    gameSocket.onConnect(() => {
        console.log('Connected to server');
    });

    gameSocket.onDisconnect(() => {
        console.log('Disconnected from server');
    });
}

function startRenderLoop() {
    function loop() {
        renderer.render();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}
