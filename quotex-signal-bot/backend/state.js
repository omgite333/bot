/**
 * state.js - In-memory State Management
 * Manages signal history and consecutive signal tracking
 */

// In-memory storage (no database needed)
const signalHistory = new Map();      // pair -> array of last 10 signals
const consecutiveCount = new Map();   // pair -> { direction, count }

/**
 * Adds a signal to the history for a given pair
 * Maintains maximum of 10 signals per pair
 * @param {string} pair - Trading pair identifier
 * @param {Object} signal - Signal object to add
 */
function addSignal(pair, signal) {
    // Initialize array if not exists
    if (!signalHistory.has(pair)) {
        signalHistory.set(pair, []);
    }

    // Get existing history
    const history = signalHistory.get(pair);

    // Add new signal at the beginning
    history.unshift(signal);

    // Keep only last 10 signals
    if (history.length > 10) {
        history.pop();
    }

    // Update consecutive count
    updateConsecutive(pair, signal.direction);

    console.log(`[STATE] Signal added for ${pair}: ${signal.direction} (history: ${history.length})`);
}

/**
 * Gets the signal history for a given pair
 * @param {string} pair - Trading pair identifier
 * @returns {Array} - Array of last 10 signals
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
        // Same direction - increment count
        consecutiveCount.set(pair, {
            direction: direction,
            count: current.count + 1
        });
    } else {
        // Direction changed - reset count
        consecutiveCount.set(pair, {
            direction: direction,
            count: 1
        });
    }

    const updated = consecutiveCount.get(pair);
    console.log(`[STATE] Consecutive for ${pair}: ${updated.direction} x${updated.count}`);
}

/**
 * Resets all state data for a specific pair
 * Called when user changes the selected pair
 * @param {string} pair - Trading pair identifier
 */
function resetPair(pair) {
    signalHistory.delete(pair);
    consecutiveCount.delete(pair);
    console.log(`[STATE] Reset state for ${pair}`);
}

/**
 * Clears all state data
 * Used for testing or full reset
 */
function clearAll() {
    signalHistory.clear();
    consecutiveCount.clear();
    console.log('[STATE] All state cleared');
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
    clearAll,
    getAllState
};
