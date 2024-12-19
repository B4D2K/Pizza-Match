document.addEventListener('DOMContentLoaded', () => {
    let game = null;
    let currentPlayerName = '';

    // Unified leaderboard handling
    const LeaderboardManager = {
        getScores() {
            return JSON.parse(localStorage.getItem('leaderboard') || '[]');
        },
        
        addScore(name, score) {
            const leaderboard = this.getScores();
            leaderboard.push({ name, score });
            leaderboard.sort((a, b) => b.score - a.score);
            leaderboard.splice(5); // Keep top 5 scores
            localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
        },
        
        updateDisplay() {
            const scoresList = document.getElementById('scores-list');
            const scores = this.getScores();
            scoresList.innerHTML = scores
                .map((entry, index) => `<div>${index + 1}. ${entry.name || 'Anonymous'} - ${entry.score}</div>`)
                .join('');
        }
    };

    function showScreen(screenId) {
        document.body.classList.remove('start-screen', 'game-screen');
        
        if (screenId === 'start-screen') {
            document.body.classList.add('start-screen');
        } else if (screenId === 'game-screen') {
            document.body.classList.add('game-screen');
        }

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    async function startGame() {
        showScreen('game-screen');
        try {
            await preloadImages();
            game = new Game();
            game.startGame();
        } catch (error) {
            console.error('Error loading images:', error);
            alert('Some game assets failed to load. The game may not work correctly.');
            game = new Game();
        }
    }

    function showNameScreen() {
        showScreen('player-name-screen');
        document.getElementById('player-name').focus();
    }

    function handleNameConfirmation() {
        const nameInput = document.getElementById('player-name');
        currentPlayerName = nameInput.value.trim() || 'Anonymous';
        startGame();
    }

    // Event Listeners
    document.getElementById('start-button').addEventListener('click', () => {
        showNameScreen();
    });

    document.getElementById('confirm-name').addEventListener('click', handleNameConfirmation);
    document.getElementById('skip-name').addEventListener('click', () => {
        currentPlayerName = 'Anonymous';
        startGame();
    });

    document.getElementById('player-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleNameConfirmation();
        }
    });

    document.getElementById('restart-button').addEventListener('click', async () => {
        showScreen('game-screen');
        try {
            await preloadImages();
            game = new Game();
        } catch (error) {
            console.error('Error loading images:', error);
            alert('Some game assets failed to load. The game may not work correctly.');
            game = new Game();
        }
    });

    document.getElementById('music-mute-btn').addEventListener('click', () => {
        if (game && game.audioManager) {
            game.audioManager.toggleMute();
        }
    });

    // Improved resize handling
    let resizeTimeout;
    window.addEventListener('gameResized', (event) => {
        if (game) {
            // Debounce resize handling
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Save current game state
                const gameState = {
                    score: game.score,
                    nextIngredients: game.nextIngredients,
                    comboMultiplier: game.comboMultiplier,
                    audioMuted: game.audioManager.isMuted
                };
                
                // Recreate game with new dimensions
                game = new Game();
                
                // Restore state
                game.score = gameState.score;
                game.nextIngredients = gameState.nextIngredients;
                game.comboMultiplier = gameState.comboMultiplier;
                if (gameState.audioMuted) {
                    game.audioManager.toggleMute();
                }
                game.updateNextIngredientDisplay();
            }, 250); // Wait for resize to finish
        }
    });

    // Modify Game Over handling
    Game.prototype.handleGameOver = function() {
        const sequenceBoard = document.getElementById('sequence-board');
        if (sequenceBoard) {
            sequenceBoard.style.display = 'none';
        }

        document.getElementById('game-screen').classList.add('hidden');
        const gameOverScreen = document.getElementById('game-over-screen');
        gameOverScreen.classList.remove('hidden');
        document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
        
        // Update leaderboard with unified handling
        LeaderboardManager.addScore(currentPlayerName, this.score);
        LeaderboardManager.updateDisplay();

        this.audioManager.stopMusic();
    };

    // Initialize
    LeaderboardManager.updateDisplay();
    showScreen('start-screen');
}); 