const axios = require('axios');

/**
 * Fetch candles from Twelve Data API
 * @param {string} symbol - Trading pair symbol (e.g., "EUR/USD")
 * @returns {Promise<Array|null>} - Array of candle objects or null if failed
 */
async function fetchCandles(symbol) {
    try {
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        
        if (!apiKey || apiKey === 'your_key_here') {
            console.error('Error: Twelve Data API key not configured');
            return null;
        }

        const response = await axios.get('https://api.twelvedata.com/time_series', {
            params: {
                symbol: symbol,
                interval: '1min',
                outputsize: 50,
                apikey: apiKey,
                format: 'JSON'
            },
            timeout: 10000
        });

        if (response.data.status === 'error' || !response.data.values) {
            console.error('API Error:', response.data.message || 'Unknown error');
            return null;
        }

        const candles = response.data.values.map(candle => ({
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseInt(candle.volume) || 0,
            datetime: candle.datetime
        }));

        return candles.reverse();
    } catch (error) {
        console.error('Error fetching candles:', error.message);
        return null;
    }
}

module.exports = { fetchCandles };
