let socket = null;
let isRunning = false;
let selectedPair = 'EURUSD';
let currentSignal = null;
let countdown = 60;
let history = [];
let countdownInterval = null;

const API_BASE = 'http://localhost:3000';
const CIRCUMFERENCE = 2 * Math.PI * 52;

function init() {
    socket = io(API_BASE);
    setupSocketListeners();
    setupUIListeners();
    startClock();
    fetchPairs();
}

function setupSocketListeners() {
    socket.on('connect', () => {
        updateWSBadge(true);
        console.log('[APP] Connected to server');
    });

    socket.on('disconnect', () => {
        updateWSBadge(false);
        console.log('[APP] Disconnected from server');
    });

    socket.on('signal', (signal) => {
        currentSignal = signal;
        displaySignal(signal);
        addToHistory(signal);
        resetCountdown();
    });

    socket.on('ws_status', (status) => {
        console.log('[APP] WS Status:', status);
        updateWSBadge(status === 'CONNECTED');
    });

    socket.on('candle_update', (data) => {
        document.getElementById('candleCount').textContent = `${data.count}/100`;
    });

    socket.on('error', (error) => {
        console.error('[APP] Server error:', error);
    });
}

function setupUIListeners() {
    document.getElementById('startBtn').addEventListener('click', startBot);
    document.getElementById('stopBtn').addEventListener('click', stopBot);
    document.getElementById('pairSelect').addEventListener('change', handlePairChange);
}

