import express from "express";
import cors from "cors";

const app = express();
app.use(cors()); // permette le chiamate da qualsiasi sito (incluso il tuo portafoglio)

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Esempio: /price?symbol=AAPL  oppure  /price?symbol=SWDA:LSE
app.get("/price", async (req, res) => {
  const raw = req.query.symbol;
  if (!raw) {
    return res.status(400).json({ error: "Parametro 'symbol' mancante" });
  }

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "TWELVEDATA_API_KEY non configurata sul server" });
  }

  // Formato accettato: "SIMBOLO" oppure "SIMBOLO:BORSA" (es. SWDA:LSE)
  const [symbol, exchange] = raw.split(":");

  const params = new URLSearchParams({ symbol, apikey: apiKey });
  if (exchange) params.set("exchange", exchange);

  try {
    const url = `https://api.twelvedata.com/price?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "error" || !data.price) {
      return res.status(404).json({
        error: data.message || "Simbolo non trovato",
        symbol: raw
      });
    }

    res.json({ symbol: raw, price: Number(data.price) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server prezzi-proxy avviato sulla porta ${PORT}`);
});
