const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/price', async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.status(400).json({ error: 'Parametro "symbol" mancante (es. /price?symbol=MWRD.MI)' });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.trim())}?interval=1d&range=1d`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const result = response.data?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: `Nessun dato trovato per il simbolo "${symbol}"` });
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    
    // Calcola la variazione percentuale giornaliera
    let changePercent = 0;
    if (price && previousClose) {
      changePercent = ((price - previousClose) / previousClose) * 100;
    }

    return res.json({
      symbol: meta.symbol || symbol,
      price: price || 0,
      currency: meta.currency || 'EUR',
      changePercent: changePercent,
      longName: meta.longName || meta.shortName || symbol
    });

  } catch (error) {
    console.error(`Errore per il simbolo ${symbol}:`, error.message);
    
    const status = error.response?.status || 500;
    return res.status(status).json({
      error: 'Errore durante la chiamata a Yahoo Finance',
      details: error.response?.status === 429 ? 'Rate limit (429) da Yahoo. Attendi qualche secondo.' : error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy attivo sulla porta ${PORT}`);
});