async function fetchPairs() {
    try {
        const response = await fetch(`${API_BASE}/pairs`);
        const data = await response.json();
        if (data.success) {
            const select = document.getElementById('pairSelect');
            select.innerHTML = '';
            data.pairs.forEach(pair => {
                const option = document.createElement('option');
                option.value = pair.symbol;
                option.textContent = pair.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('[APP] Failed to fetch pairs:', error);
    }
}

function startBot() {
    isRunning = true;
    selectedPair = document.getElementById('pairSelect').value;
    socket.emit('change_pair', { pair: selectedPair });
    updateButtonStates();
    document.getElementById('statusText').textContent = 'RUNNING';
    startCountdown();
}

function stopBot() {
    isRunning = false;
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    updateButtonStates();
    document.getElementById('statusText').textContent = 'STOPPED';
}

function handlePairChange() {
    const newPair = document.getElementById('pairSelect').value;
    if (newPair !== selectedPair && isRunning) {
        socket.emit('change_pair', { pair: newPair });
        selectedPair = newPair;
        history = [];
        updateHistoryTable();
    }
}

function updateButtonStates() {
    document.getElementById('startBtn').disabled = isRunning;
    document.getElementById('stopBtn').disabled = !isRunning;
}

function displaySignal(signal) {
    const card = document.getElementById('mainSignalCard');
    const direction = signal.direction;
    const strength = signal.strength;
    const confidence = signal.confidence;
    card.className = `main-signal-card ${direction.toLowerCase()}`;
    document.getElementById('directionArrow').textContent = direction === 'BUY' ? '⬆' : '⬇';
    document.getElementById('directionArrow').className = `direction-arrow ${direction.toLowerCase()}`;
    document.getElementById('directionText').textContent = direction;
    document.getElementById('directionText').className = `direction-text ${direction.toLowerCase()}`;
    document.getElementById('strengthBadge').textContent = strength;
    document.getElementById('strengthBadge').className = `strength-badge ${strength.toLowerCase()}`;
    document.getElementById('fullLabel').textContent = signal.label;
    document.getElementById('fullLabel').className = `full-label ${direction.toLowerCase()}`;
    document.getElementById('confidenceValue').textContent = confidence;
    animateCircularRing(confidence);
    document.getElementById('riskBadge').textContent = `RISK: ${signal.ai?.risk || '--'}`;
    document.getElementById('riskBadge').className = `risk-badge ${(signal.ai?.risk || 'medium').toLowerCase()}`;
    document.getElementById('agreementBadge').textContent = `AGREEMENT: ${signal.agreement || '--'}`;
    updateAICard(signal.ai);
    updateStrategyRows(signal.strategy?.indicators);
    updateScoreBar(signal.strategy?.buyPoints || 0, signal.strategy?.sellPoints || 0, signal.strategy?.baseScore || 0);
    updateFiltersCard(signal.filters);
    document.getElementById('signalPair').textContent = signal.pair;
}

function animateCircularRing(confidence) {
    const ring = document.getElementById('ringFill');
    const offset = CIRCUMFERENCE * (1 - confidence / 100);
    ring.style.strokeDashoffset = offset;
}

function updateAICard(ai) {
    if (!ai) return;
    document.getElementById('aiDirection').textContent = `Direction: ${ai.direction || '--'}`;
    document.getElementById('aiConfidence').textContent = `Confidence: ${ai.confidence || '--'}%`;
    document.getElementById('aiReasoning').textContent = `Reasoning: ${ai.reasoning || 'Waiting...'}`;
    document.getElementById('aiKeyFactor').textContent = `Key Factor: ${ai.key_factor || '--'}`;
}

function updateStrategyRows(indicators) {
    if (!indicators) return;
    const rsi = indicators.rsi || {};
    document.getElementById('rsiValue').textContent = rsi.value !== null ? rsi.value.toFixed(1) : '--';
    document.getElementById('rsiSignal').textContent = rsi.signal === 'BUY' || rsi.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('rsiPoints').textContent = `+${rsi.points || 0}`;
    document.getElementById('rsiPoints').className = `indicator-points ${rsi.points > 0 ? 'positive' : rsi.points < 0 ? 'negative' : 'neutral'}`;
    const ema = indicators.ema || {};
    document.getElementById('emaValue').textContent = ema.ema9 ? `${ema.ema9.toFixed(5)}/${ema.ema21.toFixed(5)}` : '--';
    document.getElementById('emaSignal').textContent = ema.signal === 'BUY' || ema.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('emaPoints').textContent = `+${ema.points || 0}`;
    document.getElementById('emaPoints').className = `indicator-points ${ema.points > 0 ? 'positive' : ema.points < 0 ? 'negative' : 'neutral'}`;
    const macd = indicators.macd || {};
    document.getElementById('macdValue').textContent = macd.macd !== null ? macd.histogram?.toFixed(5) || '--' : '--';
    document.getElementById('macdSignal').textContent = macd.signal === 'BUY' || macd.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('macdPoints').textContent = `+${macd.points || 0}`;
    document.getElementById('macdPoints').className = `indicator-points ${macd.points > 0 ? 'positive' : macd.points < 0 ? 'negative' : 'neutral'}`;
    const stoch = indicators.stochRsi || {};
    document.getElementById('stochValue').textContent = stoch.k !== null ? stoch.k.toFixed(1) : '--';
    document.getElementById('stochSignal').textContent = stoch.signal === 'BUY' || stoch.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('stochPoints').textContent = `+${stoch.points || 0}`;
    document.getElementById('stochPoints').className = `indicator-points ${stoch.points > 0 ? 'positive' : stoch.points < 0 ? 'negative' : 'neutral'}`;
    const bb = indicators.bollinger || {};
    document.getElementById('bbValue').textContent = bb.width !== 0 ? `${bb.width.toFixed(2)}%` : '--';
    document.getElementById('bbSignal').textContent = bb.signal === 'BUY' || bb.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('bbPoints').textContent = `+${bb.points || 0}`;
    document.getElementById('bbPoints').className = `indicator-points ${bb.points > 0 ? 'positive' : bb.points < 0 ? 'negative' : 'neutral'}`;
    const pattern = indicators.candlePattern || {};
    document.getElementById('patternValue').textContent = pattern.pattern || '--';
    document.getElementById('patternSignal').textContent = pattern.signal === 'BUY' || pattern.signal === 'SELL' ? '✅' : '❌';
    document.getElementById('patternPoints').textContent = `+${pattern.points || 0}`;
    document.getElementById('patternPoints').className = `indicator-points ${pattern.points > 0 ? 'positive' : pattern.points < 0 ? 'negative' : 'neutral'}`;
}

function updateScoreBar(buyPoints, sellPoints, baseScore) {
    const total = buyPoints + sellPoints || 1;
    const buyPercent = (buyPoints / total) * 100;
    const sellPercent = (sellPoints / total) * 100;
    document.getElementById('buyBar').style.width = `${buyPercent}%`;
    document.getElementById('sellBar').style.width = `${sellPercent}%`;
    document.getElementById('scoreTotal').textContent = `Base Score: ${baseScore}`;
}

function updateFiltersCard(filters) {
    if (!filters) return;
    const updateFilter = (id, value) => {
        const el = document.getElementById(id);
        el.textContent = value >= 0 ? `+${value}` : `${value}`;
        el.className = `filter-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`;
    };
    updateFilter('filterSession', filters.sessionBonus || 0);
    updateFilter('filterTrend', filters.trendBonus || 0);
    updateFilter('filterExhaustion', filters.exhaustionBonus || 0);
    updateFilter('filterReversal', filters.reversalBonus || 0);
    updateFilter('filterRanging', filters.rangingPenalty || 0);
    updateFilter('filterConsecutive', filters.consecutivePenalty || 0);
    updateFilter('filterTotal', filters.total || 0);
}

function addToHistory(signal) {
    history.unshift(signal);
    if (history.length > 20) {
        history.pop();
    }
    updateHistoryTable();
}

function updateHistoryTable() {
    const tbody = document.getElementById('historyBody');
    if (history.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No signals yet</td></tr>';
        return;
    }
    tbody.innerHTML = history.map((signal, index) => {
        const time = new Date(signal.timestamp).toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
        const rowClass = signal.direction === 'BUY' ? 'buy-row' : 'sell-row';
        const animClass = index === 0 ? 'new-row' : '';
        return `
            <tr class="${rowClass} ${animClass}">
                <td>${time}</td>
                <td>${signal.pair}</td>
                <td class="signal-cell ${signal.direction.toLowerCase()}">${signal.direction}</td>
                <td>${signal.strength}</td>
                <td>${signal.confidence}%</td>
            </tr>
        `;
    }).join('');
}

function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    countdown = 60;
    updateCountdownDisplay();
    countdownInterval = setInterval(() => {
        countdown--;
        updateCountdownDisplay();
        if (countdown <= 0 && isRunning) {
            countdown = 60;
            socket.emit('change_pair', { pair: selectedPair });
        }
    }, 1000);
}

function resetCountdown() {
    countdown = 60;
    updateCountdownDisplay();
}

function updateCountdownDisplay() {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const el = document.getElementById('countdownValue');
    el.textContent = display;
    el.className = countdown < 10 ? 'countdown-value urgent' : 'countdown-value';
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('utcClock').textContent = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
    }, 1000);
}

function updateWSBadge(connected) {
    const dot = document.querySelector('.ws-dot');
    const text = document.querySelector('.ws-text');
    if (connected) {
        dot.classList.add('connected');
        text.textContent = 'CONNECTED';
    } else {
        dot.classList.remove('connected');
        text.textContent = 'DISCONNECTED';
    }
}

document.addEventListener('DOMContentLoaded', init);
