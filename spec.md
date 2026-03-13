# Indian Village Car Racing Game

## Current State
New project — no existing code.

## Requested Changes (Diff)

### Add
- A 2D top-down car racing game set in an Indian village environment
- Player controls a car on a winding village road
- Obstacles: cows, auto-rickshaws, cyclists, pedestrians, potholes
- Scrolling background with village scenery: mud huts, trees, fields, temples
- Speed increases over time for difficulty progression
- Score counter based on distance traveled / obstacles avoided
- Lives system (3 lives)
- Game states: start screen, playing, game over
- Mobile touch controls (left/right arrows) + keyboard support
- Sound effect indicators (visual) for collisions

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Build entire game in React + Canvas API
2. Scrolling road with lane markings and village background elements
3. Player car rendered on canvas, moves left/right across lanes
4. Obstacle spawning system with random placement and increasing speed
5. Collision detection between player and obstacles
6. Score, lives, and game state management using refs and React state
7. Keyboard (arrow keys) and on-screen touch button controls
8. Start screen with title and instructions
9. Game over screen with final score and restart button
10. Indian village visual theme: warm earthy colors, village props
