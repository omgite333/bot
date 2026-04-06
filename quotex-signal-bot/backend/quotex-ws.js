/**
 * quotex-ws.js - Quotex WebSocket real-time data connection
 * Connects to Quotex live feed for price ticks
 */

const WebSocket = require('ws');

const QUOTEX_WS_URL = 'wss://ws2.quotex.io/socket.io/?EIO=3&transport=websocket';
const RECONNECT_INTERVAL = 5000;
const PING_INTERVAL = 30000;

let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let tickCallbacks = [];
let statusCallbacks = [];
let connectionStatus = 'DISCONNECTED';
let currentSubscription = null;
let isIntentionalClose = false;

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

function handleMessage(data) {
    try {
        if (data === '2') {
            ws.send('3');
            return;
        }
        if (data.startsWith('42')) {
            const jsonStr = data.substring(2);
            const parsed = JSON.parse(jsonStr);
            const event = parsed[0];
            const payload = parsed[1];
            if (event === 'tick') {
                const tick = {
                    asset: payload.asset,
                    time: payload.time,
                    price: parseFloat(payload.price)
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
    } catch (e) {
        console.error('[WS] Parse error:', e.message);
    }
}

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    isIntentionalClose = false;
    notifyStatus('RECONNECTING');
    console.log('[WS] Connecting to Quotex...');
    try {
        ws = new WebSocket(QUOTEX_WS_URL);
        ws.on('open', () => {
            console.log('[WS] Connected to Quotex');
            notifyStatus('CONNECTED');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            startPing();
            if (currentSubscription) {
                subscribe(currentSubscription);
            }
        });
        ws.on('message', (data) => {
            handleMessage(data.toString());
        });
        ws.on('error', (error) => {
            console.error('[WS] Error:', error.message);
        });
        ws.on('close', () => {
            console.log('[WS] Disconnected');
            stopPing();
            if (!isIntentionalClose) {
                notifyStatus('RECONNECTING');
                scheduleReconnect();
            } else {
                notifyStatus('DISCONNECTED');
            }
        });
    } catch (e) {
        console.error('[WS] Connection error:', e.message);
        scheduleReconnect();
    }
}

function disconnect() {
    isIntentionalClose = true;
    stopPing();
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    notifyStatus('DISCONNECTED');
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    console.log(`[WS] Reconnecting in ${RECONNECT_INTERVAL / 1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
    }, RECONNECT_INTERVAL);
}

function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('2');
        }
    }, PING_INTERVAL);
}

function stopPing() {
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
    }
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('42' + JSON.stringify(message));
    }
}

function subscribe(symbol) {
    if (currentSubscription) {
        unsubscribe(currentSubscription);
    }
    currentSubscription = symbol;
    console.log(`[WS] Subscribing to ${symbol}`);
    sendMessage(['instruments/update', { asset: symbol, period: 60 }]);
}

function unsubscribe(symbol) {
    console.log(`[WS] Unsubscribing from ${symbol}`);
    sendMessage(['instruments/unsubscribe', { asset: symbol, period: 60 }]);
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

module.exports = {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    onTick,
    onStatusChange,
    removeTickCallback,
    getConnectionStatus
};
