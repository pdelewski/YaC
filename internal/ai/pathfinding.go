package ai

import (
	"civilization/internal/game"
	"container/heap"
)

// Point represents a coordinate on the map
type Point struct {
	X, Y int
}

// pathNode represents a node in the A* search
type pathNode struct {
	Point
	G      int // Cost from start
	H      int // Heuristic to goal
	Parent *pathNode
	Index  int // Index in priority queue
}

// F returns the total estimated cost
func (n *pathNode) F() int {
	return n.G + n.H
}

// priorityQueue implements heap.Interface for A* search
type priorityQueue []*pathNode

func (pq priorityQueue) Len() int { return len(pq) }

func (pq priorityQueue) Less(i, j int) bool {
	return pq[i].F() < pq[j].F()
}

func (pq priorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].Index = i
	pq[j].Index = j
}

func (pq *priorityQueue) Push(x interface{}) {
	n := len(*pq)
	node := x.(*pathNode)
	node.Index = n
	*pq = append(*pq, node)
}

func (pq *priorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	node := old[n-1]
	old[n-1] = nil
	node.Index = -1
	*pq = old[0 : n-1]
	return node
}

// FindPath finds the shortest path between two points using A*
func FindPath(g *game.GameState, unit *game.Unit, startX, startY, goalX, goalY int) []Point {
	if startX == goalX && startY == goalY {
		return []Point{{startX, startY}}
	}

	openSet := &priorityQueue{}
	heap.Init(openSet)

	closedSet := make(map[Point]bool)
	nodeMap := make(map[Point]*pathNode)

	start := &pathNode{
		Point: Point{startX, startY},
		G:     0,
		H:     heuristic(startX, startY, goalX, goalY),
	}
	heap.Push(openSet, start)
	nodeMap[start.Point] = start

	for openSet.Len() > 0 {
		current := heap.Pop(openSet).(*pathNode)

		if current.X == goalX && current.Y == goalY {
			return reconstructPath(current)
		}

		closedSet[current.Point] = true

		// Check all neighbors
		for _, neighbor := range getNeighbors(g, current.Point, unit) {
			if closedSet[neighbor] {
				continue
			}

			tile := g.Map.GetTile(neighbor.X, neighbor.Y)
			if tile == nil {
				continue
			}

			moveCost := tile.MovementCost()
			tentativeG := current.G + moveCost

			existingNode, exists := nodeMap[neighbor]
			if !exists {
				newNode := &pathNode{
					Point:  neighbor,
					G:      tentativeG,
					H:      heuristic(neighbor.X, neighbor.Y, goalX, goalY),
					Parent: current,
				}
				heap.Push(openSet, newNode)
				nodeMap[neighbor] = newNode
			} else if tentativeG < existingNode.G {
				existingNode.G = tentativeG
				existingNode.Parent = current
				heap.Fix(openSet, existingNode.Index)
			}
		}
	}

	return nil // No path found
}

// heuristic calculates the estimated cost between two points
func heuristic(x1, y1, x2, y2 int) int {
	// Manhattan distance
	dx := x2 - x1
	dy := y2 - y1
	if dx < 0 {
		dx = -dx
	}
	if dy < 0 {
		dy = -dy
	}
	return dx + dy
}

// getNeighbors returns valid neighboring points for movement
func getNeighbors(g *game.GameState, p Point, unit *game.Unit) []Point {
	neighbors := make([]Point, 0, 8)
	directions := [][2]int{
		{-1, -1}, {0, -1}, {1, -1},
		{-1, 0}, {1, 0},
		{-1, 1}, {0, 1}, {1, 1},
	}

	template := unit.Template()

	for _, d := range directions {
		nx, ny := p.X+d[0], p.Y+d[1]

		if !g.Map.IsValidCoord(nx, ny) {
			continue
		}

		tile := g.Map.GetTile(nx, ny)
		if tile == nil {
			continue
		}

		// Check terrain passability
		if !template.IsNaval && tile.IsWater() {
			continue
		}
		if template.IsNaval && !tile.IsWater() {
			continue
		}

		neighbors = append(neighbors, Point{nx, ny})
	}

	return neighbors
}

// reconstructPath builds the path from goal to start
func reconstructPath(node *pathNode) []Point {
	path := make([]Point, 0)
	current := node

	for current != nil {
		path = append([]Point{current.Point}, path...)
		current = current.Parent
	}

	return path
}

// GetNextMove returns the next position to move toward a goal
func GetNextMove(g *game.GameState, unit *game.Unit, goalX, goalY int) *Point {
	path := FindPath(g, unit, unit.X, unit.Y, goalX, goalY)
	if path == nil || len(path) < 2 {
		return nil
	}

	// Return the next step (index 1, since index 0 is current position)
	return &path[1]
}

// DistanceTo calculates the Manhattan distance between two points
func DistanceTo(x1, y1, x2, y2 int) int {
	return heuristic(x1, y1, x2, y2)
}

// FindNearestTile finds the nearest tile matching a condition
func FindNearestTile(g *game.GameState, startX, startY int, maxRange int, condition func(*game.Tile) bool) *Point {
	// BFS search
	visited := make(map[Point]bool)
	queue := []Point{{startX, startY}}
	visited[queue[0]] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		// Check distance limit
		if DistanceTo(startX, startY, current.X, current.Y) > maxRange {
			continue
		}

		tile := g.Map.GetTile(current.X, current.Y)
		if tile != nil && condition(tile) {
			return &current
		}

		// Add neighbors
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				if dx == 0 && dy == 0 {
					continue
				}
				next := Point{current.X + dx, current.Y + dy}
				if !visited[next] && g.Map.IsValidCoord(next.X, next.Y) {
					visited[next] = true
					queue = append(queue, next)
				}
			}
		}
	}

	return nil
}
