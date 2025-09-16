// Sound effects for the Dots and Boxes game

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.3;
        
        this.init();
    }
    
    async init() {
        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create sound effects
            this.createSounds();
        } catch (error) {
            console.warn('Audio not supported:', error);
            this.enabled = false;
        }
    }
    
    createSounds() {
        // Line draw sound - short beep
        this.sounds.lineDraw = this.createTone(800, 0.1, 'sine');
        
        // Box complete sound - success chime
        this.sounds.boxComplete = this.createChime([523, 659, 784], 0.3);
        
        // Game win sound - victory fanfare
        this.sounds.gameWin = this.createChime([523, 659, 784, 1047], 0.5);
        
        // Click sound - subtle click
        this.sounds.click = this.createTone(1000, 0.05, 'square');
        
        // Hover sound - soft beep
        this.sounds.hover = this.createTone(600, 0.03, 'sine');
    }
    
    createTone(frequency, duration, type = 'sine') {
        return () => {
            if (!this.enabled || !this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }
    
    createChime(frequencies, duration) {
        return () => {
            if (!this.enabled || !this.audioContext) return;
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(this.volume * 0.7, this.audioContext.currentTime + 0.01);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / frequencies.length);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration / frequencies.length);
                }, index * (duration / frequencies.length) * 1000 * 0.3);
            });
        };
    }
    
    play(soundName) {
        if (this.sounds[soundName] && this.enabled) {
            try {
                this.sounds[soundName]();
            } catch (error) {
                console.warn('Error playing sound:', error);
            }
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    
    // Resume audio context (required for some browsers)
    async resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (error) {
                console.warn('Could not resume audio context:', error);
            }
        }
    }
}

export default SoundManager;

