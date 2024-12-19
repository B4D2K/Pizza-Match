// Game constants and configurations
const INGREDIENT_NAMES = [
    'Olive',
    'Mushroom',
    'Onion',
    'Pepperoni',
    'Tomato',
    'Muzzarela',
    'Cheddar',
    'SmallPizza',
    'MediumPizza',
    'UltimatePizza'
];

const INGREDIENT_TYPES = {
    OLIVE: 0,
    MUSHROOM: 1,
    ONION: 2,
    PEPPERONI: 3,
    TOMATO: 4,
    MUZZARELA: 5,
    CHEDDAR: 6,
    SMALL_PIZZA: 7,
    MEDIUM_PIZZA: 8,
    ULTIMATE_PIZZA: 9
};

// Define fusion scores with validation
const FUSION_SCORES = Object.freeze({
    [INGREDIENT_TYPES.OLIVE]: 10,          // Olive + Olive = 10
    [INGREDIENT_TYPES.MUSHROOM]: 15,       // Mushroom + Mushroom = 15
    [INGREDIENT_TYPES.ONION]: 20,          // Onion + Onion = 20
    [INGREDIENT_TYPES.PEPPERONI]: 30,      // Pepperoni + Pepperoni = 30
    [INGREDIENT_TYPES.TOMATO]: 50,         // Tomato + Tomato = 50
    [INGREDIENT_TYPES.MUZZARELA]: 100,     // Muzzarela + Muzzarela = 100
    [INGREDIENT_TYPES.CHEDDAR]: 500,       // Cheddar + Cheddar = 500
    [INGREDIENT_TYPES.SMALL_PIZZA]: 1000,  // Small Pizza + Small Pizza = 1000
    [INGREDIENT_TYPES.MEDIUM_PIZZA]: 4000, // Medium Pizza + Medium Pizza = 4000
    [INGREDIENT_TYPES.ULTIMATE_PIZZA]: 10000 // Ultimate Pizza = 10000
});

// Validation function to ensure score integrity
function validateScore(type, score) {
    const expectedScore = FUSION_SCORES[type];
    if (typeof expectedScore !== 'number') {
        console.error(`Invalid ingredient type: ${type}`);
        return 0;
    }
    if (score !== expectedScore) {
        console.error(`Score validation failed for type ${INGREDIENT_NAMES[type]}. Expected: ${expectedScore}, Got: ${score}`);
        return expectedScore;
    }
    return expectedScore;
}

// Replace SCORES with a strict getter to ensure validation
const SCORES = new Proxy(FUSION_SCORES, {
    get: function(target, prop) {
        if (prop in target) {
            const type = parseInt(prop);
            const score = target[prop];
            return validateScore(type, score);
        }
        console.error(`Attempted to access invalid score type: ${prop}`);
        return 0;
    }
});

// Preload images
const INGREDIENT_IMAGES = {};

function preloadImages() {
    return new Promise((resolve) => {
        let loadedImages = 0;
        const totalImages = INGREDIENT_NAMES.length;
        let hasErrors = false;

        function onLoad() {
            loadedImages++;
            if (loadedImages === totalImages) {
                console.log('All images loaded' + (hasErrors ? ' (with some errors)' : ''));
                resolve();
            }
        }

        function onError(e) {
            console.error('Error loading image:', e.target.src);
            hasErrors = true;
            onLoad(); // Count error as loaded to avoid blocking the game
        }

        INGREDIENT_NAMES.forEach((name, index) => {
            const img = new Image();
            img.onload = onLoad;
            img.onerror = onError;
            
            // Use the correct path to the ingredients folder
            img.src = `Assets/Images/Ingredients/${name}.png`;
            
            INGREDIENT_IMAGES[index] = img;
        });

        // Set a timeout to resolve anyway after 5 seconds
        setTimeout(() => {
            if (loadedImages < totalImages) {
                console.warn('Some images failed to load within timeout');
                resolve();
            }
        }, 5000);
    });
}

// Make these available globally
window.INGREDIENT_NAMES = INGREDIENT_NAMES;
window.INGREDIENT_TYPES = INGREDIENT_TYPES;
window.SCORES = SCORES;
window.INGREDIENT_IMAGES = INGREDIENT_IMAGES;
window.preloadImages = preloadImages;

