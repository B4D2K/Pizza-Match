class Game {
    constructor() {
        // Inicializar o gerenciador de áudio primeiro
        this.audioManager = new AudioManager();
        
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
        this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
        
        // Load box frame image
        this.boxFrameImage = new Image();
        this.boxFrameImage.src = 'Assets/Images/Box_Frame.png';
        
        // Create sequence board
        this.createSequenceBoard();
        
        // Setup Matter.js with more realistic physics
        this.engine = Matter.Engine.create({
            positionIterations: 10,
            velocityIterations: 8,
            constraintIterations: 4,
            enableSleeping: false
        });
        
        this.world = this.engine.world;
        this.world.gravity.y = 0.98;

        // Create box boundaries that match the frame
        const wallOptions = {
            isStatic: true,
            friction: 0.3,
            restitution: 0.2,
            density: 1,
            slop: 0.05,
            chamfer: { radius: 2 }
        };

        // Calculate actual collision boundaries to match the frame
        const frameThickness = GAME_CONFIG.FRAME_THICKNESS;
        
        // Usar as configurações atualizadas da caixa
        this.bounds = {
            min: { 
                x: GAME_CONFIG.BOX_X + frameThickness, 
                y: GAME_CONFIG.BOX_Y + frameThickness
            },
            max: { 
                x: GAME_CONFIG.BOX_X + GAME_CONFIG.BOX_WIDTH - frameThickness, 
                y: GAME_CONFIG.BOX_Y + GAME_CONFIG.BOX_HEIGHT - frameThickness
            }
        };

        // Create walls that match the frame boundaries
        this.walls = [
            // Bottom wall
            Matter.Bodies.rectangle(
                GAME_CONFIG.BOX_X + GAME_CONFIG.BOX_WIDTH/2,
                GAME_CONFIG.BOX_Y + GAME_CONFIG.BOX_HEIGHT,
                GAME_CONFIG.BOX_WIDTH - frameThickness * 2,
                frameThickness,
                wallOptions
            ),
            // Left wall
            Matter.Bodies.rectangle(
                GAME_CONFIG.BOX_X,
                GAME_CONFIG.BOX_Y + GAME_CONFIG.BOX_HEIGHT/2,
                frameThickness,
                GAME_CONFIG.BOX_HEIGHT,
                wallOptions
            ),
            // Right wall
            Matter.Bodies.rectangle(
                GAME_CONFIG.BOX_X + GAME_CONFIG.BOX_WIDTH,
                GAME_CONFIG.BOX_Y + GAME_CONFIG.BOX_HEIGHT/2,
                frameThickness,
                GAME_CONFIG.BOX_HEIGHT,
                wallOptions
            )
        ];

        // Add collision filtering to walls
        this.walls.forEach(wall => {
            wall.collisionFilter = {
                category: 0x0002,
                mask: 0xFFFF
            };
        });

        Matter.World.add(this.world, this.walls);

        // Setup engine with fixed timestep
        const runner = Matter.Runner.create({
            isFixed: true,
            delta: 16.666 // 60 FPS
        });
        Matter.Runner.run(runner, this.engine);
        
        this.ingredientManager = new IngredientManager(this.world);
        this.score = 0;
        this.isGameOver = false;
        this.currentIngredientX = this.canvas.width / 2;
        this.lastDropTime = 0;
        this.dropDelay = 300;

        // Combo system
        this.comboMultiplier = 1;
        this.maxComboMultiplier = 10;
        this.fusionsInDrop = 0;
        this.isStabilizing = false;
        this.canSpawnNew = true;
        this.stabilityCheckDelay = 600;
        this.lastStabilityCheck = 0;
        this.stabilityCheckInterval = 50;
        this.maxStabilizeTime = 2500; // Maximum time to wait for stabilization (2.5 seconds)

        // Next ingredients preview (now storing 3 ingredients)
        this.nextIngredients = [
            this.ingredientManager.getRandomInitialType(), // Current
            this.ingredientManager.getRandomInitialType(), // Next
            this.ingredientManager.getRandomInitialType()  // Then
        ];

        // Update next ingredient display
        this.updateNextIngredientDisplay();

        // Event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));

        // Add drag state
        this.isDragging = false;
        this.dragStartY = 0;
        this.maxDragY = GAME_CONFIG.BOX_Y;

        // Update event listeners for drag and drop
        this.canvas.addEventListener('touchstart', this.handleDragStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleDrag.bind(this));
        this.canvas.addEventListener('touchend', this.handleDragEnd.bind(this));
        this.canvas.addEventListener('mousedown', this.handleDragStart.bind(this));
        this.canvas.addEventListener('mousemove', this.handleDrag.bind(this));
        this.canvas.addEventListener('mouseup', this.handleDragEnd.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleDragEnd.bind(this));

        // Start game loop
        this.gameLoop();

        this.comboQueue = [];
        this.isShowingCombo = false;
        this.comboDelay = 300; // 0.3 seconds delay between combos
    }

    createSequenceBoard() {
        // Create sequence board container
        const sequenceBoard = document.createElement('div');
        sequenceBoard.id = 'sequence-board';
        
        // Create and set up image
        const img = document.createElement('img');
        img.src = 'Assets/Images/HUD/Sequency_Board.png';
        img.alt = 'Sequence Board';
        
        // Add image to container
        sequenceBoard.appendChild(img);
        
        // Add to game screen
        document.getElementById('game-screen').appendChild(sequenceBoard);
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        
        // Calculate size for current ingredient
        const currentType = this.nextIngredients[0];
        const scaleFactor = 1.3 + (currentType * 0.3);
        const nextSize = GAME_CONFIG.INGREDIENT_SIZE * scaleFactor;
        const halfSize = nextSize / 2;
        
        // Adjust boundaries based on ingredient size and safety margin
        const boxMinX = GAME_CONFIG.BOX_X + GAME_CONFIG.FRAME_THICKNESS + GAME_CONFIG.SPAWN_MARGIN;
        const boxMaxX = GAME_CONFIG.BOX_X + GAME_CONFIG.BOX_WIDTH - GAME_CONFIG.FRAME_THICKNESS - GAME_CONFIG.SPAWN_MARGIN;
        
        this.currentIngredientX = Math.max(boxMinX, 
            Math.min(boxMaxX, canvasX));
    }

    handleClick() {
        if (this.isGameOver || this.isStabilizing) return;
        
        // Tentar tocar a música no primeiro clique também
        this.audioManager.playMusic();
        
        const now = Date.now();
        if (now - this.lastDropTime >= this.dropDelay) {
            // Tocar som de toque
            this.audioManager.playTouchSound();
            this.dropIngredient();
            this.lastDropTime = now;
            this.isStabilizing = true;
            this.fusionsInDrop = 0;
        }
    }

    dropIngredient() {
        const spawnY = GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT;
        
        // Create ingredient with the current type
        this.ingredientManager.createIngredient(
            this.currentIngredientX,
            spawnY,
            this.nextIngredients[0]
        );

        // Shift queue and add new random ingredient
        this.nextIngredients.shift();
        this.nextIngredients.push(this.ingredientManager.getRandomInitialType());
        
        // Update display
        this.updateNextIngredientDisplay();
    }

    updateNextIngredientDisplay() {
        // Create HTML for the next ingredients table
        const tableHTML = `
            <table class="next-ingredients">
                <tr>
                    <th>Next:</th>
                    <td>
                        <canvas id="preview-next" width="40" height="40"></canvas>
                    </td>
                </tr>
                <tr>
                    <th>Then:</th>
                    <td>
                        <canvas id="preview-then" width="40" height="40"></canvas>
                    </td>
                </tr>
            </table>
        `;

        // Update the HTML
        document.getElementById('next-ingredient').innerHTML = tableHTML;

        // Draw the previews
        const nextIngredients = this.nextIngredients.slice(1, 3);
        nextIngredients.forEach((type, index) => {
            const canvasId = index === 0 ? 'preview-next' : 'preview-then';
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');

            // Clear the canvas
            ctx.clearRect(0, 0, 40, 40);

            // Use preloaded image
            const previewImage = INGREDIENT_IMAGES[type];
            if (previewImage && previewImage.complete && previewImage.naturalHeight !== 0) {
                ctx.drawImage(previewImage, 5, 5, 30, 30);
            } else {
                // Fallback to colored circle
                ctx.beginPath();
                ctx.arc(20, 20, 15, 0, Math.PI * 2);
                ctx.fillStyle = this.getFallbackColor(type);
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    getFallbackColor(type) {
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
        return colors[type] || '#CCC';
    }

    checkStability() {
        // Check if all ingredients are stable (not moving significantly)
        return Array.from(this.ingredientManager.ingredients).every(ingredient => {
            const velocity = ingredient.body.velocity;
            const angularVelocity = ingredient.body.angularVelocity;
            return Math.abs(velocity.y) < 0.1 && 
                   Math.abs(velocity.x) < 0.1 && 
                   Math.abs(angularVelocity) < 0.01;
        });
    }

    updateScore(fusionResult) {
        if (fusionResult.fusions === -1) {
            // Ultimate Pizza formed - calculate bonus
            const ultimateBonus = SCORES[INGREDIENT_TYPES.ULTIMATE_PIZZA];
            
            // Validate the bonus score
            if (ultimateBonus !== 10000) {
                console.error('Invalid Ultimate Pizza score');
                return;
            }
            
            // Count remaining ingredients for extra bonus (excluding the Ultimate Pizza)
            const remainingIngredients = this.ingredientManager.ingredients.size - 1;
            const bonusPerIngredient = 1000; // 1000 points per ingredient destroyed
            const extraBonus = remainingIngredients * bonusPerIngredient;
            
            // Add the total bonus to the score
            const totalBonus = ultimateBonus + extraBonus;
            
            // Disable physics and spawn during display
            this.canSpawnNew = false;
            this.isStabilizing = true;
            
            // Stop the physics engine and clear any pending forces
            Matter.Runner.stop(this.engine);
            Matter.Engine.clear(this.engine);
            
            // Get the Ultimate Pizza image
            const ultimateImage = INGREDIENT_IMAGES[INGREDIENT_TYPES.ULTIMATE_PIZZA];
            
            // Show static display and bonus
            this.showStaticUltimatePizza(totalBonus, remainingIngredients);
            this.showUltimateBonusEffect(totalBonus, remainingIngredients);
            
            // Play fusion sound
            this.audioManager.playFusionSound();
            
            // Update score and UI
            this.score += totalBonus;
            this.updateUI();
            
            // Clean up and reset after animation
            setTimeout(() => {
                // Clear all ingredients and reset physics
                this.ingredientManager.clearAllIngredients();
                Matter.Engine.clear(this.engine);
                
                // Reset game state
                this.comboMultiplier = 1;
                this.fusionsInDrop = 0;
                this.isStabilizing = false;
                
                // Reset wall physics
                this.walls.forEach(wall => {
                    Matter.Body.setStatic(wall, true);
                    Matter.Body.setVelocity(wall, { x: 0, y: 0 });
                    Matter.Body.setAngularVelocity(wall, 0);
                    Matter.Sleeping.set(wall, false);
                });
                
                // Restart physics engine
                Matter.Runner.start(this.engine);
                
                // Allow new spawns after physics is stable
                setTimeout(() => {
                    this.canSpawnNew = true;
                    this.lastDropTime = Date.now();
                }, 100);
            }, 1500);
        } else if (fusionResult.fusions > 0) {
            // Tocar som de fusão para cada fusão que ocorrer
            this.audioManager.playFusionSound();
            
            // Update fusion count and combo
            this.fusionsInDrop += fusionResult.fusions;
            
            // Calculate combo based on fusions in this drop
            if (this.fusionsInDrop >= 2) {
                this.comboMultiplier = Math.min(this.maxComboMultiplier, this.fusionsInDrop);
            } else {
                this.comboMultiplier = 1;
            }
            
            // Get and validate the score for the fusion result type
            const baseScore = SCORES[fusionResult.type];
            
            // Additional validation for score values
            if (baseScore === undefined || baseScore <= 0) {
                console.error('Invalid fusion score:', fusionResult.type, baseScore);
                return;
            }
            
            // Calculate combo score
            const comboScore = baseScore * this.comboMultiplier;
            
            // Add to total score
            this.score += comboScore;
            
            // Show combo effect if active
            if (this.comboMultiplier > 1) {
                this.showComboEffect(comboScore);
            }
            
            // Log score for debugging
            console.log(`Fusion: ${INGREDIENT_NAMES[fusionResult.type]}, Score: ${baseScore}, Combo: ${this.comboMultiplier}x, Total: ${comboScore}`);
        }
    }

    showStaticUltimatePizza(totalBonus, remainingIngredients) {
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the box frame
        this.drawBox();
        
        // Get the Ultimate Pizza image
        const ultimateImage = INGREDIENT_IMAGES[INGREDIENT_TYPES.ULTIMATE_PIZZA];
        
        // Calculate center position
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Draw the Ultimate Pizza image centered
        if (ultimateImage && ultimateImage.complete && ultimateImage.naturalHeight !== 0) {
            const size = GAME_CONFIG.INGREDIENT_SIZE * 5.0;
            ctx.save();
            ctx.translate(centerX, centerY);
            
            // Add a glow effect
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            
            ctx.drawImage(
                ultimateImage,
                -size/2,
                -size/2,
                size,
                size
            );
            ctx.restore();
        } else {
            console.error('Ultimate Pizza image not loaded properly');
            // Fallback to a colored circle with glow
            ctx.save();
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(centerX, centerY, GAME_CONFIG.INGREDIENT_SIZE * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#FF4500';
            ctx.fill();
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }
    }

    showUltimateBonusEffect(totalBonus, remainingIngredients) {
        // Create and show bonus text element
        const bonusText = document.createElement('div');
        bonusText.className = 'ultimate-bonus';
        bonusText.textContent = `ULTIMATE PIZZA! +${totalBonus}`;
        if (remainingIngredients > 0) {
            bonusText.textContent += `\n+${remainingIngredients * 1000} BONUS (${remainingIngredients} ingredients)`;
        }
        document.getElementById('game-screen').appendChild(bonusText);

        // Remove the element after 1.5 seconds (matching the static display time)
        setTimeout(() => {
            bonusText.remove();
        }, 1500);
    }

    showComboEffect(score) {
        // Add combo to queue
        this.comboQueue.push({
            fusionsInDrop: this.fusionsInDrop,
            comboMultiplier: this.comboMultiplier,
            score: score
        });

        // If not currently showing a combo, start processing the queue
        if (!this.isShowingCombo) {
            this.processComboQueue();
        }
    }

    processComboQueue() {
        if (this.comboQueue.length === 0) {
            this.isShowingCombo = false;
            return;
        }

        this.isShowingCombo = true;
        const combo = this.comboQueue.shift();
        
        const comboText = document.createElement('div');
        comboText.className = 'combo-text';
        comboText.textContent = `${combo.fusionsInDrop} CHAIN! ${combo.comboMultiplier}x COMBO! +${combo.score}`;
        document.getElementById('game-screen').appendChild(comboText);

        setTimeout(() => {
            comboText.remove();
            // Process next combo after delay
            setTimeout(() => {
                this.processComboQueue();
            }, this.comboDelay);
        }, 1000);
    }

    checkGameOver() {
        // Only check for game over if ingredients have had time to fall
        const now = Date.now();
        if (now - this.lastDropTime < 1000) return; // Wait 1 second after drop

        if (this.ingredientManager.checkGameOver(this.bounds)) {
            this.isGameOver = true;
            this.handleGameOver();
        }
    }

    handleGameOver() {
        // Hide sequence board
        const sequenceBoard = document.getElementById('sequence-board');
        if (sequenceBoard) {
            sequenceBoard.style.display = 'none';
        }

        document.getElementById('game-screen').classList.add('hidden');
        const gameOverScreen = document.getElementById('game-over-screen');
        gameOverScreen.classList.remove('hidden');
        document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
        
        // Update leaderboard
        const scores = JSON.parse(localStorage.getItem('highScores') || '[]');
        scores.push(this.score);
        scores.sort((a, b) => b - a);
        scores.splice(5); // Keep only top 5
        localStorage.setItem('highScores', JSON.stringify(scores));

        // Parar a música quando o jogo acabar
        this.audioManager.stopMusic();
    }

    drawBox() {
        // Clear the box area first
        this.ctx.clearRect(
            GAME_CONFIG.BOX_X - GAME_CONFIG.FRAME_THICKNESS,
            GAME_CONFIG.BOX_Y - GAME_CONFIG.FRAME_THICKNESS,
            GAME_CONFIG.BOX_WIDTH + GAME_CONFIG.FRAME_THICKNESS * 2,
            GAME_CONFIG.BOX_HEIGHT + GAME_CONFIG.FRAME_THICKNESS * 2
        );
        
        // Draw the box frame image if it's loaded
        if (this.boxFrameImage.complete && this.boxFrameImage.naturalHeight !== 0) {
            this.ctx.drawImage(
                this.boxFrameImage,
                GAME_CONFIG.BOX_X - GAME_CONFIG.FRAME_THICKNESS,
                GAME_CONFIG.BOX_Y - GAME_CONFIG.FRAME_THICKNESS,
                GAME_CONFIG.BOX_WIDTH + GAME_CONFIG.FRAME_THICKNESS * 2,
                GAME_CONFIG.BOX_HEIGHT + GAME_CONFIG.FRAME_THICKNESS * 2
            );
        }

        // Draw spawn line with neon purple effect
        this.ctx.save();
        this.ctx.strokeStyle = '#b026ff'; // Cor roxa neon base
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([15, 10]); // Padrão tracejado mais definido
        
        // Adiciona o efeito de brilho
        this.ctx.shadowColor = '#b026ff';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.bounds.min.x, GAME_CONFIG.BOX_Y);
        this.ctx.lineTo(this.bounds.max.x, GAME_CONFIG.BOX_Y);
        this.ctx.stroke();
        
        // Restaura o contexto para não afetar outros desenhos
        this.ctx.restore();
    }

    drawNextIngredient() {
        // Only draw next ingredient if we can spawn new ones
        if (!this.canSpawnNew) return;

        const spawnY = this.isDragging ? this.dragStartY : GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT;
        
        // Draw drop line first (behind the preview)
        if (!this.isDragging) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#999';
            this.ctx.setLineDash([5, 5]);
            this.ctx.moveTo(this.currentIngredientX, spawnY);
            this.ctx.lineTo(this.currentIngredientX, GAME_CONFIG.BOX_Y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Draw the preview image
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        
        const previewType = this.nextIngredients[0];
        const scaleFactor = 1.3 + (previewType * 0.3);
        const previewSize = GAME_CONFIG.INGREDIENT_SIZE * scaleFactor;
        
        // Use preloaded image
        const previewImage = INGREDIENT_IMAGES[previewType];
        
        if (previewImage && previewImage.complete && previewImage.naturalHeight !== 0) {
            // If image is loaded successfully, draw it
            this.ctx.drawImage(
                previewImage,
                this.currentIngredientX - previewSize/2,
                spawnY - previewSize/2,
                previewSize,
                previewSize
            );
        } else {
            // Fallback to colored circle if image is not loaded
            this.ctx.beginPath();
            this.ctx.arc(
                this.currentIngredientX,
                spawnY,
                previewSize/2,
                0,
                Math.PI * 2
            );
            this.ctx.fillStyle = this.getFallbackColor(previewType);
            this.ctx.fill();
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    updateUI() {
        const scoreElement = document.getElementById('score');
        const oldScore = parseInt(scoreElement.textContent.split(': ')[1]) || 0;
        
        if (this.score !== oldScore) {
            scoreElement.textContent = `Score: ${this.score}`;
            scoreElement.classList.remove('score-update');
            void scoreElement.offsetWidth; // Force reflow
            scoreElement.classList.add('score-update');
        }
    }

    gameLoop(timestamp) {
        if (!this.isGameOver) {
            const now = Date.now();

            // Check stability if waiting
            if (this.isStabilizing && now - this.lastStabilityCheck >= this.stabilityCheckInterval) {
                this.lastStabilityCheck = now;
                const timeSinceLastDrop = now - this.lastDropTime;
                
                // Allow new spawn if either stable or max time reached
                if (this.checkStability() || timeSinceLastDrop >= this.maxStabilizeTime) {
                    if (timeSinceLastDrop >= this.stabilityCheckDelay) {
                        this.isStabilizing = false;
                        this.canSpawnNew = true;
                        
                        // Reset combo if no fusions occurred
                        if (this.fusionsInDrop === 0) {
                            this.comboMultiplier = 1;
                        }
                    }
                }
            }

            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw game elements
            this.drawBox();
            this.ingredientManager.draw(this.ctx);
            this.drawNextIngredient();
            
            // Check for fusions
            const fusionResult = this.ingredientManager.checkFusions();
            if (fusionResult.fusions !== 0) {
                this.updateScore(fusionResult);
                // Reset stability check after fusions
                this.isStabilizing = true;
                this.canSpawnNew = false;
                this.lastDropTime = now;
            }
            
            // Update UI
            this.updateUI();
            
            // Check game over condition
            this.checkGameOver();
            
            // Force ingredients to fall if they're stuck
            this.ingredientManager.forceIngredientsToFall();
            
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }

    handleDragStart(event) {
        if (this.isGameOver || this.isStabilizing || !this.canSpawnNew) return;

        const rect = this.canvas.getBoundingClientRect();
        const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
        const canvasY = clientY - rect.top;
        const spawnY = GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT;

        // Only start drag if clicking near the preview ingredient
        if (Math.abs(canvasY - spawnY) < 30) {
            this.isDragging = true;
            this.dragStartY = spawnY;
            // Tocar som de toque
            this.audioManager.playTouchSound();
            event.preventDefault();
        }
    }

    handleDrag(event) {
        if (!this.isDragging) return;
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
        const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Calculate size for current ingredient
        const currentType = this.nextIngredients[0];
        const scaleFactor = 1.3 + (currentType * 0.3);
        const nextSize = GAME_CONFIG.INGREDIENT_SIZE * scaleFactor;
        const halfSize = nextSize / 2;
        
        // Adjust boundaries based on ingredient size and safety margin
        const boxMinX = GAME_CONFIG.BOX_X + GAME_CONFIG.FRAME_THICKNESS + GAME_CONFIG.SPAWN_MARGIN;
        const boxMaxX = GAME_CONFIG.BOX_X + GAME_CONFIG.BOX_WIDTH - GAME_CONFIG.FRAME_THICKNESS - GAME_CONFIG.SPAWN_MARGIN;
        
        // Update position
        this.currentIngredientX = Math.max(boxMinX, Math.min(boxMaxX, canvasX));
        this.dragStartY = Math.min(
            GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT,
            Math.max(canvasY, this.maxDragY)
        );
    }

    handleDragEnd(event) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const now = Date.now();
        
        // Only drop if enough time has passed and we can spawn new ingredients
        if (now - this.lastDropTime >= this.dropDelay && this.canSpawnNew) {
            this.dropIngredient();
            this.lastDropTime = now;
            this.isStabilizing = true;
            this.canSpawnNew = false;
            this.fusionsInDrop = 0;
        }
        
        // Reset drag position
        this.dragStartY = GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT;
    }

    // Adicionar método para iniciar a música
    startGame() {
        // Tentar tocar a música
        this.audioManager.playMusic();
    }
} 