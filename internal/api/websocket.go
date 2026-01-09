package api

import (
	"civilization/internal/ai"
	"civilization/internal/game"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Hub manages WebSocket connections and game state
type Hub struct {
	game       *game.GameState
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	aiControllers map[string]*ai.Controller
}

// Client represents a WebSocket client
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	playerID string
}

// NewHub creates a new WebSocket hub
func NewHub(g *game.GameState) *Hub {
	h := &Hub{
		game:       g,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		aiControllers: make(map[string]*ai.Controller),
	}

	// Create AI controllers for AI players
	for _, player := range g.Players {
		if player.Type == game.PlayerAI {
			h.aiControllers[player.ID] = ai.NewController(g, player.ID)
		}
	}

	return h
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

			// Send initial game state
			h.sendGameState(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Close closes all client connections
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for client := range h.clients {
		client.conn.Close()
		close(client.send)
		delete(h.clients, client)
	}
}

// sendGameState sends the full game state to a client
func (h *Hub) sendGameState(client *Client) {
	// Log player units before conversion
	for _, p := range h.game.Players {
		log.Printf("Player %s has %d units before DTO conversion", p.Name, len(p.Units))
		for _, u := range p.Units {
			log.Printf("  Unit: %s type=%d at (%d,%d)", u.ID, u.Type, u.X, u.Y)
		}
	}

	state := GameStateToDTO(h.game)

	// Log player units after conversion
	for _, p := range state.Players {
		log.Printf("Player %s has %d units in DTO", p.Name, len(p.Units))
	}

	payload, err := json.Marshal(state)
	if err != nil {
		log.Printf("Error marshaling game state: %v", err)
		return
	}

	msg := WSMessage{
		Type:    MsgTypeGameState,
		Payload: payload,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case client.send <- data:
	default:
		log.Println("Client send buffer full")
	}
}

// BroadcastGameState sends the game state to all clients
func (h *Hub) BroadcastGameState() {
	state := GameStateToDTO(h.game)
	payload, err := json.Marshal(state)
	if err != nil {
		log.Printf("Error marshaling game state: %v", err)
		return
	}

	msg := WSMessage{
		Type:    MsgTypeGameState,
		Payload: payload,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.broadcast <- data
}

// BroadcastTurnChange notifies clients of a turn change
func (h *Hub) BroadcastTurnChange() {
	currentPlayer := h.game.GetCurrentPlayer()
	msg := TurnChangeMessage{
		Turn:          h.game.CurrentTurn,
		CurrentPlayer: currentPlayer.ID,
		PlayerName:    currentPlayer.Name,
		Phase:         h.game.Phase.String(),
	}

	payload, _ := json.Marshal(msg)
	wsMsg := WSMessage{
		Type:    MsgTypeTurnChange,
		Payload: payload,
	}

	data, _ := json.Marshal(wsMsg)
	h.broadcast <- data
}

// BroadcastError sends an error to all clients
func (h *Hub) BroadcastError(code, message string) {
	errMsg := ErrorMessage{
		Code:    code,
		Message: message,
	}

	payload, _ := json.Marshal(errMsg)
	wsMsg := WSMessage{
		Type:    MsgTypeError,
		Payload: payload,
	}

	data, _ := json.Marshal(wsMsg)
	h.broadcast <- data
}

// ProcessAITurns processes all AI turns
func (h *Hub) ProcessAITurns() {
	for h.game.Phase == game.PhaseAITurn {
		currentPlayer := h.game.GetCurrentPlayer()
		if currentPlayer == nil {
			break
		}

		controller := h.aiControllers[currentPlayer.ID]
		if controller == nil {
			// No AI controller, just end turn
			h.game.EndTurn()
			continue
		}

		// Add a small delay for visibility
		time.Sleep(100 * time.Millisecond)

		// Execute AI actions
		actions := controller.TakeTurn()
		for _, action := range actions {
			if err := action.Validate(h.game, currentPlayer.ID); err == nil {
				action.Execute(h.game)
			}
		}

		// Broadcast state update
		h.BroadcastGameState()
	}

	// Notify turn change after AI turns complete
	h.BroadcastTurnChange()
}

// HandleWebSocket handles WebSocket upgrade requests
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Get the human player ID
	humanPlayer := h.game.GetHumanPlayer()
	playerID := ""
	if humanPlayer != nil {
		playerID = humanPlayer.ID
	}

	client := &Client{
		hub:      h,
		conn:     conn,
		send:     make(chan []byte, 256),
		playerID: playerID,
	}

	h.register <- client

	// Start read and write goroutines
	go client.writePump()
	go client.readPump()
}

// readPump reads messages from the WebSocket connection
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512 * 1024)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

