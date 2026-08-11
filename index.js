const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache in memoria (chiave: ticker, valore: { data, timestamp })
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti di cache

// Middleware CORS per consentire le chiamate dalla tua PWA / Web App
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Helper per recuperare i dati del singolo ticker da Yahoo Finance (v8 chart)
async function fetchYahooQuote(symbol) {
    const cleanSymbol = symbol.trim().toUpperCase();
    const now = Date.now();

    // 1. Controllo Cache
    if (cache.has(cleanSymbol)) {
        const cachedItem = cache.get(cleanSymbol);
        if (now - cachedItem.timestamp < CACHE_TTL_MS) {
            return cachedItem.data;
        }
    }

    // 2. Chiamata a Yahoo Finance Chart v8 API
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d&range=1d`;
    
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        },
        timeout: 8000
    });

    const meta = response.data?.chart?.result?.[0]?.meta;
    if (!meta) {
        throw new Error(`Dati non trovati per il simbolo: ${cleanSymbol}`);
    }

    const price = meta.regularMarketPrice;
    
    // Riferimento di chiusura ufficiale per calcoli accurati
    const prevClose = meta.regularMarketPreviousClose || meta.previousClose;
    
    // Priorità al dato di variazione percentuale nativo fornito da Yahoo
    let changePercent = meta.regularMarketChangePercent;

    if (changePercent === undefined || changePercent === null) {
        if (price && prevClose) {
            changePercent = ((price - prevClose) / prevClose) * 100;
        } else {
            changePercent = 0;
        }
    }

    const result = {
        symbol: meta.symbol || cleanSymbol,
        price: Number(price) || 0,
        changePercent: Number(Number(changePercent).toFixed(2)),
        currency: meta.currency || 'EUR'
    };

    // Salvataggio in cache
    cache.set(cleanSymbol, { data: result, timestamp: now });

    return result;
}

// Endpoint principale del Proxy
app.get('/api/quote', async (req, res) => {
    // Supporta sia ?symbols=SWDA.MI,VWCE.MI sia ?symbol=SWDA.MI
    const rawSymbols = req.query.symbols || req.query.symbol;

    if (!rawSymbols) {
        return res.status(400).json({ error: "Parametro 'symbols' o 'symbol' mancante nella richiesta." });
    }

    const symbolsArray = rawSymbols.split(',').filter(s => s.trim().length > 0);

    try {
        const promises = symbolsArray.map(symbol => 
            fetchYahooQuote(symbol).catch(err => {
                console.error(`Errore nel recupero di ${symbol}:`, err.message);
                return null;
            })
        );

        const results = (await Promise.all(promises)).filter(item => item !== null);

        res.json({
            count: results.length,
            results: results
        });
    } catch (error) {
        console.error("Errore generale del Proxy:", error.message);
        res.status(500).json({ error: "Errore interno del server durante il recupero dei dati." });
    }
});

// Health-check route per Render
app.get('/', (req, res) => {
    res.send('Yahoo Finance Proxy Server is running.');
});

app.listen(PORT, () => {
    console.log(`Proxy server avviato sulla porta ${PORT}`);
});
