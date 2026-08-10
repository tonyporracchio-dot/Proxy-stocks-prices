const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Abilita CORS per permettere chiamate da qualsiasi origine (frontend web / PWA)
app.use(cors());

// Variabili di cache per cookie e crumb di Yahoo Finance
let yahooCookie = null;
let yahooCrumb = null;

// Funzione per ottenere Cookie e Crumb validi da Yahoo Finance
async function getYahooCredentials() {
  try {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    // 1. Ottieni il cookie di sessione
    const response = await axios.get('https://fc.yahoo.com', {
      headers: { 'User-Agent': userAgent },
      maxRedirects: 5
    }).catch(err => err.response);

    const setCookieHeader = response?.headers['set-cookie'];
    if (!setCookieHeader) throw new Error('Impossibile recuperare il cookie da Yahoo');
    yahooCookie = setCookieHeader.map(c => c.split(';')[0]).join('; ');

    // 2. Ottieni il crumb usando il cookie ottenuto
    const crumbResponse = await axios.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': userAgent,
        'Cookie': yahooCookie
      }
    });

    yahooCrumb = crumbResponse.data;
    console.log('Nuovo Crumb Yahoo ottenuto con successo:', yahooCrumb);
  } catch (error) {
    console.error('Errore nel recupero credenziali Yahoo:', error.message);
    throw error;
  }
}

// Endpoint principale: /price?symbol=MWRD.MI
app.get('/price', async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.status(400).json({ error: 'Parametro "symbol" mancante. Esempio: /price?symbol=MWRD.MI' });
  }

  try {
    // Se non abbiamo ancora cookie e crumb, li recuperiamo
    if (!yahooCookie || !yahooCrumb) {
      await getYahooCredentials();
    }

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price&crumb=${encodeURIComponent(yahooCrumb)}`;

    let response;
    try {
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': yahooCookie
        }
      });
    } catch (fetchErr) {
      // In caso di errore 401/403, il crumb potrebbe essere scaduto: riproviamo una volta rigenerandolo
      if (fetchErr.response && (fetchErr.response.status === 401 || fetchErr.response.status === 403)) {
        console.log('Crumb scaduto. Rigenerazione in corso...');
        await getYahooCredentials();
        response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': yahooCookie
          }
        });
      } else {
        throw fetchErr;
      }
    }

    const priceData = response.data?.quoteSummary?.result?.[0]?.price;

    if (!priceData) {
      return res.status(404).json({ error: `Nessun dato trovato per il simbolo "${symbol}"` });
    }

    // Risposta strutturata e pulita in formato JSON
    return res.json({
      symbol: symbol,
      price: priceData.regularMarketPrice?.raw || 0,
      currency: priceData.currency || 'EUR',
      changePercent: (priceData.regularMarketChangePercent?.raw || 0) * 100,
      longName: priceData.longName || priceData.shortName || symbol
    });

  } catch (error) {
    console.error(`Errore nel recupero dati per ${symbol}:`, error.message);
    return res.status(500).json({ 
      error: 'Errore durante la chiamata a Yahoo Finance', 
      details: error.message 
    });
  }
});

// Avvio del server Express
app.listen(PORT, () => {
  console.log(`Proxy attivo sulla porta ${PORT}`);
});