// writePump writes messages to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming WebSocket messages
func (c *Client) handleMessage(data []byte) {
	var msg WSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return
	}

	switch msg.Type {
	case MsgTypeAction:
		c.handleAction(msg.Payload)
	}
}

// handleAction processes player actions
func (c *Client) handleAction(payload json.RawMessage) {
	var actionMsg ActionMessage
	if err := json.Unmarshal(payload, &actionMsg); err != nil {
		log.Printf("Error unmarshaling action: %v", err)
		return
	}

	// Verify it's the player's turn
	if !c.hub.game.IsCurrentPlayerTurn(c.playerID) {
		c.sendError("not_your_turn", "It is not your turn")
		return
	}

	var action game.Action

	switch actionMsg.ActionType {
	case "move":
		var data struct {
			UnitID string `json:"unit_id"`
			ToX    int    `json:"to_x"`
			ToY    int    `json:"to_y"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.MoveUnitAction{
			UnitID: data.UnitID,
			ToX:    data.ToX,
			ToY:    data.ToY,
		}

	case "attack":
		var data struct {
			AttackerID string `json:"attacker_id"`
			TargetX    int    `json:"target_x"`
			TargetY    int    `json:"target_y"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.AttackAction{
			AttackerID: data.AttackerID,
			TargetX:    data.TargetX,
			TargetY:    data.TargetY,
		}

	case "found_city":
		var data struct {
			SettlerID string `json:"settler_id"`
			CityName  string `json:"city_name"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.FoundCityAction{
			SettlerID: data.SettlerID,
			CityName:  data.CityName,
		}

	case "set_production":
		var data struct {
			CityID string         `json:"city_id"`
			BuildItem struct {
				IsUnit   bool   `json:"is_unit"`
				UnitType int    `json:"unit_type,omitempty"`
				Building int    `json:"building,omitempty"`
			} `json:"build_item"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.SetProductionAction{
			CityID: data.CityID,
			BuildItem: game.BuildItem{
				IsUnit:   data.BuildItem.IsUnit,
				UnitType: game.UnitType(data.BuildItem.UnitType),
				Building: game.BuildingType(data.BuildItem.Building),
			},
		}

	case "fortify":
		var data struct {
			UnitID string `json:"unit_id"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.FortifyAction{
			UnitID: data.UnitID,
		}

	case "skip":
		var data struct {
			UnitID string `json:"unit_id"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.SkipUnitAction{
			UnitID: data.UnitID,
		}

	case "build_road":
		var data struct {
			UnitID string `json:"unit_id"`
		}
		json.Unmarshal(actionMsg.Data, &data)
		action = &game.BuildRoadAction{
			UnitID: data.UnitID,
		}

	case "end_turn":
		action = &game.EndTurnAction{}

	default:
		c.sendError("unknown_action", "Unknown action type: "+actionMsg.ActionType)
		return
	}

	// Validate and execute action
	if err := action.Validate(c.hub.game, c.playerID); err != nil {
		c.sendError("invalid_action", err.Error())
		return
	}

	if err := action.Execute(c.hub.game); err != nil {
		c.sendError("action_failed", err.Error())
		return
	}

	// Broadcast updated state
	c.hub.BroadcastGameState()

	// If it's now AI turn, process AI turns
	if c.hub.game.Phase == game.PhaseAITurn {
		go c.hub.ProcessAITurns()
	}
}

// sendError sends an error message to this client
func (c *Client) sendError(code, message string) {
	errMsg := ErrorMessage{
		Code:    code,
		Message: message,
	}

	payload, _ := json.Marshal(errMsg)
	wsMsg := WSMessage{
		Type:    MsgTypeError,
		Payload: payload,
	}

	data, _ := json.Marshal(wsMsg)

	select {
	case c.send <- data:
	default:
		log.Println("Client send buffer full")
	}
}
