/**
 * app.js - Frontend Application Logic
 * Quotex Signal Bot - Strategy-Based Signal Engine
 */

// API Configuration
const API_BASE = 'http://localhost:3000';
const UPDATE_INTERVAL = 60000; // 60 seconds
const MAX_HISTORY_ROWS = 10;

// Application State
let isRunning = false;
let selectedPair = '';
let timerInterval = null;
let countdownValue = 60;
let signalHistory = [];

// DOM Elements
const pairSelect = document.getElementById('pairSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusBadge = document.getElementById('statusBadge');
const statusDot = statusBadge.querySelector('.status-dot');
const statusText = document.getElementById('statusText');

const signalCard = document.getElementById('signalCard');
const directionIcon = document.getElementById('directionIcon');
const directionText = document.getElementById('directionText');
const signalStrength = document.getElementById('signalStrength');
const confidenceValue = document.getElementById('confidenceValue');
const confidenceFill = document.getElementById('confidenceFill');
const signalPair = document.getElementById('signalPair');
const signalTime = document.getElementById('signalTime');
const countdownEl = document.getElementById('countdownValue');

const historyBody = document.getElementById('historyBody');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const utcClock = document.getElementById('utcClock');

// Indicator Elements
const rsiValue = document.getElementById('rsiValue');
const rsiStatus = document.getElementById('rsiStatus');
const rsiStatusText = document.getElementById('rsiStatusText');
const rsiPoints = document.getElementById('rsiPoints');
const rsiRow = document.getElementById('rsiRow');

const emaValue = document.getElementById('emaValue');
const emaStatus = document.getElementById('emaStatus');
const emaStatusText = document.getElementById('emaStatusText');
const emaPoints = document.getElementById('emaPoints');
const emaRow = document.getElementById('emaRow');

const macdValue = document.getElementById('macdValue');
const macdStatus = document.getElementById('macdStatus');
const macdStatusText = document.getElementById('macdStatusText');
const macdPoints = document.getElementById('macdPoints');
const macdRow = document.getElementById('macdRow');

const stochValue = document.getElementById('stochValue');
const stochStatus = document.getElementById('stochStatus');
const stochStatusText = document.getElementById('stochStatusText');
const stochPoints = document.getElementById('stochPoints');
const stochRow = document.getElementById('stochRow');

const bbValue = document.getElementById('bbValue');
const bbStatus = document.getElementById('bbStatus');
const bbStatusText = document.getElementById('bbStatusText');
const bbPoints = document.getElementById('bbPoints');
const bbRow = document.getElementById('bbRow');

const patternValue = document.getElementById('patternValue');
const patternStatus = document.getElementById('patternStatus');
const patternStatusText = document.getElementById('patternStatusText');
const patternPoints = document.getElementById('patternPoints');
const patternRow = document.getElementById('patternRow');

const totalScore = document.getElementById('totalScore');

// Context Elements
const trend5mValue = document.getElementById('trend5mValue');
const sessionValue = document.getElementById('sessionValue');
const rangingValue = document.getElementById('rangingValue');
const reversalValue = document.getElementById('reversalValue');

/**
 * Initialize the application
 * Called on page load
 */
async function init() {
    console.log('[APP] Initializing Quotex Signal Bot...');
    
    // Fetch pairs and populate dropdown
    await fetchPairs();
    
    // Set default pair
    pairSelect.value = 'EURUSD';
    selectedPair = 'EURUSD';
    
    // Start UTC clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Attach event listeners
    attachEventListeners();
    
    // Initialize UI state
    resetIndicators();
    resetContext();
    
    console.log('[APP] Initialization complete');
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
    startBtn.addEventListener('click', startBot);
    stopBtn.addEventListener('click', stopBot);
    
    pairSelect.addEventListener('change', handlePairChange);
}

/**
 * Fetch supported pairs from API
 */
async function fetchPairs() {
    try {
        const response = await fetch(`${API_BASE}/pairs`);
        const data = await response.json();
        
        if (data.success && data.pairs) {
            data.pairs.forEach(pair => {
                const option = document.createElement('option');
                option.value = pair.id;
                option.textContent = pair.name;
                option.dataset.type = pair.type;
                pairSelect.appendChild(option);
            });
            console.log(`[APP] Loaded ${data.pairs.length} pairs`);
        }
    } catch (error) {
        console.error('[APP] Error fetching pairs:', error);
        showError('Failed to load pairs. Ensure server is running on port 3000.');
    }
}

/**
 * Handle pair selection change
 */
function handlePairChange() {
    const newPair = pairSelect.value;
    
    if (newPair === selectedPair) return;
    
    console.log(`[APP] Pair changed: ${selectedPair} → ${newPair}`);
    
    // If bot is running, restart with new pair
    if (isRunning) {
        stopBot();
        selectedPair = newPair;
        startBot();
    } else {
        selectedPair = newPair;
        resetSignalDisplay();
        resetIndicators();
        resetContext();
        signalHistory = [];
        updateHistoryTable();
    }
}

/**
 * Start the signal bot
 */
function startBot() {
    if (!selectedPair) {
        showError('Please select a trading pair first.');
        return;
    }
    
    isRunning = true;
    updateUIState('running');
    
    console.log(`[APP] Bot started for ${selectedPair}`);
    
    // Fetch signal immediately
    fetchAndDisplaySignal();
    
    // Start countdown
    startCountdown();
}

/**
 * Stop the signal bot
 */
function stopBot() {
    isRunning = false;
    stopCountdown();
    updateUIState('stopped');
    
    console.log('[APP] Bot stopped');
}

/**
 * Update UI button and status states
 * @param {string} state - 'running', 'stopped', or 'fetching'
 */
function updateUIState(state) {
    switch (state) {
        case 'running':
            startBtn.disabled = true;
            stopBtn.disabled = false;
            statusDot.className = 'status-dot active';
            statusText.textContent = 'RUNNING';
            break;
        case 'stopped':
            startBtn.disabled = false;
            stopBtn.disabled = true;
            statusDot.className = 'status-dot';
            statusText.textContent = 'STOPPED';
            break;
        case 'fetching':
            statusDot.className = 'status-dot fetching';
            statusText.textContent = 'FETCHING...';
            break;
    }
}

/**
 * Fetch and display signal
 */
async function fetchAndDisplaySignal() {
    if (!isRunning) return;
    
    updateUIState('fetching');
    
    try {
        const response = await fetch(`${API_BASE}/signal?pair=${selectedPair}`);
        const data = await response.json();
        
        if (data.success) {
            displaySignal(data);
            addToHistory(data);
        } else {
            showError(data.error || 'Failed to fetch signal');
            // Retry in 10 seconds
            setTimeout(() => {
                if (isRunning) fetchAndDisplaySignal();
            }, 10000);
        }
    } catch (error) {
        console.error('[APP] Error fetching signal:', error);
        showError('Connection error. Retrying in 10 seconds...');
        // Retry in 10 seconds
        setTimeout(() => {
            if (isRunning) fetchAndDisplaySignal();
        }, 10000);
    }
    
    updateUIState('running');
}

/**
 * Display signal data in UI
 * @param {Object} signal - Signal data from API
 */
function displaySignal(signal) {
    const direction = signal.direction || 'WAIT';
    const strength = signal.strength || 'WAIT';
    const confidence = signal.confidence || 0;
    const pair = signal.pair || selectedPair;
    const timestamp = signal.timestamp ? new Date(signal.timestamp) : new Date();
    
    // Update main signal card
    signalCard.className = `signal-card ${direction.toLowerCase()}`;
    
    // Direction icon
    const icons = { UP: '⬆', DOWN: '⬇', WAIT: '⏸' };
    directionIcon.textContent = icons[direction] || '⏸';
    directionText.textContent = direction;
    
    // Strength badge
    signalStrength.innerHTML = `<span class="strength-badge ${strength}">${strength}</span>`;
    
    // Confidence
    confidenceValue.textContent = `${confidence}%`;
    confidenceFill.style.width = `${confidence}%`;
    
    // Meta info
    signalPair.textContent = pair;
    signalTime.textContent = formatTime(timestamp);
    
    // Update indicators
    updateIndicators(signal.indicators);
    
    // Update context
    updateContext(signal.filters);
    
    // Calculate and display total score
    let score = 0;
    if (signal.indicators) {
        const ind = signal.indicators;
        score += ind.rsi?.points || 0;
        score += ind.ema?.points || 0;
        score += ind.macd?.points || 0;
        score += ind.stochRSI?.points || 0;
        score += ind.bollingerBands?.points || 0;
        score += ind.candlePattern?.points || 0;
        
        // Bonuses
        if (signal.filters?.trend5m !== 'RANGING') score += 15;
        if (signal.filters?.marketSession) score += 5;
    }
    totalScore.textContent = `${Math.min(100, score)} / 100`;
}

/**
 * Update indicator display rows
 * @param {Object} indicators - Indicators object from API
 */
function updateIndicators(indicators) {
    if (!indicators) {
        resetIndicators();
        return;
    }
    
    // RSI
    const rsi = indicators.rsi || {};
    rsiValue.textContent = rsi.value !== null ? rsi.value.toFixed(2) : '--';
    rsiStatus.textContent = rsi.signal === 'UP' || rsi.signal === 'DOWN' ? '✅' : '❌';
    rsiStatusText.textContent = rsi.signal === 'UP' ? 'OVERSOLD' : rsi.signal === 'DOWN' ? 'OVERBOUGHT' : 'NEUTRAL';
    rsiPoints.textContent = rsi.points > 0 ? `+${rsi.points}` : '+0';
    rsiPoints.className = `indicator-points ${rsi.points > 0 ? '' : 'zero'}`;
    rsiRow.className = `indicator-row ${rsi.signal === 'UP' ? 'positive' : rsi.signal === 'DOWN' ? 'negative' : ''}`;
    
    // EMA
    const ema = indicators.ema || {};
    emaValue.textContent = ema.ema9 !== null && ema.ema21 !== null 
        ? `${ema.ema9.toFixed(4)} / ${ema.ema21.toFixed(4)}` 
        : '--';
    emaStatus.textContent = ema.signal === 'UP' || ema.signal === 'DOWN' ? '✅' : '❌';
    emaStatusText.textContent = ema.crossover ? 'CROSSOVER' : ema.signal === 'UP' ? 'BULLISH' : ema.signal === 'DOWN' ? 'BEARISH' : 'NEUTRAL';
    emaPoints.textContent = ema.points > 0 ? `+${ema.points}` : '+0';
    emaPoints.className = `indicator-points ${ema.points > 0 ? '' : 'zero'}`;
    emaRow.className = `indicator-row ${ema.signal === 'UP' ? 'positive' : ema.signal === 'DOWN' ? 'negative' : ''}`;
    
    // MACD
    const macd = indicators.macd || {};
    macdValue.textContent = macd.macd !== null && macd.signal_line !== null
        ? `${macd.macd.toFixed(5)} / ${macd.signal_line.toFixed(5)}`
        : '--';
    macdStatus.textContent = macd.signal === 'UP' || macd.signal === 'DOWN' ? '✅' : '❌';
    macdStatusText.textContent = macd.signal === 'UP' ? 'POSITIVE' : macd.signal === 'DOWN' ? 'NEGATIVE' : 'NEUTRAL';
    macdPoints.textContent = macd.points > 0 ? `+${macd.points}` : '+0';
    macdPoints.className = `indicator-points ${macd.points > 0 ? '' : 'zero'}`;
    macdRow.className = `indicator-row ${macd.signal === 'UP' ? 'positive' : macd.signal === 'DOWN' ? 'negative' : ''}`;
    
    // Stochastic RSI
    const stoch = indicators.stochRSI || {};
    stochValue.textContent = stoch.k !== null ? `${stoch.k.toFixed(2)} / ${stoch.d?.toFixed(2) || '--'}` : '--';
    stochStatus.textContent = stoch.signal === 'UP' || stoch.signal === 'DOWN' ? '✅' : '❌';
    stochStatusText.textContent = stoch.signal === 'UP' ? 'OVERSOLD' : stoch.signal === 'DOWN' ? 'OVERBOUGHT' : 'NEUTRAL';
    stochPoints.textContent = stoch.points > 0 ? `+${stoch.points}` : '+0';
    stochPoints.className = `indicator-points ${stoch.points > 0 ? '' : 'zero'}`;
    stochRow.className = `indicator-row ${stoch.signal === 'UP' ? 'positive' : stoch.signal === 'DOWN' ? 'negative' : ''}`;
    
    // Bollinger Bands
    const bb = indicators.bollingerBands || {};
    bbValue.textContent = bb.position !== null ? `${bb.position.toFixed(1)}%` : '--';
    bbStatus.textContent = bb.signal === 'UP' || bb.signal === 'DOWN' ? '✅' : '❌';
    bbStatusText.textContent = bb.signal === 'UP' ? 'SUPPORT' : bb.signal === 'DOWN' ? 'RESISTANCE' : 'MIDDLE';
    bbPoints.textContent = bb.points > 0 ? `+${bb.points}` : '+0';
    bbPoints.className = `indicator-points ${bb.points > 0 ? '' : 'zero'}`;
    bbRow.className = `indicator-row ${bb.signal === 'UP' ? 'positive' : bb.signal === 'DOWN' ? 'negative' : ''}`;
    
    // Candle Pattern
    const pattern = indicators.candlePattern || {};
    patternValue.textContent = pattern.pattern || '--';
    patternStatus.textContent = pattern.signal === 'UP' || pattern.signal === 'DOWN' ? '✅' : '❌';
    
    const patternNames = {
        'HAMMER': 'HAMMER',
        'SHOOTING_STAR': 'SHOOTING',
        'BULLISH_ENGULFING': 'BULL ENG',
        'BEARISH_ENGULFING': 'BEAR ENG',
        'DOJI': 'DOJI',
        'NONE': 'NONE'
    };
    patternStatusText.textContent = patternNames[pattern.pattern] || 'NONE';
    patternPoints.textContent = pattern.points > 0 ? `+${pattern.points}` : '+0';
    patternPoints.className = `indicator-points ${pattern.points > 0 ? '' : 'zero'}`;
    patternRow.className = `indicator-row ${pattern.signal === 'UP' ? 'positive' : pattern.signal === 'DOWN' ? 'negative' : ''}`;
}

/**
 * Reset indicator displays to initial state
 */
function resetIndicators() {
    const indicators = {
        rsi: { value: null, signal: 'NEUTRAL', points: 0 },
        ema: { ema9: null, ema21: null, crossover: false, signal: 'NEUTRAL', points: 0 },
        macd: { macd: null, signal_line: null, histogram: null, signal: 'NEUTRAL', points: 0 },
        stochRSI: { k: null, d: null, signal: 'NEUTRAL', points: 0 },
        bollingerBands: { upper: null, middle: null, lower: null, position: null, signal: 'NEUTRAL', points: 0 },
        candlePattern: { pattern: 'NONE', signal: 'NEUTRAL', points: 0 }
    };
    updateIndicators(indicators);
    totalScore.textContent = '0 / 100';
}

/**
 * Update market context display
 * @param {Object} filters - Filters object from API
 */
function updateContext(filters) {
    if (!filters) {
        resetContext();
        return;
    }
    
    // 5min Trend
    const trend = filters.trend5m || 'RANGING';
    const trendArrows = { UPTREND: '↑', DOWNTREND: '↓', RANGING: '→' };
    const trendClasses = { UPTREND: 'up', DOWNTREND: 'down', RANGING: 'neutral' };
    trend5mValue.innerHTML = `
        <span class="trend-arrow ${trendClasses[trend]}">${trendArrows[trend]}</span>
        <span class="trend-text ${trendClasses[trend]}">${trend}</span>
    `;
    
    // Market Session
    const isActive = filters.marketSession;
    sessionValue.innerHTML = `
        <span class="session-dot ${isActive ? 'active' : 'inactive'}"></span>
        <span class="session-text ${isActive ? 'active' : 'inactive'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
    `;
    
    // Ranging Market
    const isRanging = filters.isRanging;
    rangingValue.innerHTML = `<span class="ranging-text ${isRanging ? 'yes' : 'no'}">${isRanging ? 'YES' : 'NO'}</span>`;
    
    // Reversal Detected
    const reversal = filters.reversalDetected;
    reversalValue.innerHTML = `<span class="reversal-text ${reversal ? 'yes' : 'no'}">${reversal ? 'YES' : 'NO'}</span>`;
}

/**
 * Reset context display to initial state
 */
function resetContext() {
    updateContext({
        trend5m: 'RANGING',
        marketSession: false,
        isRanging: false,
        reversalDetected: false
    });
}

/**
 * Reset signal display to initial state
 */
function resetSignalDisplay() {
    signalCard.className = 'signal-card wait';
    directionIcon.textContent = '⏸';
    directionText.textContent = 'WAIT';
    signalStrength.innerHTML = '<span class="strength-badge">WAIT</span>';
    confidenceValue.textContent = '0%';
    confidenceFill.style.width = '0%';
    signalPair.textContent = '--';
    signalTime.textContent = '--:--:--';
}

/**
 * Start the countdown timer
 */
function startCountdown() {
    countdownValue = 60;
    updateCountdownDisplay();
    
    timerInterval = setInterval(() => {
        countdownValue--;
        updateCountdownDisplay();
        
        if (countdownValue <= 0) {
            countdownValue = 60;
            fetchAndDisplaySignal();
        }
    }, 1000);
}

/**
 * Stop the countdown timer
 */
function stopCountdown() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    countdownValue = 60;
    updateCountdownDisplay();
}

