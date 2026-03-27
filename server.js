const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'LeadAgent Backend — Pagine Si!' }));

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

// Generazione sito preview (nessun timeout!)
app.post('/preview', async (req, res) => {
  try {
    const { nome, indirizzo, telefono, tipi, descrizione, rating, nRating, logoUrl } = req.body;

    const logoSection = logoUrl
      ? `Usa questo logo reale: <img src="${logoUrl}" alt="Logo ${nome}" style="max-height:70px;object-fit:contain;">`
      : `Crea un logo testuale elegante con le iniziali in un cerchio colorato con il colore brand del settore.`;

    const prompt = `Sei un web designer esperto italiano. Crea un sito web preview professionale, moderno e visualmente ricco in HTML per questa attività locale. Pagine Sì! lo sta creando come dimostrazione gratuita.

DATI ATTIVITÀ:
- Nome: ${nome}
- Indirizzo: ${indirizzo}
- Telefono: ${telefono || 'da inserire'}
- Tipo: ${(tipi||[]).slice(0,3).join(', ') || 'attività locale'}
- Descrizione: ${descrizione || 'non disponibile'}
- Rating Google: ${rating ? rating + '/5 (' + nRating + ' recensioni)' : 'non disponibile'}
- Logo: ${logoSection}

REQUISITI DESIGN — molto importante, NON fare qualcosa da PowerPoint:
- Google Fonts eleganti e adatti al settore (es. Playfair Display + Lato per ristoranti, Montserrat per sport, ecc.)
- Design moderno con palette colori sofisticata e coerente al settore
- Immagini reali da Unsplash con URL diretti (formato: https://images.unsplash.com/photo-XXXXX?w=1200&q=80)
- Sezioni ben spaziate, ombre sottili (box-shadow), border-radius morbidi, hover effects CSS
- Completamente responsive (meta viewport + media queries)
- Animazioni CSS leggere su scroll o hover

STRUTTURA:
1. Banner sottile colorato in cima: "🎁 Preview gratuita di Pagine Sì! — Contattaci per attivare il tuo sito → paginesispa.it"
2. Navbar sticky con logo/nome, menu (Chi Siamo, Servizi, Recensioni, Contatti), CTA button "Contattaci"
3. Hero fullscreen con immagine Unsplash reale pertinente, overlay scuro, titolo grande, tagline, 2 CTA buttons
4. Sezione "La nostra storia" con testo credibile 4-5 righe + foto da Unsplash
5. Sezione "I nostri servizi" con 6 card, icone SVG inline pertinenti, descrizioni
6. Sezione "Cosa dicono di noi" con 4 recensioni realistiche (nomi italiani, testo lungo 2-3 righe, stelle ★★★★★)
7. Sezione contatti: indirizzo, telefono cliccabile, email inventata, orari tipici del settore, iframe Google Maps per "${indirizzo}"
8. Footer con nome, P.IVA inventata, icone social SVG, "Sito realizzato da Pagine Sì! — paginesispa.it"

RISPONDI SOLO CON CODICE HTML COMPLETO. Inizia con <!DOCTYPE html> senza nessun testo prima.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LeadAgent Backend running on port ${PORT}`));
