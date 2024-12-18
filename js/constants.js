const GAME_CONFIG = {
    CANVAS_WIDTH: 320,
    CANVAS_HEIGHT: 520,
    INGREDIENT_SIZE: 25,
    DROP_INTERVAL: 1000,
    FUSION_DELAY: 500,
    
    // Box configuration adjusted for Box_Frame
    BOX_WIDTH: 260,      // Adjusted for frame
    BOX_HEIGHT: 400,     // Adjusted for frame
    BOX_X: 30,          // Centered horizontally
    BOX_Y: 120,         // Moved 20 pixels down (was 100)
    SPAWN_HEIGHT: 70,    // Increased by 20 to maintain relative position (was 50)
    
    // Collision boundaries for the frame
    FRAME_THICKNESS: 10, // Thickness of the frame for collisions
    
    // Safety margins
    SPAWN_MARGIN: 28,    // Safety margin for ingredient spawning
    SAFE_MARGIN: 15,
    HUD_SPACING: 20,
    
    // Bottom margin for the box
    BOTTOM_MARGIN: 20
};

// Make GAME_CONFIG globally available
window.GAME_CONFIG = GAME_CONFIG; 