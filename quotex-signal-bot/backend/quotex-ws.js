/**
 * quotex-ws.js - Quotex WebSocket real-time data connection
 * Includes demo data fallback when live connection fails
 */

const { io } = require('socket.io-client');

const QUOTEX_WS_URL = 'https://quotex.com';
const RECONNECT_INTERVAL = 5000;

let socket = null;
let tickCallbacks = [];
let statusCallbacks = [];
let connectionStatus = 'DISCONNECTED';
let currentSubscription = null;
let demoMode = false;
let demoInterval = null;

const PAIR_BASE_PRICES = {
    'EURUSD': 1.0850,
    'GBPUSD': 1.2650,
    'USDJPY': 149.50,
    'AUDUSD': 0.6550,
    'EURGBP': 0.8580,
    'USDCAD': 1.3650,
    'EURJPY': 162.20,
    'BTCUSD': 67500,
    'ETHUSD': 3450,
    'EURUSD_OTC': 1.0840
};

let demoPrices = {};
let demoTrends = {};

function getConnectionStatus() {
    return connectionStatus;
}

function notifyStatus(status) {
    connectionStatus = status;
    statusCallbacks.forEach(cb => {
        try {
            cb(status);
        } catch (e) {
            console.error('[WS] Status callback error:', e.message);
        }
    });
}

function handleTick(data) {
    if (data && data.asset) {
        const tick = {
            asset: data.asset,
            time: Math.floor(Date.now() / 1000),
            price: parseFloat(data.price || data.c)
        };
        tickCallbacks.forEach(cb => {
            try {
                cb(tick);
            } catch (e) {
                console.error('[WS] Tick callback error:', e.message);
            }
        });
    }
}

function startDemoMode() {
    if (demoMode) return;
    demoMode = true;
    console.log('[WS] Starting DEMO mode with simulated data');
    notifyStatus('DEMO');
    
    Object.keys(PAIR_BASE_PRICES).forEach(pair => {
        demoPrices[pair] = PAIR_BASE_PRICES[pair];
        demoTrends[pair] = Math.random() > 0.5 ? 1 : -1;
    });
    
    demoInterval = setInterval(() => {
        Object.keys(demoPrices).forEach(pair => {
            const basePrice = PAIR_BASE_PRICES[pair];
            const currentPrice = demoPrices[pair];
            
            if (Math.random() < 0.02) {
                demoTrends[pair] *= -1;
            }
            
            const volatility = basePrice > 1000 ? basePrice * 0.0003 : basePrice * 0.0005;
            const change = demoTrends[pair] * (Math.random() * volatility * 0.5) + 
                         (Math.random() - 0.5) * volatility;
            
            demoPrices[pair] = currentPrice + change;
            
            const decimals = basePrice > 100 ? 2 : 5;
            const tick = {
                asset: pair,
                time: Math.floor(Date.now() / 1000),
                price: parseFloat(demoPrices[pair].toFixed(decimals))
            };
            
            tickCallbacks.forEach(cb => {
                try {
                    cb(tick);
                } catch (e) {
                    console.error('[WS] Demo tick error:', e.message);
                }
            });
        });
    }, 500);
}

function stopDemoMode() {
    if (demoInterval) {
        clearInterval(demoInterval);
        demoInterval = null;
    }
    demoMode = false;
}

function connect() {
    if (socket && socket.connected) {
        return;
    }
    
    stopDemoMode();
    Object.keys(PAIR_BASE_PRICES).forEach(pair => {
        demoPrices[pair] = PAIR_BASE_PRICES[pair];
        demoTrends[pair] = Math.random() > 0.5 ? 1 : -1;
    });
    notifyStatus('RECONNECTING');
    console.log('[WS] Connecting to Quotex...');
    
    try {
        socket = io(QUOTEX_WS_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: RECONNECT_INTERVAL,
            reconnectionAttempts: 5,
            timeout: 15000,
            forceNew: true,
            extraHeaders: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Origin': QUOTEX_WS_URL,
                'Referer': QUOTEX_WS_URL + '/'
            }
        });

        socket.on('connect', () => {
            console.log('[WS] Connected to Quotex');
            notifyStatus('CONNECTED');
            if (currentSubscription) {
                subscribe(currentSubscription);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
            if (reason === 'io server disconnect') {
                console.log('[WS] Server disconnected, attempting reconnect...');
                socket.connect();
            } else {
                notifyStatus('RECONNECTING');
            }
        });

        socket.on('connect_error', (error) => {
            console.log('[WS] Connection error:', error.message);
            console.log('[WS] Switching to DEMO mode...');
            notifyStatus('DEMO');
        });

        socket.on('error', (error) => {
            console.error('[WS] Socket error:', error.message);
        });

        socket.on('tick', handleTick);
        socket.on('instruments/update', handleTick);
        socket.on('quote', handleTick);
        socket.on('candle', handleTick);

        socket.io.on('reconnect_attempts', (attempts) => {
            if (attempts >= 5) {
                console.log('[WS] Max reconnect attempts reached, using demo mode');
                socket.disconnect();
            }
        });

    } catch (e) {
        console.error('[WS] Connection error:', e.message);
        console.log('[WS] Starting demo mode...');
        startDemoMode();
    }
}

function disconnect() {
    stopDemoMode();
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    notifyStatus('DISCONNECTED');
}

function sendMessage(event, data) {
    if (socket && socket.connected) {
        socket.emit(event, data);
    }
}

function subscribe(symbol) {
    if (currentSubscription) {
        unsubscribe(currentSubscription);
    }
    currentSubscription = symbol;
    
    if (demoMode) {
        console.log(`[WS] Demo subscribing to ${symbol}`);
        return;
    }
    
    console.log(`[WS] Subscribing to ${symbol}`);
    sendMessage('instruments/update', { asset: symbol, period: 60 });
    sendMessage('subscribe', { asset: symbol, period: 60 });
}

function unsubscribe(symbol) {
    if (demoMode) return;
    console.log(`[WS] Unsubscribing from ${symbol}`);
    sendMessage('instruments/unsubscribe', { asset: symbol, period: 60 });
    if (currentSubscription === symbol) {
        currentSubscription = null;
    }
}

function onTick(callback) {
    if (typeof callback === 'function') {
        tickCallbacks.push(callback);
    }
}

function onStatusChange(callback) {
    if (typeof callback === 'function') {
        statusCallbacks.push(callback);
    }
}

function removeTickCallback(callback) {
    const index = tickCallbacks.indexOf(callback);
    if (index > -1) {
        tickCallbacks.splice(index, 1);
    }
}

function enableDemoMode(enable) {
    if (enable) {
        stopDemoMode();
        if (socket) {
            socket.disconnect();
        }
        startDemoMode();
    } else {
        stopDemoMode();
        connect();
    }
}

module.exports = {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    onTick,
    onStatusChange,
    removeTickCallback,
    getConnectionStatus,
    enableDemoMode
};
