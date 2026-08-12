const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Abilita CORS per permettere alla tua app di chiamare questo proxy
app.use(cors());

// --- LA CORREZIONE CHE TI SERVIVA ---
// Questo comando dice a Express di cercare file nella cartella 'public'
// Quando visiti la root (/), Express caricherà automaticamente 'public/index.html'
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
    // Ciclo per recuperare ogni simbolo
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
        // Non blocchiamo tutto se un solo ticker fallisce
      }
    }
    
    // Invio della risposta JSON
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
