const API_BASE = 'http://localhost:3000';
const UPDATE_INTERVAL = 60000;
const MAX_HISTORY_ROWS = 10;

let isRunning = false;
let timerInterval = null;
let remainingSeconds = 60;
let signalHistory = [];

const pairSelect = document.getElementById('pairSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const signalBox = document.getElementById('signalBox');
const signalText = document.getElementById('signalText');
const confidenceValue = document.getElementById('confidenceValue');
const confidenceFill = document.getElementById('confidenceFill');
const countdown = document.getElementById('countdown');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const historyBody = document.getElementById('historyBody');

const rsiValue = document.getElementById('rsiValue');
const rsiDetail = document.getElementById('rsiDetail');
const rsiStatus = document.getElementById('rsiStatus');
const rsiCard = document.getElementById('rsiCard');

const emaValue = document.getElementById('emaValue');
const emaDetail = document.getElementById('emaDetail');
const emaStatus = document.getElementById('emaStatus');
const emaCard = document.getElementById('emaCard');

const macdValue = document.getElementById('macdValue');
const macdDetail = document.getElementById('macdDetail');
const macdStatus = document.getElementById('macdStatus');
const macdCard = document.getElementById('macdCard');

async function fetchPairs() {
    try {
        const response = await fetch(`${API_BASE}/pairs`);
        const pairs = await response.json();
        
        pairs.forEach(pair => {
            const option = document.createElement('option');
            option.value = pair.id;
            option.textContent = pair.name;
            pairSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching pairs:', error);
        showError('Failed to load trading pairs. Make sure the server is running.');
    }
}

async function fetchSignal(pair) {
    try {
        signalText.textContent = 'Fetching...';
        signalBox.className = 'signal-box wait';
        
        const response = await fetch(`${API_BASE}/signal?pair=${pair}`);
        const data = await response.json();
        
        updateSignalDisplay(data);
        addToHistory(data);
        
        return data;
    } catch (error) {
        console.error('Error fetching signal:', error);
        showError('Error fetching signal. Check your connection.');
        return null;
    }
}

function updateSignalDisplay(data) {
    const direction = data.direction || 'WAIT';
    const confidence = data.confidence || 0;
    const indicators = data.indicators || {};

    signalText.textContent = direction;
    signalBox.className = `signal-box ${direction.toLowerCase()}`;
    
    confidenceValue.textContent = `${confidence}%`;
    confidenceFill.style.width = `${confidence}%`;

    if (indicators.rsi) {
        updateRSIDisplay(indicators.rsi);
    }
    
    if (indicators.ema) {
        updateEMADisplay(indicators.ema);
    }
    
    if (indicators.macd) {
        updateMACDDisplay(indicators.macd);
    }
}

function updateRSIDisplay(rsi) {
    const value = rsi.value;
    const signal = rsi.signal;
    
    rsiValue.textContent = value !== null ? value.toFixed(2) : '--';
    
    if (signal === 'UP') {
        rsiStatus.textContent = '✅';
        rsiDetail.textContent = 'Oversold (< 40) - Buy signal';
        rsiCard.style.borderLeft = '4px solid var(--up-color)';
    } else if (signal === 'DOWN') {
        rsiStatus.textContent = '✅';
        rsiDetail.textContent = 'Overbought (> 60) - Sell signal';
        rsiCard.style.borderLeft = '4px solid var(--down-color)';
    } else {
        rsiStatus.textContent = '❌';
        rsiDetail.textContent = 'Neutral zone';
        rsiCard.style.borderLeft = '4px solid var(--wait-color)';
    }
}

function updateEMADisplay(ema) {
    const ema9 = ema.ema9;
    const ema21 = ema.ema21;
    const signal = ema.signal;
    
    if (ema9 !== null && ema21 !== null) {
        emaValue.textContent = `${ema9.toFixed(5)} / ${ema21.toFixed(5)}`;
    } else {
        emaValue.textContent = '--';
    }
    
    if (signal === 'UP') {
        emaStatus.textContent = '✅';
        emaDetail.textContent = 'EMA9 > EMA21 - Bullish';
        emaCard.style.borderLeft = '4px solid var(--up-color)';
    } else if (signal === 'DOWN') {
        emaStatus.textContent = '✅';
        emaDetail.textContent = 'EMA9 < EMA21 - Bearish';
        emaCard.style.borderLeft = '4px solid var(--down-color)';
    } else {
        emaStatus.textContent = '❌';
        emaDetail.textContent = 'Neutral';
        emaCard.style.borderLeft = '4px solid var(--wait-color)';
    }
}

function updateMACDDisplay(macd) {
    const macdLine = macd.macd;
    const signalLine = macd.signal_line;
    const histogram = macd.histogram;
    const signal = macd.signal;
    
    if (macdLine !== null && signalLine !== null) {
        macdValue.textContent = `${macdLine.toFixed(5)} / ${signalLine.toFixed(5)}`;
        macdDetail.textContent = `Histogram: ${histogram ? histogram.toFixed(5) : '--'}`;
    } else {
        macdValue.textContent = '--';
        macdDetail.textContent = 'Waiting...';
    }
    
    if (signal === 'UP') {
        macdStatus.textContent = '✅';
        macdDetail.textContent += ' | MACD > Signal - Bullish';
        macdCard.style.borderLeft = '4px solid var(--up-color)';
    } else if (signal === 'DOWN') {
        macdStatus.textContent = '✅';
        macdDetail.textContent += ' | MACD < Signal - Bearish';
        macdCard.style.borderLeft = '4px solid var(--down-color)';
    } else {
        macdStatus.textContent = '❌';
        macdCard.style.borderLeft = '4px solid var(--wait-color)';
    }
}

function addToHistory(data) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false });
    
    const entry = {
        time: timeString,
        pair: data.pair || pairSelect.options[pairSelect.selectedIndex]?.text || 'Unknown',
        direction: data.direction || 'WAIT',
        confidence: data.confidence || 0
    };
    
    signalHistory.unshift(entry);
    
    if (signalHistory.length > MAX_HISTORY_ROWS) {
        signalHistory.pop();
    }
    
    updateHistoryTable();
}

