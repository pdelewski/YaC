// WebSocket connection manager
class GameWebSocket {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.callbacks = {
            onGameState: null,
            onUpdate: null,
            onTurnChange: null,
            onCombatResult: null,
            onError: null,
            onConnect: null,
            onDisconnect: null
        };
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        this.ws = new WebSocket(Config.API.WEBSOCKET);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.connected = false;
            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect();
            }
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), 2000);
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'game_state':
                    if (this.callbacks.onGameState) {
                        this.callbacks.onGameState(message.payload);
                    }
                    break;

                case 'update':
                    if (this.callbacks.onUpdate) {
                        this.callbacks.onUpdate(message.payload);
                    }
                    break;

                case 'turn_change':
                    if (this.callbacks.onTurnChange) {
                        this.callbacks.onTurnChange(message.payload);
                    }
                    break;

                case 'combat_result':
                    if (this.callbacks.onCombatResult) {
                        this.callbacks.onCombatResult(message.payload);
                    }
                    break;

                case 'error':
                    console.error('Server error:', message.payload);
                    if (this.callbacks.onError) {
                        this.callbacks.onError(message.payload);
                    }
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    }

    send(type, payload) {
        if (!this.connected) {
            console.error('WebSocket not connected');
            return false;
        }

        const message = {
            type: type,
            payload: payload
        };

        this.ws.send(JSON.stringify(message));
        return true;
    }

    // Action methods
    sendAction(actionType, data) {
        return this.send('action', {
            action_type: actionType,
            data: data
        });
    }

    moveUnit(unitId, toX, toY) {
        return this.sendAction('move', {
            unit_id: unitId,
            to_x: toX,
            to_y: toY
        });
    }

    attackUnit(attackerId, targetX, targetY) {
        return this.sendAction('attack', {
            attacker_id: attackerId,
            target_x: targetX,
            target_y: targetY
        });
    }

    foundCity(settlerId, cityName) {
        return this.sendAction('found_city', {
            settler_id: settlerId,
            city_name: cityName
        });
    }

    setProduction(cityId, isUnit, typeIndex) {
        return this.sendAction('set_production', {
            city_id: cityId,
            build_item: {
                is_unit: isUnit,
                unit_type: isUnit ? typeIndex : 0,
                building: isUnit ? 0 : typeIndex
            }
        });
    }

    fortifyUnit(unitId) {
        return this.sendAction('fortify', {
            unit_id: unitId
        });
    }

    skipUnit(unitId) {
        return this.sendAction('skip', {
            unit_id: unitId
        });
    }

    endTurn() {
        return this.sendAction('end_turn', {});
    }

    // Callback setters
    onGameState(callback) {
        this.callbacks.onGameState = callback;
    }

    onUpdate(callback) {
        this.callbacks.onUpdate = callback;
    }

    onTurnChange(callback) {
        this.callbacks.onTurnChange = callback;
    }

    onCombatResult(callback) {
        this.callbacks.onCombatResult = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    onConnect(callback) {
        this.callbacks.onConnect = callback;
    }

    onDisconnect(callback) {
        this.callbacks.onDisconnect = callback;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Global WebSocket instance
const gameSocket = new GameWebSocket();
