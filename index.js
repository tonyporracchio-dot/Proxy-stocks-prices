const express = require('express');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());

app.get('/price', async (req, res) => {
  const symbolsParam = req.query.symbols;
  
  if (!symbolsParam) {
    return res.status(400).json({ error: "Parametro symbols mancante" });
  }

  const symbols = symbolsParam.split(',');
  const results = [];

  for (const symbol of symbols) {
    try {
      const quote = await yahooFinance.quote(symbol.trim());
      results.push({
        symbol: quote.symbol,
        price: quote.regularMarketPrice,
        currency: quote.currency,
        changePercent: quote.regularMarketChangePercent
      });
    } catch (err) {
      console.error(`Errore su ${symbol}:`, err.message);
    }
  }
  
  res.json({ results });
});

app.listen(port, () => {
  console.log(`Server proxy attivo sulla porta 10000`);
});
