/**
 * state.js - In-memory State Management
 * Manages signal history and consecutive signal tracking
 */

const signalHistory = new Map();
const consecutiveCount = new Map();
const lastSignalTime = new Map();
const MAX_HISTORY = 20;

/**
 * Adds a signal to the history for a given pair
 * Maintains maximum of 20 signals per pair
 * @param {string} pair - Trading pair identifier
 * @param {Object} signal - Signal object to add
 */
function addSignal(pair, signal) {
    if (!signalHistory.has(pair)) {
        signalHistory.set(pair, []);
    }
    const history = signalHistory.get(pair);
    history.unshift({
        ...signal,
        timestamp: signal.timestamp || new Date().toISOString()
    });
    if (history.length > MAX_HISTORY) {
        history.pop();
    }
    lastSignalTime.set(pair, Date.now());
    updateConsecutive(pair, signal.direction);
}

/**
 * Gets the signal history for a given pair
 * @param {string} pair - Trading pair identifier
 * @returns {Array} - Array of last 20 signals
 */
function getHistory(pair) {
    return signalHistory.get(pair) || [];
}

/**
 * Gets the consecutive signal count for a pair
 * @param {string} pair - Trading pair identifier
 * @returns {Object} - { direction: string, count: number }
 */
function getConsecutiveCount(pair) {
    return consecutiveCount.get(pair) || { direction: null, count: 0 };
}

/**
 * Updates the consecutive count for a pair
 * Resets count if direction changed
 * @param {string} pair - Trading pair identifier
 * @param {string} direction - New signal direction
 */
function updateConsecutive(pair, direction) {
    const current = consecutiveCount.get(pair) || { direction: null, count: 0 };
    if (current.direction === direction) {
        consecutiveCount.set(pair, {
            direction: direction,
            count: current.count + 1
        });
    } else {
        consecutiveCount.set(pair, {
            direction: direction,
            count: 1
        });
    }
}

/**
 * Resets all state data for a specific pair
 * Called when user changes the selected pair
 * @param {string} pair - Trading pair identifier
 */
function resetPair(pair) {
    signalHistory.delete(pair);
    consecutiveCount.delete(pair);
    lastSignalTime.delete(pair);
}

/**
 * Gets statistics for a pair
 * @param {string} pair - Trading pair identifier
 * @returns {Object} - { total, buyCount, sellCount }
 */
function getStats(pair) {
    const history = getHistory(pair);
    const total = history.length;
    const buyCount = history.filter(s => s.direction === 'BUY').length;
    const sellCount = history.filter(s => s.direction === 'SELL').length;
    return { total, buyCount, sellCount };
}

/**
 * Gets last signal timestamp for a pair
 * @param {string} pair - Trading pair identifier
 * @returns {number|null} - Timestamp or null
 */
function getLastSignalTime(pair) {
    return lastSignalTime.get(pair) || null;
}

/**
 * Gets all history combined from all pairs
 * @returns {Array} - Combined sorted history
 */
function getAllHistory() {
    const allHistory = [];
    for (const [pair, history] of signalHistory) {
        for (const signal of history) {
            allHistory.push({ ...signal, pair });
        }
    }
    return allHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, MAX_HISTORY);
}

/**
 * Clears all state data
 */
function clearAll() {
    signalHistory.clear();
    consecutiveCount.clear();
    lastSignalTime.clear();
}

/**
 * Gets all stored data for debugging
 * @returns {Object} - All state data
 */
function getAllState() {
    const historyObj = {};
    signalHistory.forEach((value, key) => {
        historyObj[key] = value;
    });
    const consecutiveObj = {};
    consecutiveCount.forEach((value, key) => {
        consecutiveObj[key] = value;
    });
    return {
        signalHistory: historyObj,
        consecutiveCount: consecutiveObj
    };
}

module.exports = {
    addSignal,
    getHistory,
    getConsecutiveCount,
    updateConsecutive,
    resetPair,
    getStats,
    getLastSignalTime,
    getAllHistory,
    clearAll,
    getAllState
};
