/**
 * groq-ai.js - Groq AI Integration
 * Connects to Groq API (Llama 3.3 70B) for AI-powered signal analysis
 */

const axios = require('axios');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const RATE_LIMIT_MS = 30000;

const lastAPICall = new Map();
const apiCache = new Map();

async function getAISignal(pair, indicators, candles) {
    const cacheKey = pair;
    const lastCall = lastAPICall.get(cacheKey) || 0;
    const now = Date.now();
    if (now - lastCall < RATE_LIMIT_MS) {
        const cached = apiCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }
    try {
        const response = await axios.post(
            GROQ_API_URL,
            {
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert binary options trading analyst for 1-minute timeframe signals on Quotex platform.
You MUST always predict either BUY or SELL.
Never say WAIT or NEUTRAL - always commit to a direction.
Respond ONLY with valid JSON, no other text whatsoever.`
                    },
                    {
                        role: 'user',
                        content: buildUserPrompt(pair, indicators, candles)
                    }
                ],
                temperature: 0.3,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        lastAPICall.set(cacheKey, Date.now());
        const result = parseAIResponse(response.data, indicators);
        apiCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('[GROQ] API Error:', error.message);
        return getFallbackResponse(indicators);
    }
}

function buildUserPrompt(pair, indicators, candles) {
    const latestClose = candles.length > 0 ? candles[candles.length - 1].close.toFixed(5) : 'N/A';
    const last10Closes = candles.length >= 10 
        ? candles.slice(-10).map(c => c.close.toFixed(5)).join(', ')
        : candles.map(c => c.close.toFixed(5)).join(', ') || 'N/A';
    const priceChange = calculatePriceChange(candles);
    const last5Candles = buildCandlesText(candles);
    const { indicators: ind, buyPoints, sellPoints, suggestedDirection, summary } = indicators;
    return `Analyze ${pair} and predict next 1-minute candle direction.
You MUST choose BUY or SELL, no other options allowed.

PRICE DATA:
Current price: ${latestClose}
Last 10 closes: ${last10Closes}
Price change last 5 candles: ${priceChange}

TECHNICAL INDICATORS:
RSI(14): ${ind.rsi.value || 'N/A'} → ${ind.rsi.signal}
EMA9: ${ind.ema.ema9 || 'N/A'} EMA21: ${ind.ema.ema21 || 'N/A'} → ${ind.ema.signal}
MACD: ${ind.macd.macd || 'N/A'} Signal: ${ind.macd.signal_line || 'N/A'} Histogram: ${ind.macd.histogram || 'N/A'} → ${ind.macd.signal}
StochRSI K: ${ind.stochRsi.k || 'N/A'} D: ${ind.stochRsi.d || 'N/A'} → ${ind.stochRsi.signal}
Bollinger Upper: ${ind.bollinger.upper || 'N/A'} Lower: ${ind.bollinger.lower || 'N/A'} Width: ${ind.bollinger.width || 0}% → ${ind.bollinger.signal}
Candle Pattern: ${ind.candlePattern.pattern} → ${ind.candlePattern.signal}

STRATEGY SCORE:
BUY points: ${buyPoints}
SELL points: ${sellPoints}
Strategy suggests: ${suggestedDirection}
Summary: ${summary}

LAST 5 CANDLES:
${last5Candles}

Choose BUY or SELL based on which has stronger evidence.
When uncertain, pick the direction with more indicator support.

Respond ONLY with this JSON:
{
  "direction": "BUY" or "SELL",
  "confidence": number 0-100,
  "reasoning": "max 2 sentences",
  "risk": "LOW" or "MEDIUM" or "HIGH",
  "key_factor": "single most important reason"
}`;
}

function calculatePriceChange(candles) {
    if (candles.length < 5) return 'N/A';
    const last5 = candles.slice(-5);
    const first = last5[0].open;
    const last = last5[4].close;
    const change = ((last - first) / first) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

function buildCandlesText(candles) {
    if (candles.length === 0) return 'No candle data';
    const last5 = candles.slice(-5);
    return last5.map((c, i) => {
        const color = c.close >= c.open ? 'GREEN' : 'RED';
        return `${i + 1}. O:${c.open.toFixed(5)} H:${c.high.toFixed(5)} L:${c.low.toFixed(5)} C:${c.close.toFixed(5)} [${color}]`;
    }).join('\n');
}

function parseAIResponse(data, indicators) {
    try {
        let content = data.choices?.[0]?.message?.content || '';
        content = content.trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return getFallbackResponse(indicators);
        }
        const parsed = JSON.parse(jsonMatch[0]);
        let direction = parsed.direction?.toUpperCase();
        if (direction !== 'BUY' && direction !== 'SELL') {
            direction = indicators.suggestedDirection;
        }
        return {
            direction: direction,
            confidence: Math.min(100, Math.max(0, parseInt(parsed.confidence) || 50)),
            reasoning: parsed.reasoning || 'Analysis based on technical indicators',
            risk: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.risk) ? parsed.risk : 'MEDIUM',
            key_factor: parsed.key_factor || 'Technical indicator alignment'
        };
    } catch (error) {
        console.error('[GROQ] Parse error:', error.message);
        return getFallbackResponse(indicators);
    }
}

function getFallbackResponse(indicators) {
    return {
        direction: indicators.suggestedDirection,
        confidence: 40,
        reasoning: 'Using strategy direction due to API unavailable',
        risk: 'MEDIUM',
        key_factor: 'Fallback to technical analysis'
    };
}

function clearCache(pair) {
    apiCache.delete(pair);
}

function clearAllCache() {
    apiCache.clear();
    lastAPICall.clear();
}

module.exports = {
    getAISignal,
    clearCache,
    clearAllCache
};
