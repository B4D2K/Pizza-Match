class ResponsiveManager {
    constructor() {
        // Proporções base do jogo
        this.baseWidth = 320;
        this.baseHeight = 520;
        this.baseAspectRatio = this.baseWidth / this.baseHeight;
        
        // Elementos do jogo
        this.canvas = document.getElementById('game-canvas');
        this.gameContainer = document.getElementById('game-container');
        this.gameScreen = document.getElementById('game-screen');
        
        // Configurações base
        this.baseConfig = {
            size: 25,
            padding: 10,
            hudPadding: 12,
            hudTopMargin: 45,
            hudSideMargin: 10,
            hudSpacing: 60
        };
        
        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.updateCSSVariables = this.updateCSSVariables.bind(this);
        
        // Inicializar
        this.setupEventListeners();
        this.handleResize();
    }
    
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
    }
    
    calculateDimensions() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const windowAspectRatio = windowWidth / windowHeight;
        
        let gameWidth, gameHeight, scale;
        
        // Calcular dimensões mantendo proporção
        if (windowAspectRatio > this.baseAspectRatio) {
            // Tela mais larga que o jogo
            gameHeight = Math.min(windowHeight * 0.9, this.baseHeight * 1.5);
            gameWidth = gameHeight * this.baseAspectRatio;
            scale = gameHeight / this.baseHeight;
        } else {
            // Tela mais alta que o jogo
            gameWidth = Math.min(windowWidth * 0.9, this.baseWidth * 1.5);
            gameHeight = gameWidth / this.baseAspectRatio;
            scale = gameWidth / this.baseWidth;
        }
        
        // Garantir escala mínima
        scale = Math.max(scale, 0.5);
        
        return {
            width: Math.round(gameWidth),
            height: Math.round(gameHeight),
            scale: scale
        };
    }
    
    updateCSSVariables(scale) {
        const root = document.documentElement;
        const scaledConfig = {};
        
        // Calcular valores escalados
        Object.entries(this.baseConfig).forEach(([key, value]) => {
            scaledConfig[key] = Math.round(value * scale);
        });
        
        // Atualizar variáveis CSS
        root.style.setProperty('--base-size', `${scaledConfig.size}px`);
        root.style.setProperty('--game-padding', `${scaledConfig.padding}px`);
        root.style.setProperty('--hud-padding', `${scaledConfig.hudPadding}px`);
        root.style.setProperty('--hud-top-margin', `${scaledConfig.hudTopMargin}px`);
        root.style.setProperty('--hud-side-margin', `${scaledConfig.hudSideMargin}px`);
        root.style.setProperty('--hud-spacing', `${scaledConfig.hudSpacing}px`);
    }
    
    updateGameConfig(dimensions) {
        const scale = dimensions.scale;
        
        // Atualizar configurações do jogo
        GAME_CONFIG.CANVAS_WIDTH = dimensions.width;
        GAME_CONFIG.CANVAS_HEIGHT = dimensions.height;
        
        // Ajustar posição e tamanho da caixa proporcionalmente
        const scaledBoxHeight = Math.round(400 * scale);
        const scaledBoxWidth = Math.round(260 * scale);
        const scaledFrameThickness = Math.round(10 * scale);
        
        GAME_CONFIG.BOX_WIDTH = scaledBoxWidth;
        GAME_CONFIG.BOX_HEIGHT = scaledBoxHeight;
        GAME_CONFIG.BOX_X = Math.round((dimensions.width - scaledBoxWidth) / 2);
        
        // Posicionar a caixa 5 pixels acima do limite inferior do canvas
        // Considerando a espessura da borda
        GAME_CONFIG.BOX_Y = dimensions.height - scaledBoxHeight - 5;
        
        // Ajustar outros parâmetros
        GAME_CONFIG.INGREDIENT_SIZE = Math.round(25 * scale);
        GAME_CONFIG.FRAME_THICKNESS = scaledFrameThickness;
        GAME_CONFIG.SPAWN_HEIGHT = Math.round(70 * scale);
        GAME_CONFIG.SPAWN_MARGIN = Math.round(28 * scale);
        GAME_CONFIG.SAFE_MARGIN = Math.round(15 * scale);
        GAME_CONFIG.HUD_SPACING = Math.round(20 * scale);
    }
    
    updateCanvas(dimensions) {
        // Atualizar dimensões do canvas
        this.canvas.width = dimensions.width;
        this.canvas.height = dimensions.height;
        this.canvas.style.width = `${dimensions.width}px`;
        this.canvas.style.height = `${dimensions.height}px`;
        
        // Centralizar apenas horizontalmente
        const containerWidth = this.gameContainer.clientWidth;
        const left = (containerWidth - dimensions.width) / 2;
        
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${left}px`;
    }
    
    handleResize() {
        const dimensions = this.calculateDimensions();
        
        // Atualizar CSS, configurações e canvas
        this.updateCSSVariables(dimensions.scale);
        this.updateGameConfig(dimensions);
        this.updateCanvas(dimensions);
        
        // Disparar evento de redimensionamento
        window.dispatchEvent(new CustomEvent('gameResized', { 
            detail: { dimensions } 
        }));
    }
} 