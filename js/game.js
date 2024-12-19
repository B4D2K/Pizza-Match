class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createParticles(x, y, color, amount = 10) {
        for (let i = 0; i < amount; i++) {
            const angle = (Math.PI * 2 / amount) * i;
            const speed = 2 + Math.random() * 2;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: color,
                size: 4 + Math.random() * 4
            });
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Add gravity effect
            particle.vy += 0.1;
            
            // Fade out
            particle.life -= 0.02;
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const particle of this.particles) {
            ctx.globalAlpha = particle.life;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Game {
    constructor() {
        // Inicializar o gerenciador de áudio primeiro
        this.audioManager = new AudioManager();
        
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
        this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
        
        // Initialize particle system
        this.particleSystem = new ParticleSystem();
        
        // Load box frame image
        this.boxFrameImage = new Image();
        this.boxFrameImage.src = 'Assets/Images/Box_Frame.png';
        
        // Create sequence board
        this.createSequenceBoard();
        
        // Initialize stage
        this.currentStage = 1;
        this.currentBoxHeight = GAME_CONFIG.STAGES[0].height;
        
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
        this.maxComboMultiplier = 3; // Maximum 300% bonus
        this.comboTimer = null;
        this.comboTimeout = 4000; // 4 seconds to maintain combo
        this.currentComboCount = 0;
        this.lastFusionTime = 0;
        this.isComboActive = false;

        // Spawning and stability control
        this.isStabilizing = false;
        this.canSpawnNew = true;
        this.stabilityCheckDelay = 600;
        this.lastStabilityCheck = 0;
        this.stabilityCheckInterval = 50;
        this.maxStabilizeTime = 2500;

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
        if (this.isGameOver || !this.canSpawnNew) return;
        
        // Tentar tocar a música no primeiro clique também
        this.audioManager.playMusic();
        
        const now = Date.now();
        if (now - this.lastDropTime >= this.dropDelay) {
            // Tocar som de toque
            this.audioManager.playTouchSound();
            this.dropIngredient();
            this.lastDropTime = now;
            this.isStabilizing = true;
            this.canSpawnNew = false;
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
        if (fusionResult.fusions > 0) {
            // Tocar som de fusão para cada fusão que ocorrer
            this.audioManager.playFusionSound();
            
            // Create fusion particles
            fusionResult.fusionPositions.forEach(pos => {
                // Get ingredient color based on the fusion type
                let particleColor = this.getParticleColor(fusionResult.type);
                this.particleSystem.createParticles(pos.x, pos.y, particleColor, 15);
            });
            
            // Handle combo system
            const now = Date.now();
            
            // Check if this fusion is within the combo window
            if (now - this.lastFusionTime <= this.comboTimeout && this.isComboActive) {
                // Continue combo
                this.currentComboCount++;
            } else {
                // Start new combo
                this.currentComboCount = 1;
                this.comboMultiplier = 1;
            }
            
            // Update last fusion time
            this.lastFusionTime = now;
            
            // Clear existing combo timer
            if (this.comboTimer) {
                clearTimeout(this.comboTimer);
            }
            
            // Set new combo timer
            this.comboTimer = setTimeout(() => {
                this.endCombo();
            }, this.comboTimeout);
            
            // Calculate progressive multiplier
            // Each consecutive fusion adds 30% more to the multiplier
            this.comboMultiplier = Math.min(
                1 + (this.currentComboCount * 0.3),
                this.maxComboMultiplier
            );
            
            this.isComboActive = true;
            
            // Get and validate the score for the fusion result type
            const baseScore = SCORES[fusionResult.type];
            
            // Additional validation for score values
            if (baseScore === undefined || baseScore <= 0) {
                console.error('Invalid fusion score:', fusionResult.type, baseScore);
                return;
            }
            
            // Calculate combo score with progressive multiplier
            const comboScore = Math.floor(baseScore * this.comboMultiplier);
            
            // Add to total score
            this.score += comboScore;
            
            // Check for stage upgrade after score update
            this.checkForPhaseUpgrade();
            
            // Show combo effect
            if (this.comboMultiplier > 1) {
                this.showComboEffect(comboScore);
            }
            
            // Log score for debugging
            console.log(
                `Fusion: ${INGREDIENT_NAMES[fusionResult.type]}, ` +
                `Base Score: ${baseScore}, ` +
                `Combo: ${this.comboMultiplier.toFixed(2)}x (${this.currentComboCount} chain), ` +
                `Total: ${comboScore}`
            );
        }
    }

    endCombo() {
        this.isComboActive = false;
        this.currentComboCount = 0;
        this.comboMultiplier = 1;
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
    }

    showComboEffect(score) {
        // Add combo to queue
        this.comboQueue.push({
            comboCount: this.currentComboCount,
            multiplier: this.comboMultiplier,
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
        
        // Format the multiplier to show percentage increase
        const multiplierPercent = Math.round((combo.multiplier - 1) * 100);
        comboText.textContent = 
            `${combo.comboCount} CHAIN! +${multiplierPercent}% BONUS! +${combo.score}`;
        
        // Add a progress bar for the combo timer
        const progressBar = document.createElement('div');
        progressBar.className = 'combo-timer';
        comboText.appendChild(progressBar);
        
        document.getElementById('game-screen').appendChild(comboText);

        // Animate the progress bar
        progressBar.style.animation = `comboTimer ${this.comboTimeout}ms linear`;

        setTimeout(() => {
            comboText.remove();
            // Process next combo after delay
            setTimeout(() => {
                this.processComboQueue();
            }, this.comboDelay);
        }, 1000);
    }

    getParticleColor(type) {
        // Cores vibrantes e brilhantes para as partículas de fusão
        const colors = [
            '#4CAF50',  // Olive - Verde mais vibrante
            '#A1887F',  // Mushroom - Marrom mais claro e vibrante
            '#FFEBEE',  // Onion - Rosa bem claro e brilhante
            '#FF1744',  // Pepperoni - Vermelho vibrante
            '#FF5722',  // Tomato - Laranja avermelhado vibrante
            '#FAFAFA',  // Muzzarela - Branco brilhante
            '#FFF176',  // Cheddar - Amarelo vibrante
            '#FFD700',  // Small Pizza - Dourado brilhante
            '#FFA000',  // Medium Pizza - Laranja dourado
            '#FF3D00'   // Ultimate Pizza - Laranja avermelhado intenso
        ];
        return colors[type] || '#FFF';
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
                    }
                }
            }

            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw game elements
            this.drawBox();
            this.ingredientManager.draw(this.ctx);
            if (this.canSpawnNew) {
                this.drawNextIngredient();
            }
            
            // Update and draw particles
            this.particleSystem.update();
            this.particleSystem.draw(this.ctx);
            
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
        }
        
        // Reset drag position
        this.dragStartY = GAME_CONFIG.BOX_Y - GAME_CONFIG.SPAWN_HEIGHT;
    }

    // Adicionar método para iniciar a música
    startGame() {
        // Tentar tocar a música
        this.audioManager.playMusic();
    }

    checkForPhaseUpgrade() {
        const stages = GAME_CONFIG.STAGES;
        let newStage = this.currentStage;

        // Find the appropriate stage based on current score
        for (let i = stages.length - 1; i >= 0; i--) {
            if (this.score >= stages[i].points && i + 1 > this.currentStage) {
                newStage = i + 1;
                break;
            }
        }

        // If stage has changed
        if (newStage > this.currentStage) {
            const oldHeight = this.currentBoxHeight;
            this.currentStage = newStage;
            this.currentBoxHeight = stages[newStage - 1].height;

            // Update box configuration
            GAME_CONFIG.BOX_HEIGHT = this.currentBoxHeight;

            // Remove half of the lower tier ingredients
            this.removeLowerTierIngredients();

            // Recreate walls with new dimensions
            this.updateWalls();

            // Show stage upgrade message
            this.showStageUpgrade(newStage);

            // Log the stage change
            console.log(`Stage Up! Now at Stage ${this.currentStage}`);
            console.log(`Box height changed from ${oldHeight} to ${this.currentBoxHeight}`);
        }
    }

    removeLowerTierIngredients() {
        // Get all ingredients sorted by type (lower tier first)
        const sortedIngredients = Array.from(this.ingredientManager.ingredients)
            .sort((a, b) => a.type - b.type);

        // Calculate how many lower tier ingredients to remove (half of them)
        const lowerTierCount = Math.floor(sortedIngredients.length / 2);
        
        // Get the ingredients to remove (first half of sorted array)
        const ingredientsToRemove = sortedIngredients.slice(0, lowerTierCount);
        
        // Remove the selected ingredients
        ingredientsToRemove.forEach(ingredient => {
            Matter.World.remove(this.world, ingredient.body);
            this.ingredientManager.ingredients.delete(ingredient);
        });
        
        // Log the removal
        console.log(`Removed ${ingredientsToRemove.length} lower tier ingredients during phase change`);
    }

    updateWalls() {
        // Remove existing walls
        this.walls.forEach(wall => Matter.World.remove(this.world, wall));

        const frameThickness = GAME_CONFIG.FRAME_THICKNESS;
        const wallOptions = {
            isStatic: true,
            friction: 0.3,
            restitution: 0.2,
            density: 1,
            slop: 0.05,
            chamfer: { radius: 2 }
        };

        // Create new walls with updated dimensions
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
            Matter.World.add(this.world, wall);
        });
    }

    showStageUpgrade(stage) {
        const stageText = document.createElement('div');
        stageText.className = 'stage-text';
        stageText.textContent = `Stage ${stage}!`;
        document.getElementById('game-screen').appendChild(stageText);

        // Remove the element after animation
        setTimeout(() => {
            stageText.remove();
        }, 2000);
    }
} 