/**
 * Update countdown display
 */
function updateCountdownDisplay() {
    const minutes = Math.floor(countdownValue / 60);
    const seconds = countdownValue % 60;
    countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Turn red when < 10 seconds
    if (countdownValue < 10) {
        countdownEl.className = 'countdown-value urgent';
    } else {
        countdownEl.className = 'countdown-value';
    }
}

/**
 * Add signal to history
 * @param {Object} signal - Signal data
 */
function addToHistory(signal) {
    const now = new Date();
    const entry = {
        time: formatTime(now),
        pair: signal.pair || selectedPair,
        direction: signal.direction || 'WAIT',
        strength: signal.strength || 'WAIT',
        confidence: signal.confidence || 0
    };
    
    signalHistory.unshift(entry);
    
    if (signalHistory.length > MAX_HISTORY_ROWS) {
        signalHistory.pop();
    }
    
    updateHistoryTable(entry);
}

/**
 * Update history table with new row
 * @param {Object} latestEntry - The newest entry to animate
 */
function updateHistoryTable(latestEntry = null) {
    if (signalHistory.length === 0) {
        historyBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">No signals yet. Start the bot to see signals.</td>
            </tr>
        `;
        return;
    }
    
    historyBody.innerHTML = signalHistory.map((entry, index) => {
        const isNew = latestEntry && index === 0;
        return `
            <tr class="${isNew ? 'new-row' : ''}">
                <td>${entry.time}</td>
                <td>${entry.pair}</td>
                <td class="signal-cell ${entry.direction.toLowerCase()}">${entry.direction}</td>
                <td class="strength-cell ${entry.strength}">${entry.strength}</td>
                <td>${entry.confidence}%</td>
            </tr>
        `;
    }).join('');
}

/**
 * Update UTC clock display
 */
function updateClock() {
    const now = new Date();
    utcClock.textContent = formatTime(now);
}

/**
 * Format time to HH:MM:SS
 * @param {Date} date - Date object
 * @returns {string} - Formatted time string
 */
function formatTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        timeZone: 'UTC'
    });
}

/**
 * Show error banner
 * @param {string} message - Error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorBanner.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorBanner.classList.remove('show');
    }, 5000);
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
