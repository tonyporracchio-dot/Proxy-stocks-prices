import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Esempio: /price?symbol=IWDA.MI
app.get("/price", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Parametro 'symbol' mancante" });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Yahoo ha risposto con status ${response.status}`, symbol });
    }

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!price) {
      return res.status(404).json({ error: "Simbolo non trovato o dato non disponibile", symbol });
    }

    res.json({ symbol, price: Number(price) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server prezzi-proxy avviato sulla porta ${PORT}`);
});