class Ingredient {
    constructor(type, x, y, world) {
        this.type = type;
        
        // Calculate size based on tier with special scaling for pizzas
        const baseSize = GAME_CONFIG.INGREDIENT_SIZE;
        let scaleFactor;
        
        if (type <= INGREDIENT_TYPES.CHEDDAR) {
            // Normal ingredients start larger and scale faster (30% per tier)
            scaleFactor = 1.3 + (type * 0.3);
        } else {
            // Pizzas get extra scaling
            switch(type) {
                case INGREDIENT_TYPES.SMALL_PIZZA:
                    scaleFactor = 3.5;
                    break;
                case INGREDIENT_TYPES.MEDIUM_PIZZA:
                    scaleFactor = 4.0;
                    break;
                case INGREDIENT_TYPES.ULTIMATE_PIZZA:
                    scaleFactor = 5.0;
                    break;
                default:
                    scaleFactor = 1.3 + (type * 0.3);
            }
        }
        
        this.size = baseSize * scaleFactor;
        
        // Create the body with more natural physics properties
        const radius = this.size / 2;
        this.body = Matter.Bodies.circle(x, y, radius, {
            restitution: 0.3,      // Slightly increased bounce for better interaction
            friction: 0.9,         // Increased friction to prevent sliding
            density: 0.001,        // Reduced density for lighter feel
            frictionAir: 0.005,    // Increased air resistance to slow rotation
            frictionStatic: 1.0,   // Maximum static friction to prevent rolling
            slop: 0.05,           // Increased slop for more forgiving collisions
            chamfer: { radius: 2 }, // Slightly rounded edges
            collisionFilter: {
                category: 0x0001,
                mask: 0xFFFF
            }
        });

        // Add angular damping and limit angular velocity
        this.body.angularDamping = 0.3;  // Increased angular damping
        this.body.angularSpeed = 0.15;   // Limit maximum angular speed
        this.body.torque = 0;           // Reset initial torque
        
        // Add custom properties for rotation control
        this.body.plugin = {
            angularVelocityLimit: Math.PI / 4  // Limit to 45 degrees per frame
        };
        
        // Ensure proper collision detection
        this.body.ingredient = this;
        this.body.radius = radius;
        
        Matter.World.add(world, this.body);
        
        // Store creation time
        this.creationTime = Date.now();
        this.lastFallCheck = Date.now();
    }

    draw(ctx) {
        const pos = this.body.position;
        const angle = this.body.angle;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(angle);
        
        // Draw the image centered and scaled
        const drawSize = this.size;
        const image = INGREDIENT_IMAGES[this.type];
        
        if (image && image.complete && image.naturalHeight !== 0) {
            // If image is loaded successfully, draw it
            ctx.drawImage(
                image,
                -drawSize/2,
                -drawSize/2,
                drawSize,
                drawSize
            );
        } else {
            // Fallback to colored circle if image is not loaded
            ctx.beginPath();
            ctx.arc(0, 0, drawSize/2, 0, Math.PI * 2);
            ctx.fillStyle = this.getFallbackColor();
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
    }

    getFallbackColor() {
        // Fallback colors for when images fail to load
        const colors = [
            '#2D5A27', // Olive
            '#8B7355', // Mushroom
            '#E3D7D7', // Onion
            '#C41E3A', // Pepperoni
            '#FF6347', // Tomato
            '#FFF5EE', // Muzzarela
            '#FAFAD2', // Cheddar
            '#FFD700', // Small Pizza
            '#FFA500', // Medium Pizza
            '#FF4500'  // Ultimate Pizza
        ];
        return colors[this.type] || '#CCC';
    }

    checkStability() {
        const velocity = this.body.velocity;
        const angularVelocity = this.body.angularVelocity;
        
        // More strict stability check
        return Math.abs(velocity.y) < 0.1 && 
               Math.abs(velocity.x) < 0.1 && 
               Math.abs(angularVelocity) < 0.01;
    }

    forceFall() {
        const now = Date.now();
        if (now - this.lastFallCheck > 300) { // Check interval
            this.lastFallCheck = now;
            
            if (!this.checkStability()) {
                // Apply a gentler force and limit rotation
                const currentVel = this.body.velocity;
                const targetVel = {
                    x: currentVel.x * 0.95, // Dampen horizontal movement
                    y: Math.max(currentVel.y, 1.5)  // Ensure downward movement
                };
                
                Matter.Body.setVelocity(this.body, targetVel);
                
                // Limit angular velocity if it's too high
                if (Math.abs(this.body.angularVelocity) > this.body.plugin.angularVelocityLimit) {
                    const direction = this.body.angularVelocity > 0 ? 1 : -1;
                    Matter.Body.setAngularVelocity(
                        this.body,
                        direction * this.body.plugin.angularVelocityLimit
                    );
                }
            }
        }
    }

    canFuse(other) {
        return this.type === other.type && this.type !== INGREDIENT_TYPES.ULTIMATE_PIZZA;
    }

    getNextType() {
        return this.type < INGREDIENT_TYPES.ULTIMATE_PIZZA ? this.type + 1 : this.type;
    }

    getScore() {
        return SCORES[this.type];
    }

    remove(world) {
        Matter.World.remove(world, this.body);
    }
}

class IngredientManager {
    constructor(world) {
        this.world = world;
        this.ingredients = new Set();
        this.ultimatePizzaFormed = false;
    }

