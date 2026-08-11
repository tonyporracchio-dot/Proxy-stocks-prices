const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Cache in memoria (2 minuti) per evitare chiamate ripetute a Yahoo Finance
const cache = {};
const CACHE_DURATION_MS = 2 * 60 * 1000;

async function getSingleStockData(symbol) {
  const sym = symbol.trim().toUpperCase();
  const now = Date.now();

  // Controllo Cache
  if (cache[sym] && (now - cache[sym].timestamp < CACHE_DURATION_MS)) {
    return cache[sym].data;
  }

  // Endpoint Chart v8: stabile, veloce e privo di blocchi crumb/cookie
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`;
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    timeout: 8000
  });

  const meta = response.data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Dati non trovati per ${sym}`);

  // 1. Prezzo Attuale (diamo priorità al prezzo di mercato regolare)
  const currentPrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;

  // 2. Chiusura di Ieri CORRETTA (priorità ai dati ufficiali di chiusura precedente)
  const prevClose = meta.regularMarketPreviousClose ?? meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;
  
  // 3. Calcolo Variazione Percentualizzata
  let changePercent = 0;
  if (prevClose > 0) {
    changePercent = ((currentPrice - prevClose) / prevClose) * 100;
  }

  const itemData = {
    symbol: sym,
    price: currentPrice,
    changePercent: parseFloat(changePercent.toFixed(2)),
    currency: meta.currency || 'EUR'
  };

  // Salva in Cache
  cache[sym] = { data: itemData, timestamp: now };
  return itemData;
}

app.get('/price', async (req, res) => {
  const rawSymbols = req.query.symbols || req.query.symbol;

  if (!rawSymbols) {
    return res.status(400).json({ error: 'Parametro symbol o symbols mancante.' });
  }

  const symbolList = Array.from(
    new Set(rawSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
  );

  try {
    const promises = symbolList.map(sym => 
      getSingleStockData(sym).catch(err => {
        console.error(`Errore per ${sym}:`, err.message);
        return null;
      })
    );

    const resultsArray = await Promise.all(promises);
    const validResults = resultsArray.filter(Boolean);

    if (req.query.symbol && symbolList.length === 1) {
      if (validResults.length === 0) {
        return res.status(404).json({ error: 'Simbolo non trovato.' });
      }
      return res.json(validResults[0]);
    }

    return res.json({
      count: validResults.length,
      results: validResults
    });
  } catch (error) {
    return res.status(500).json({ error: 'Errore durante il recupero dei dati.' });
  }
});

app.listen(PORT, () => console.log(`Proxy attivo sulla porta ${PORT}`));
