// Web3 integration for wallet connection and player identification

class Web3Manager {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.isConnected = false;
        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onAccountChange: []
        };
        
        this.init();
    }
    
    async init() {
        // Check if MetaMask is installed
        if (typeof window.ethereum !== 'undefined') {
            console.log('MetaMask detected');
            
            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                this.handleAccountsChanged(accounts);
            });
            
            // Listen for chain changes
            window.ethereum.on('chainChanged', (chainId) => {
                console.log('Chain changed to:', chainId);
                // Reload the page to reset the dapp state
                window.location.reload();
            });
            
            // Check if already connected
            try {
                const accounts = await window.ethereum.request({
                    method: 'eth_accounts'
                });
                
                if (accounts.length > 0) {
                    this.account = accounts[0];
                    this.isConnected = true;
                    this.triggerCallbacks('onConnect', this.account);
                }
            } catch (error) {
                console.error('Error checking existing connection:', error);
            }
        } else {
            console.log('MetaMask not detected');
        }
    }
    
    async connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
        }
        
        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            if (accounts.length > 0) {
                this.account = accounts[0];
                this.isConnected = true;
                this.triggerCallbacks('onConnect', this.account);
                return this.account;
            } else {
                throw new Error('No accounts found');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw error;
        }
    }
    
    async disconnectWallet() {
        this.account = null;
        this.isConnected = false;
        this.triggerCallbacks('onDisconnect');
    }
    
    handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            // User disconnected their wallet
            this.disconnectWallet();
        } else if (accounts[0] !== this.account) {
            // User switched accounts
            this.account = accounts[0];
            this.triggerCallbacks('onAccountChange', this.account);
        }
    }
    
    getAccount() {
        return this.account;
    }
    
    getShortAddress(address = null) {
        const addr = address || this.account;
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    
    isWalletConnected() {
        return this.isConnected && this.account !== null;
    }
    
    // Event system
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }
    
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }
    
    triggerCallbacks(event, data = null) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }
    
    // Utility methods for game integration
    async signMessage(message) {
        if (!this.isConnected) {
            throw new Error('Wallet not connected');
        }
        
        try {
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, this.account]
            });
            return signature;
        } catch (error) {
            console.error('Error signing message:', error);
            throw error;
        }
    }
    
    async getNetworkInfo() {
        if (!this.isConnected) {
            return null;
        }
        
        try {
            const chainId = await window.ethereum.request({
                method: 'eth_chainId'
            });
            
            const networkNames = {
                '0x1': 'Ethereum Mainnet',
                '0x3': 'Ropsten Testnet',
                '0x4': 'Rinkeby Testnet',
                '0x5': 'Goerli Testnet',
                '0x2a': 'Kovan Testnet',
                '0x89': 'Polygon Mainnet',
                '0x13881': 'Polygon Mumbai Testnet',
                '0xa86a': 'Avalanche Mainnet',
                '0xa869': 'Avalanche Fuji Testnet'
            };
            
            return {
                chainId: chainId,
                name: networkNames[chainId] || 'Unknown Network'
            };
        } catch (error) {
            console.error('Error getting network info:', error);
            return null;
        }
    }
}

// Export for use in other modules
export default Web3Manager;

