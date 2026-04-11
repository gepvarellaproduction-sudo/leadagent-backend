const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

function dataforseoAuth() {
  return 'Basic ' + Buffer.from(DATAFORSEO_LOGIN + ':' + DATAFORSEO_PASSWORD).toString('base64');
}

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'LeadAgent Backend â€” Pagine Si!' }));

// Google Places search
app.post('/places', async (req, res) => {
  try {
    const { query, pageToken } = req.body;
    const body = { textQuery: query, languageCode: 'it', maxResultCount: 20 };
    if (pageToken) body.pageToken = pageToken;

    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.id,places.photos,places.editorialSummary,places.types,nextPageToken'
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Analisi mercato AI
app.post('/analyze', async (req, res) => {
  try {
    const { messages } = req.body;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Generazione sito preview
app.post('/preview', async (req, res) => {
  try {
    const { nome, indirizzo, telefono, tipi, descrizione, rating, nRating, logoUrl } = req.body;

    const logoSection = logoUrl
      ? `Usa questo logo reale: <img src="${logoUrl}" alt="Logo ${nome}" style="max-height:70px;object-fit:contain;">`
      : `Crea un logo testuale elegante con le iniziali in un cerchio colorato con il colore brand del settore.`;

    const tipiStr = (tipi||[]).slice(0,3).join(', ') || 'attivita locale';
    const prompt = `<!DOCTYPE html> â€” Genera SOLO questo file HTML completo per: "${nome}", ${tipiStr}, ${indirizzo}, tel: ${telefono||'da inserire'}.
${logoSection}
${rating ? 'Rating: '+rating+'/5 ('+nRating+' rec)' : ''}

DESIGN: Google Fonts adatti al settore, palette sofisticata, immagini Unsplash reali (https://images.unsplash.com/photo-ID?w=1200&q=80), responsive, hover effects.

STRUTTURA COMPLETA:
<header>: banner "Preview gratuita Pagine Si! â€” paginesispa.it" + navbar sticky con logo, menu, CTA
<section id="hero">: immagine Unsplash fullscreen + overlay + titolo + tagline + 2 bottoni
<section id="storia">: testo 4-5 righe + foto Unsplash
<section id="servizi">: 6 card con icone SVG + titolo + descrizione
<section id="recensioni">: 4 recensioni italiane realistiche con stelle
<section id="contatti">: indirizzo, telefono, email, orari, iframe maps
<footer>: nome, P.IVA, social SVG, "Realizzato da Pagine Si! paginesispa.it"

Scrivi il codice completo senza interruzioni. INIZIA CON <!DOCTYPE html>.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    let html = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    html = html.trim().replace(/^```html?\n?/, '').replace(/\n?```$/, '');

    res.json({ html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ TEST DataForSEO â€” endpoint temporaneo per verificare connessione â”€â”€â”€â”€â”€â”€
app.get('/test-seo', async (req, res) => {
  try {
    const keyword = req.query.keyword || 'bar rutigliano';

    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': dataforseoAuth(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        keyword: keyword,
        location_code: 2380,
        language_code: 'it',
        depth: 10
      }])
    });

    const data = await resp.json();
    const task = data.tasks && data.tasks[0];
    if (!task) return res.json({ error: 'Nessun task', raw: data });

    const risultati = (task.result || []).flatMap(r => r.items || [])
      .filter(item => item.type === 'organic')
      .slice(0, 10)
      .map((item, idx) => ({
        posizione: idx + 1,
        titolo: item.title,
        url: item.url,
        dominio: item.domain
      }));

    res.json({
      keyword,
      cost: task.cost,
      n_risultati: risultati.length,
      risultati
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// â”€â”€ SEO Rank â€” posizione reale per nome azienda + keyword â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/seo-rank', async (req, res) => {
  try {
    const { nome, web, categoria, citta } = req.body;
    if (!categoria || !citta) return res.status(400).json({ error: 'categoria e citta richiesti' });

    const keyword = categoria + ' ' + citta;

    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': dataforseoAuth(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        keyword: keyword,
        location_code: 2380,
        language_code: 'it',
        depth: 100
      }])
    });

    const data = await resp.json();
    const task = data.tasks && data.tasks[0];
    if (!task || !task.result) return res.json({ keyword, posizione: null, trovato: false });

    const items = (task.result || []).flatMap(r => r.items || [])
      .filter(item => item.type === 'organic');

    // Cerca per dominio del sito o per nome
    const nomeNorm = (nome || '').toLowerCase();
    const webNorm = web ? web.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;

    let posizioneReale = null;
    let urlTrovato = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const dominioItem = (item.domain || '').toLowerCase();
      const titoloItem = (item.title || '').toLowerCase();

      if (webNorm && dominioItem.includes(webNorm)) {
        posizioneReale = i + 1;
        urlTrovato = item.url;
        break;
      }
      if (nomeNorm && titoloItem.includes(nomeNorm.split(' ')[0])) {
        posizioneReale = i + 1;
        urlTrovato = item.url;
        break;
      }
    }

    res.json({
      keyword,
      posizione: posizioneReale,
      url: urlTrovato,
      trovato: !!posizioneReale,
      n_risultati_totali: items.length,
      cost: task.cost
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LeadAgent Backend running on port ${PORT}`));
