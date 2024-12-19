class AudioManager {
    constructor() {
        this.musicTheme = new Audio('Assets/Sounds/music_theme.mp3');
        this.musicTheme.loop = true;
        this.musicTheme.volume = 0.5;
        this.isPlaying = false;
        this.isMuted = false;
        
        // Som de fusão
        this.fusionSound = new Audio('./Assets/Sounds/SFX/fusion_sound.mp3');
        this.fusionSound.volume = 1.0;
        
        // Som de toque no ingrediente
        this.touchSound = new Audio('./Assets/Sounds/SFX/touch_ingredient.mp3');
        this.touchSound.volume = 0.6;
        
        // Adicionar múltiplos eventos para tentar iniciar a música
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.playMusic();
            }, { once: true });
        });
    }

    playMusic() {
        if (this.isPlaying || this.isMuted) return;
        
        const playPromise = this.musicTheme.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.isPlaying = true;
                console.log('Música iniciada com sucesso');
            }).catch(error => {
                console.log('Erro ao tocar música:', error);
                // Tentar novamente em 1 segundo
                setTimeout(() => this.playMusic(), 1000);
            });
        }
    }

    stopMusic() {
        this.musicTheme.pause();
        this.musicTheme.currentTime = 0;
        this.isPlaying = false;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.stopMusic();
        } else {
            this.playMusic();
        }
        // Atualizar o botão de música
        const musicBtn = document.getElementById('music-mute-btn');
        if (musicBtn) {
            musicBtn.classList.toggle('muted', this.isMuted);
        }
    }

    setVolume(volume) {
        this.musicTheme.volume = Math.max(0, Math.min(1, volume));
    }

    playFusionSound() {
        // Criar nova instância do som para permitir sobreposição
        const fusionInstance = this.fusionSound.cloneNode();
        fusionInstance.play().catch(error => {
            console.log("Erro ao tocar som de fusão:", error);
        });
    }

    playTouchSound() {
        const touchInstance = this.touchSound.cloneNode();
        touchInstance.play().catch(error => {
            console.log("Erro ao tocar som de toque:", error);
        });
    }
} 