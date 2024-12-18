document.addEventListener('DOMContentLoaded', () => {
    let game = null;
    let currentPlayerName = '';

    function updateLeaderboard() {
        const leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
        const scoresList = document.getElementById('scores-list');
        scoresList.innerHTML = leaderboard
            .map((entry, index) => `<div>${index + 1}. ${entry.name || 'Anonymous'} - ${entry.score}</div>`)
            .join('');
    }

    function showScreen(screenId) {
        // Remove all screen classes from body
        document.body.classList.remove('start-screen', 'game-screen');
        
        // Add appropriate class based on screen
        if (screenId === 'start-screen') {
            document.body.classList.add('start-screen');
        } else if (screenId === 'game-screen') {
            document.body.classList.add('game-screen');
        }

        // Show the correct screen
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    async function startGame() {
        showScreen('game-screen');
        // Preload images before starting the game
        try {
            await preloadImages();
            game = new Game();
            game.startGame();
        } catch (error) {
            console.error('Error loading images:', error);
            // Start the game anyway
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

    // Handle Enter key in name input
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
            // Start the game anyway
            game = new Game();
        }
    });

    // Listener para redimensionamento do jogo
    window.addEventListener('gameResized', (event) => {
        if (game) {
            // Salvar estado atual
            const currentScore = game.score;
            const currentIngredients = game.nextIngredients;
            const currentCombo = game.comboMultiplier;
            
            // Recriar o jogo com as novas dimensões
            game = new Game();
            
            // Restaurar estado
            game.score = currentScore;
            game.nextIngredients = currentIngredients;
            game.comboMultiplier = currentCombo;
            game.updateNextIngredientDisplay();
        }
    });

    // Modificar o Game Over para incluir o nome do jogador
    Game.prototype.handleGameOver = function() {
        // Hide sequence board
        const sequenceBoard = document.getElementById('sequence-board');
        if (sequenceBoard) {
            sequenceBoard.style.display = 'none';
        }

        document.getElementById('game-screen').classList.add('hidden');
        const gameOverScreen = document.getElementById('game-over-screen');
        gameOverScreen.classList.remove('hidden');
        document.getElementById('final-score').textContent = `Final Score: ${this.score}`;
        
        // Update leaderboard with player name
        const leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
        leaderboard.push({
            name: currentPlayerName,
            score: this.score
        });
        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard.splice(5); // Keep only top 5
        localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
        updateLeaderboard();

        // Parar a música quando o jogo acabar
        this.audioManager.stopMusic();
    };

    // Initialize
    updateLeaderboard();
    showScreen('start-screen');
}); 