import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // permette le chiamate da qualsiasi sito (incluso il tuo portafoglio)

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Esempio: /price?symbol=swda.uk
app.get("/price", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Parametro 'symbol' mancante" });
  }

  try {
    const stooqUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol)}&f=sd2t2ohlcv&h&e=csv`;
    const response = await fetch(stooqUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/csv,text/plain,*/*"
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Stooq ha risposto con status ${response.status}` });
    }

    const text = await response.text();
    const lines = text.trim().split("\n");

    if (lines.length < 2) {
      return res.status(502).json({ error: "Risposta vuota da Stooq" });
    }

    const cols = lines[1].split(",");
    const closeRaw = (cols[6] || "").trim();

    if (!closeRaw || closeRaw.toUpperCase() === "N/D" || isNaN(Number(closeRaw))) {
      return res.status(404).json({ error: "Simbolo non trovato su Stooq", symbol });
    }

    res.json({
      symbol,
      price: Number(closeRaw),
      date: cols[1] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server prezzi-proxy avviato sulla porta ${PORT}`);
});
