document.addEventListener('DOMContentLoaded', () => {
    let game = null;

    function updateLeaderboard() {
        const scores = JSON.parse(localStorage.getItem('highScores') || '[]');
        const scoresList = document.getElementById('scores-list');
        scoresList.innerHTML = scores
            .map((score, index) => `<div>${index + 1}. ${score}</div>`)
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

    // Event Listeners
    document.getElementById('start-button').addEventListener('click', startGame);
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

    // Initialize
    updateLeaderboard();
    showScreen('start-screen');
}); 