const express = require('express');
const yahooFinance = require('yahoo-finance2');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Abilita CORS
app.use(cors());

// Serve i file statici dalla cartella 'public' (Home page e istruzioni)
app.use(express.static(path.join(__dirname, 'public')));

// Rotta per i prezzi
app.get('/price', async (req, res) => {
  const symbolsParam = req.query.symbols;
  
  if (!symbolsParam) {
    return res.status(400).json({ error: "Parametro 'symbols' mancante. Esempio: /price?symbols=AAPL,SWDA.MI" });
  }

  const symbols = symbolsParam.split(',');
  const results = [];

  try {
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
        console.error(`Errore nel recupero del simbolo ${symbol}:`, err.message);
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error("Errore generico API:", error);
    res.status(500).json({ error: "Errore interno del server durante il recupero dei dati" });
  }
});

// Avvio del server
app.listen(port, () => {
  console.log(`Server proxy avviato sulla porta ${port}`);
});
