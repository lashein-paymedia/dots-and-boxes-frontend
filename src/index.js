import * as THREE from 'three';
import { io } from 'socket.io-client';
import Web3Manager from './web3.js';
import SoundManager from './sounds.js';

class DotsAndBoxesGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Game state
        this.gridSize = 5; // 5x5 dots = 4x4 boxes
        this.dots = [];
        this.lines = [];
        this.boxes = [];
        this.currentPlayer = 1;
        this.scores = { player1: 0, player2: 0 };
        this.gameState = 'waiting'; // waiting, playing, finished
        this.playerNumber = null;
        this.roomId = null;
        
        // Web3
        this.web3Manager = new Web3Manager();
        
        // Sound
        this.soundManager = new SoundManager();
        
        // Socket.IO
        this.socket = null;
        
        // Interaction state
        this.selectedDot = null;
        this.hoveredDot = null;
        
        // Colors
        this.colors = {
            dot: 0xffffff,
            dotHover: 0xffff00,
            dotSelected: 0x00ff00,
            line: 0xcccccc,
            player1Line: 0x4fc3f7,
            player2Line: 0xf06292,
            player1Box: 0x4fc3f7,
            player2Box: 0xf06292,
            hover: 0xffff00
        };
        
        this.init();
    }
    
    init() {
        this.setupThreeJS();
        this.createGrid();
        this.setupEventListeners();
        this.setupSocket();
        this.setupWeb3();
        this.animate();
    }
    
    setupWeb3() {
        // Set up Web3 event listeners
        this.web3Manager.on('onConnect', (account) => {
            this.onWalletConnected(account);
        });
        
        this.web3Manager.on('onDisconnect', () => {
            this.onWalletDisconnected();
        });
        
        this.web3Manager.on('onAccountChange', (account) => {
            this.onWalletAccountChanged(account);
        });
        
        // Update UI if already connected
        if (this.web3Manager.isWalletConnected()) {
            this.onWalletConnected(this.web3Manager.getAccount());
        }
    }
    
    onWalletConnected(account) {
        console.log('Wallet connected:', account);
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('walletAddress').style.display = 'block';
        document.getElementById('walletAddress').textContent = this.web3Manager.getShortAddress(account);
        
        // Update player addresses in UI
        this.updatePlayerAddresses();
    }
    
    onWalletDisconnected() {
        console.log('Wallet disconnected');
        document.getElementById('connectWallet').style.display = 'block';
        document.getElementById('walletAddress').style.display = 'none';
        
        // Clear player addresses
        document.getElementById('player1Address').textContent = '';
        document.getElementById('player2Address').textContent = '';
    }
    
    onWalletAccountChanged(account) {
        console.log('Wallet account changed:', account);
        document.getElementById('walletAddress').textContent = this.web3Manager.getShortAddress(account);
        this.updatePlayerAddresses();
    }
    
    updatePlayerAddresses() {
        if (this.playerNumber && this.web3Manager.isWalletConnected()) {
            const address = this.web3Manager.getShortAddress();
            document.getElementById(`player${this.playerNumber}Address`).textContent = address;
        }
    }
    
    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 8);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Add subtle fog for depth
        this.scene.fog = new THREE.Fog(0x1a1a2e, 10, 20);
    }
    
    createGrid() {
        const spacing = 1.5;
        const offset = (this.gridSize - 1) * spacing / 2;
        
        // Create dots
        const dotGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const dotMaterial = new THREE.MeshPhongMaterial({ 
            color: this.colors.dot,
            emissive: 0x222222
        });
        
        for (let i = 0; i < this.gridSize; i++) {
            this.dots[i] = [];
            for (let j = 0; j < this.gridSize; j++) {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.position.set(
                    i * spacing - offset,
                    j * spacing - offset,
                    0
                );
                dot.userData = { type: 'dot', row: i, col: j };
                dot.castShadow = true;
                this.scene.add(dot);
                this.dots[i][j] = dot;
            }
        }
        
        // Initialize lines and boxes arrays
        this.initializeGameArrays();
    }
    
    initializeGameArrays() {
        // Initialize lines array (horizontal and vertical)
        this.lines = {
            horizontal: [],
            vertical: []
        };
        
        // Horizontal lines
        for (let i = 0; i < this.gridSize; i++) {
            this.lines.horizontal[i] = [];
            for (let j = 0; j < this.gridSize - 1; j++) {
                this.lines.horizontal[i][j] = null;
            }
        }
        
        // Vertical lines
        for (let i = 0; i < this.gridSize - 1; i++) {
            this.lines.vertical[i] = [];
            for (let j = 0; j < this.gridSize; j++) {
                this.lines.vertical[i][j] = null;
            }
        }
        
        // Initialize boxes array
        this.boxes = [];
        for (let i = 0; i < this.gridSize - 1; i++) {
            this.boxes[i] = [];
            for (let j = 0; j < this.gridSize - 1; j++) {
                this.boxes[i][j] = null;
            }
        }
    }
    
    setupEventListeners() {
        // Mouse events
        this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        
        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // UI events
        document.getElementById('connectWallet').addEventListener('click', this.connectWallet.bind(this));
        document.getElementById('newGameBtn').addEventListener('click', this.newGame.bind(this));
        document.getElementById('joinRoomBtn').addEventListener('click', this.joinRoom.bind(this));
        document.getElementById('playAgainBtn').addEventListener('click', this.playAgain.bind(this));
    }
    
    setupSocket() {
        this.socket = io('http://192.168.1.102:3001');
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.playerNumber = data.playerNumber;
            this.updateGameState(data.gameState);
            this.updatePlayerAddresses();
            console.log(`Joined room ${this.roomId} as player ${this.playerNumber}`);
        });
        
        this.socket.on('gameState', (gameState) => {
            this.updateGameState(gameState);
        });
        
        this.socket.on('lineDrawn', (lineData) => {
            this.drawLine(lineData.start, lineData.end, lineData.player, false);
        });
        
        this.socket.on('boxCompleted', (boxData) => {
            this.completeBox(boxData.row, boxData.col, boxData.player, false);
        });
        
        this.socket.on('gameEnded', (result) => {
            this.endGame(result);
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert(error.message);
        });
    }
    
    onMouseClick(event) {
        if (this.gameState !== 'playing') return;
        
        this.updateMousePosition(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            if (object.userData.type === 'dot') {
                this.handleDotClick(object);
            }
        }
    }
    
    onMouseMove(event) {
        this.updateMousePosition(event);
        // Add hover effects here if needed
    }
    
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    handleDotClick(dot) {
        // Resume audio context on first user interaction
        this.soundManager.resumeContext();
        
        // Only allow moves if it's the player's turn
        if (this.gameState !== 'playing' || this.currentPlayer !== this.playerNumber) {
            return;
        }
        
        this.soundManager.play('click');
        
        if (!this.selectedDot) {
            // First dot selection
            this.selectedDot = dot;
            this.highlightDot(dot, this.colors.dotSelected);
        } else {
            // Second dot selection - try to draw a line
            if (this.selectedDot === dot) {
                // Clicking the same dot - deselect
                this.unhighlightDot(this.selectedDot);
                this.selectedDot = null;
            } else if (this.areDotsAdjacent(this.selectedDot, dot)) {
                // Valid line - attempt to draw
                const start = this.selectedDot.userData;
                const end = dot.userData;
                
                if (this.socket) {
                    this.socket.emit('drawLine', { start, end, player: this.playerNumber });
                }
                
                // Reset selection
                this.unhighlightDot(this.selectedDot);
                this.selectedDot = null;
            } else {
                // Invalid line - select new dot
                this.unhighlightDot(this.selectedDot);
                this.selectedDot = dot;
                this.highlightDot(dot, this.colors.dotSelected);
            }
        }
    }
    
    areDotsAdjacent(dot1, dot2) {
        const rowDiff = Math.abs(dot1.userData.row - dot2.userData.row);
        const colDiff = Math.abs(dot1.userData.col - dot2.userData.col);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    
    highlightDot(dot, color) {
        dot.material.color.setHex(color);
        dot.material.emissive.setHex(color * 0.3);
    }
    
    unhighlightDot(dot) {
        dot.material.color.setHex(this.colors.dot);
        dot.material.emissive.setHex(0x222222);
    }
    
    drawLine(start, end, player, emit = true) {
        const startDot = this.dots[start.row][start.col];
        const endDot = this.dots[end.row][end.col];
        
        const geometry = new THREE.BufferGeometry().setFromPoints([
            startDot.position,
            endDot.position
        ]);
        
        const material = new THREE.LineBasicMaterial({
            color: player === 1 ? this.colors.player1Line : this.colors.player2Line,
            linewidth: 3
        });
        
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        
        // Play sound effect
        this.soundManager.play('lineDraw');
        
        // Store line in appropriate array
        if (start.row === end.row) {
            // Horizontal line
            const col = Math.min(start.col, end.col);
            this.lines.horizontal[start.row][col] = { line, player };
        } else {
            // Vertical line
            const row = Math.min(start.row, end.row);
            this.lines.vertical[row][start.col] = { line, player };
        }
        
        if (emit && this.socket) {
            this.socket.emit('drawLine', { start, end, player });
        }
        
        // Check for completed boxes
        this.checkForCompletedBoxes(start, end, player);
    }
    
    checkForCompletedBoxes(start, end, player) {
        // Get potential boxes that could be completed by this line
        const potentialBoxes = this.getPotentialBoxes(start, end);
        
        potentialBoxes.forEach(box => {
            if (this.isBoxCompleted(box.row, box.col) && !this.boxes[box.row][box.col]) {
                this.completeBox(box.row, box.col, player, true);
            }
        });
    }
    
    getPotentialBoxes(start, end) {
        const boxes = [];
        
        if (start.row === end.row) {
            // Horizontal line - check boxes above and below
            const row = start.row;
            const col = Math.min(start.col, end.col);
            
            // Box above
            if (row > 0) {
                boxes.push({ row: row - 1, col: col });
            }
            
            // Box below
            if (row < this.gridSize - 1) {
                boxes.push({ row: row, col: col });
            }
        } else {
            // Vertical line - check boxes left and right
            const row = Math.min(start.row, end.row);
            const col = start.col;
            
            // Box to the left
            if (col > 0) {
                boxes.push({ row: row, col: col - 1 });
            }
            
            // Box to the right
            if (col < this.gridSize - 1) {
                boxes.push({ row: row, col: col });
            }
        }
        
        return boxes;
    }
    
    isBoxCompleted(row, col) {
        // Check all four sides of the box
        const top = this.lines.horizontal[row] && this.lines.horizontal[row][col];
        const bottom = this.lines.horizontal[row + 1] && this.lines.horizontal[row + 1][col];
        const left = this.lines.vertical[row] && this.lines.vertical[row][col];
        const right = this.lines.vertical[row] && this.lines.vertical[row][col + 1];
        
        return top && bottom && left && right;
    }
    
    completeBox(row, col, player, emit = true) {
        if (this.boxes[row][col]) return; // Already completed
        
        const spacing = 1.5;
        const offset = (this.gridSize - 1) * spacing / 2;
        
        const boxGeometry = new THREE.PlaneGeometry(spacing * 0.8, spacing * 0.8);
        const boxMaterial = new THREE.MeshPhongMaterial({
            color: player === 1 ? this.colors.player1Box : this.colors.player2Box,
            transparent: true,
            opacity: 0.6
        });
        
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(
            (row + 0.5) * spacing - offset,
            (col + 0.5) * spacing - offset,
            -0.1
        );
        
        this.scene.add(box);
        this.boxes[row][col] = { box, player };
        
        // Play sound effect
        this.soundManager.play('boxComplete');
        
        // Update score
        this.scores[`player${player}`]++;
        this.updateUI();
        
        if (emit && this.socket) {
            this.socket.emit('boxCompleted', { row, col, player });
        }
    }
    
    updateGameState(gameState) {
        this.currentPlayer = gameState.currentPlayer;
        this.scores = gameState.scores;
        this.gameState = gameState.state;
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('player1Score').textContent = this.scores.player1;
        document.getElementById('player2Score').textContent = this.scores.player2;
        document.getElementById('currentTurn').textContent = `Current Turn: Player ${this.currentPlayer}`;
        
        // Update active player highlight
        document.getElementById('player1Info').classList.toggle('active', this.currentPlayer === 1);
        document.getElementById('player2Info').classList.toggle('active', this.currentPlayer === 2);
    }
    
    async connectWallet() {
        try {
            await this.web3Manager.connectWallet();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            alert(error.message);
        }
    }
    
    newGame() {
        if (this.socket) {
            this.socket.emit('newGame');
        }
    }
    
    joinRoom() {
        const roomId = prompt('Enter room ID:');
        if (roomId && this.socket) {
            this.socket.emit('joinRoom', roomId);
        }
    }
    
    playAgain() {
        document.getElementById('gameStatus').style.display = 'none';
        this.newGame();
    }
    
    endGame(result) {
        this.gameState = 'finished';
        
        // Play victory sound
        this.soundManager.play('gameWin');
        
        document.getElementById('winnerText').textContent = result.winner;
        document.getElementById('finalScore').textContent = 
            `Player 1: ${result.scores.player1} | Player 2: ${result.scores.player2}`;
        document.getElementById('gameStatus').style.display = 'block';
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Add subtle rotation to the scene for visual appeal
        if (this.scene) {
            this.scene.rotation.z += 0.001;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new DotsAndBoxesGame();
});