function updateHistoryTable() {
    if (signalHistory.length === 0) {
        historyBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="4">No signals yet. Start the bot to see signals.</td>
            </tr>
        `;
        return;
    }
    
    historyBody.innerHTML = signalHistory.map(entry => `
        <tr>
            <td>${entry.time}</td>
            <td>${entry.pair}</td>
            <td class="signal-cell ${entry.direction.toLowerCase()}">${entry.direction}</td>
            <td>${entry.confidence}%</td>
        </tr>
    `).join('');
}

function startTimer() {
    remainingSeconds = 60;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay();
        
        if (remainingSeconds <= 0) {
            const selectedPair = pairSelect.value;
            if (selectedPair && isRunning) {
                fetchSignal(selectedPair);
            }
            remainingSeconds = 60;
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    remainingSeconds = 60;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function startBot() {
    const selectedPair = pairSelect.value;
    
    if (!selectedPair) {
        showError('Please select a trading pair first.');
        return;
    }
    
    isRunning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    statusDot.classList.add('active');
    statusText.textContent = 'Active';
    
    fetchSignal(selectedPair);
    startTimer();
}

function stopBot() {
    isRunning = false;
    stopTimer();
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    const statusDot = statusIndicator.querySelector('.status-dot');
    statusDot.classList.remove('active');
    statusText.textContent = 'Stopped';
}

function showError(message) {
    signalText.textContent = 'ERROR';
    signalBox.className = 'signal-box wait';
    console.error(message);
}

function resetIndicators() {
    rsiValue.textContent = '--';
    rsiDetail.textContent = 'Waiting...';
    rsiStatus.textContent = '❌';
    rsiCard.style.borderLeft = 'none';
    
    emaValue.textContent = '--';
    emaDetail.textContent = 'Waiting...';
    emaStatus.textContent = '❌';
    emaCard.style.borderLeft = 'none';
    
    macdValue.textContent = '--';
    macdDetail.textContent = 'Waiting...';
    macdStatus.textContent = '❌';
    macdCard.style.borderLeft = 'none';
}

startBtn.addEventListener('click', startBot);
stopBtn.addEventListener('click', stopBot);

pairSelect.addEventListener('change', () => {
    if (!isRunning) {
        resetIndicators();
    }
});

fetchPairs();
updateTimerDisplay();
