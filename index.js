const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Cache in memoria (2 minuti) per evitare rate limit da Yahoo
const cache = {};
const CACHE_DURATION_MS = 2 * 60 * 1000;

async function getSingleStockData(symbol) {
  const sym = symbol.trim().toUpperCase();
  const now = Date.now();

  if (cache[sym] && (now - cache[sym].timestamp < CACHE_DURATION_MS)) {
    return cache[sym].data;
  }

  // Endpoint Chart v8
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json'
    },
    timeout: 8000
  });

  const meta = response.data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Dati non trovati per ${sym}`);

  const currentPrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
  
  // 1. Chiusura di riferimento ufficiale
  const prevClose = meta.regularMarketPreviousClose ?? meta.previousClose ?? meta.chartPreviousClose ?? currentPrice;

  // 2. Priorità al dato di variazione nativo fornito da Yahoo Finance per evitare discrepanze
  let changePercent = meta.regularMarketChangePercent;

  if (changePercent === undefined || changePercent === null) {
    if (prevClose > 0) {
      changePercent = ((currentPrice - prevClose) / prevClose) * 100;
    } else {
      changePercent = 0;
    }
  }

  const itemData = {
    symbol: sym,
    price: currentPrice,
    changePercent: parseFloat(Number(changePercent).toFixed(2)),
    currency: meta.currency || 'EUR'
  };

  cache[sym] = { data: itemData, timestamp: now };
  return itemData;
}

// Endpoint principale rispristinato a /price
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

    // Se la richiesta conteneva solo req.query.symbol (singolo)
    if (req.query.symbol && symbolList.length === 1) {
      if (validResults.length === 0) {
        return res.status(404).json({ error: 'Simbolo non trovato.' });
      }
      return res.json(validResults[0]);
    }

    // Risposta standard per ?symbols=...
    return res.json({
      count: validResults.length,
      results: validResults
    });
  } catch (error) {
    return res.status(500).json({ error: 'Errore durante il recupero dei dati.' });
  }
});

app.listen(PORT, () => console.log(`Proxy attivo sulla porta ${PORT}`));