    getRandomInitialType() {
        const maxInitialType = INGREDIENT_TYPES.TOMATO;
        return Math.floor(Math.random() * (maxInitialType + 1));
    }

    createIngredient(x, y, type) {
        if (type === undefined || type === null) {
            console.error('Ingredient type is required');
            return null;
        }
        
        // Create the ingredient with the specified type
        const ingredient = new Ingredient(type, x, y, this.world);
        this.ingredients.add(ingredient);
        return ingredient;
    }

    removeIngredient(ingredient) {
        ingredient.remove(this.world);
        this.ingredients.delete(ingredient);
    }

    checkFusions() {
        if (this.ingredients.size < 2) return { fusions: 0, type: null };

        const bodies = Array.from(this.ingredients).map(i => i.body);
        
        const detector = Matter.Detector.create({
            bodies: bodies
        });
        
        const collisions = Matter.Detector.collisions(detector);
        
        const fusedPairs = new Set();
        const toRemove = new Set();
        const toAdd = [];
        let fusionSourceType = null;  // Track the type of ingredients being fused

        collisions.forEach(collision => {
            const ingredientA = collision.bodyA.ingredient;
            const ingredientB = collision.bodyB.ingredient;

            if (!ingredientA || !ingredientB) return;
            if (fusedPairs.has(ingredientA) || fusedPairs.has(ingredientB)) return;
            if (!ingredientA.canFuse(ingredientB)) return;

            fusedPairs.add(ingredientA);
            fusedPairs.add(ingredientB);
            toRemove.add(ingredientA);
            toRemove.add(ingredientB);

            // Store the type of ingredients being fused (they're the same type)
            fusionSourceType = ingredientA.type;
            
            const nextType = ingredientA.getNextType();
            
            // Create new ingredient if not at max level
            if (nextType !== ingredientA.type) {
                const midX = (ingredientA.body.position.x + ingredientB.body.position.x) / 2;
                const midY = (ingredientA.body.position.y + ingredientB.body.position.y) / 2;
                
                toAdd.push({
                    type: nextType,
                    x: midX,
                    y: midY
                });
            }
        });

        // Remove fused ingredients and add new ones
        toRemove.forEach(ingredient => this.removeIngredient(ingredient));
        toAdd.forEach(({type, x, y}) => {
            const newIngredient = new Ingredient(type, x, y, this.world);
            this.ingredients.add(newIngredient);
        });

        return { fusions: toAdd.length, type: fusionSourceType };
    }

    clearAllIngredients() {
        const ingredientsArray = Array.from(this.ingredients);
        ingredientsArray.forEach(ingredient => {
            this.removeIngredient(ingredient);
        });
        this.ingredients.clear();
        this.ultimatePizzaFormed = false;
    }

    draw(ctx) {
        this.ingredients.forEach(ingredient => ingredient.draw(ctx));
    }

    checkGameOver(bounds) {
        // Don't check empty game
        if (this.ingredients.size === 0) return false;

        return Array.from(this.ingredients).some(ingredient => {
            const pos = ingredient.body.position;
            const vel = ingredient.body.velocity;
            
            // Only check for game over if the ingredient is stable (not falling fast)
            const isStable = Math.abs(vel.y) < 0.1;
            
            // Check if any stable ingredient is above the top boundary
            return isStable && (pos.y - ingredient.size/2 <= bounds.min.y);
        });
    }

    forceIngredientsToFall() {
        this.ingredients.forEach(ingredient => {
            ingredient.forceFall();
        });
    }
}

// Make classes available globally
window.Ingredient = Ingredient;
window.IngredientManager = IngredientManager; 