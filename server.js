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
app.get('/', (req, res) => res.json({ status: 'ok', service: 'LeadAgent Backend - Pagine Si!' }));

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
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages })
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
      ? 'Usa questo logo reale: <img src="' + logoUrl + '" alt="Logo ' + nome + '" style="max-height:70px;object-fit:contain;">'
      : 'Crea un logo testuale elegante con le iniziali in un cerchio colorato con il colore brand del settore.';
    const tipiStr = (tipi||[]).slice(0,3).join(', ') || 'attivita locale';
    const ratingStr = rating ? 'Rating: ' + rating + '/5 (' + nRating + ' rec)' : '';
    const prompt = '<!DOCTYPE html> - Genera SOLO questo file HTML completo per: "' + nome + '", ' + tipiStr + ', ' + indirizzo + ', tel: ' + (telefono||'da inserire') + '.\n' +
      logoSection + '\n' + ratingStr + '\n\n' +
      'DESIGN: Google Fonts adatti al settore, palette sofisticata, immagini Unsplash reali (https://images.unsplash.com/photo-ID?w=1200&q=80), responsive, hover effects.\n\n' +
      'STRUTTURA COMPLETA:\n' +
      '<header>: banner "Preview gratuita Pagine Si! - paginesispa.it" + navbar sticky con logo, menu, CTA\n' +
      '<section id="hero">: immagine Unsplash fullscreen + overlay + titolo + tagline + 2 bottoni\n' +
      '<section id="storia">: testo 4-5 righe + foto Unsplash\n' +
      '<section id="servizi">: 6 card con icone SVG + titolo + descrizione\n' +
      '<section id="recensioni">: 4 recensioni italiane realistiche con stelle\n' +
      '<section id="contatti">: indirizzo, telefono, email, orari, iframe maps\n' +
      '<footer>: nome, P.IVA, social SVG, "Realizzato da Pagine Si! paginesispa.it"\n\n' +
      'Scrivi il codice completo senza interruzioni. INIZIA CON <!DOCTYPE html>.';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
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

//  Helper: cerca posizione Google e competitor via DataForSEO 
async function cercaSEO(categoria, citta, nomeAzienda, webAzienda) {
  const keyword = categoria + ' ' + citta;
  try {
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': dataforseoAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword, location_code: 2380, language_code: 'it', depth: 100 }])
    });
    const data = await resp.json();
    const task = data.tasks && data.tasks[0];
    if (!task || !task.result) return null;

    const items = (task.result || []).flatMap(r => r.items || []).filter(i => i.type === 'organic');
    const directory = ['paginegialle', 'tripadvisor', 'paginebianche', 'virgilio', 'yelp', 'google', 'facebook', 'instagram', 'tiktok'];

    // Posizione azienda
    const nomeNorm = (nomeAzienda || '').toLowerCase();
    const webNorm = webAzienda ? webAzienda.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;
    let posizione = null;
    let urlTrovato = null;
    for (let i = 0; i < items.length; i++) {
      const dom = (items[i].domain || '').toLowerCase();
      const tit = (items[i].title || '').toLowerCase();
      if (webNorm && dom.includes(webNorm)) { posizione = i + 1; urlTrovato = items[i].url; break; }
      if (nomeNorm.split(' ')[0] && tit.includes(nomeNorm.split(' ')[0]) && tit.includes(citta.toLowerCase())) {
        posizione = i + 1; urlTrovato = items[i].url; break;
      }
    }

    // Competitor: prime posizioni non-directory, non-lead
    const competitor = items.filter(item => {
      const dom = (item.domain || '').toLowerCase();
      return !directory.some(d => dom.includes(d)) && !(webNorm && dom.includes(webNorm));
    }).slice(0, 3).map((item, idx) => ({
      nome: item.title || item.domain,
      dominio: item.domain,
      posizione_google: items.indexOf(item) + 1,
      url: item.url
    }));

    return { keyword, posizione, urlTrovato, trovato: !!posizione, competitor };
  } catch(e) {
    return null;
  }
}

//  Helper: cerca competitor su Google Maps 
async function cercaMaps(categoria, citta, nomeAzienda) {
  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri'
      },
      body: JSON.stringify({ textQuery: categoria + ' ' + citta, languageCode: 'it', maxResultCount: 8 })
    });
    const data = await resp.json();
    if (!data.places) return [];
    const nomeNorm = (nomeAzienda || '').toLowerCase().trim();
    return data.places
      .filter(p => {
        const n = ((p.displayName && p.displayName.text) || '').toLowerCase();
        return n && !n.includes(nomeNorm.slice(0, 5));
      })
      .slice(0, 3)
      .map((p, idx) => ({
        nome: (p.displayName && p.displayName.text) || 'N/D',
        posizione_maps: idx + 1,
        rating: p.rating ? p.rating.toFixed(1) : 'N/D',
        n_recensioni: p.userRatingCount || 0,
        ha_sito: !!p.websiteUri
      }));
  } catch(e) {
    return [];
  }
}

//  /analisi-badge: dati rapidi per badge tabella 
app.post('/analisi-badge', async (req, res) => {
  try {
    const { nome, web, socialLink, nRating, rating, categoria, citta } = req.body;
    const hasSito = !!web;
    const hasSocial = !!socialLink;
    const isFb = socialLink && socialLink.includes('facebook');
    const isIg = socialLink && socialLink.includes('instagram');

    // Social livello
    const socialLivello = hasSocial ? 'BASE' : 'ASSENTE';

    // Posizionamento Google via DataForSEO
    let posLivello = 'N/D';
    let posValore = null;
    if (categoria && citta) {
      const seo = await cercaSEO(categoria, citta, nome, web);
      if (seo) {
        posValore = seo.trovato ? seo.posizione : '100+';
        const p = seo.trovato ? seo.posizione : 101;
        posLivello = p <= 10 ? 'ALTO' : p <= 30 ? 'MEDIO' : 'BASSO';
      }
    } else {
      // Stima se no categoria/citta
      const nr = nRating || 0;
      if (!hasSito && nr < 10) posLivello = 'BASSO';
      else if (!hasSito) posLivello = 'BASSO';
      else if (nr >= 100 && rating >= 4.2) posLivello = 'ALTO';
      else if (nr >= 50 && rating >= 4.0) posLivello = 'MEDIO';
      else posLivello = 'BASSO';
    }

    res.json({
      social: { livello: socialLivello, link_fb: isFb ? socialLink : null, link_ig: isIg ? socialLink : null },
      posizione: { livello: posLivello, valore: posValore }
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

//  /analisi: pagina analisi completa 
app.post('/analisi', async (req, res) => {
  try {
    const { lead } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    const categoria = lead.categoria || '';
    const citta = lead.citta || '';
    const hasSito = !!(lead.web && lead.web !== 'N/D');
    const socialLink = lead.socialLink || null;
    const hasSocial = !!socialLink;
    const isFb = socialLink && socialLink.includes('facebook');
    const isIg = socialLink && socialLink.includes('instagram');

    // Chiamate in parallelo
    const [seo, mapsComp] = await Promise.all([
      categoria && citta ? cercaSEO(categoria, citta, lead.nome, lead.web) : Promise.resolve(null),
      categoria && citta ? cercaMaps(categoria, citta, lead.nome) : Promise.resolve([])
    ]);

    // Posizione
    const keyword = categoria && citta ? categoria + ' ' + citta : 'N/D';
    let posizioneLabel, posLivello, posColore, posCommento;
    if (seo && seo.trovato) {
      posizioneLabel = '#' + seo.posizione;
      posLivello = seo.posizione <= 10 ? 'ALTO' : seo.posizione <= 30 ? 'MEDIO' : 'BASSO';
      posColore = seo.posizione <= 10 ? '#2e7d32' : seo.posizione <= 30 ? '#f57f17' : '#c62828';
      posCommento = seo.posizione <= 10 ? 'Prima pagina Google - ottima visibilita' : seo.posizione <= 30 ? 'Pagine 2-3 Google - visibilita migliorabile' : 'Oltre la terza pagina - intervento SEO necessario';
    } else if (seo && !seo.trovato) {
      posizioneLabel = '100+';
      posLivello = 'BASSO';
      posColore = '#c62828';
      posCommento = 'Non trovato nelle prime 100 posizioni per "' + keyword + '"';
    } else {
      posizioneLabel = 'N/D';
      posLivello = 'N/D';
      posColore = '#9e9e9e';
      posCommento = 'Analisi non disponibile';
    }

    // Competitor: preferisce SERP Google, fallback Maps
    var competitorHTML = '';
    var useSerp = seo && seo.competitor && seo.competitor.length > 0;
    var comp = useSerp ? seo.competitor : mapsComp;

    if (comp && comp.length) {
      var cells = comp.map(function(c, idx) {
        var pNum = useSerp ? c.posizione_google : c.posizione_maps;
        var pCls = pNum <= 10 ? 'background:#e8f5e9;color:#2e7d32' : pNum <= 30 ? 'background:#fff8e1;color:#f57f17' : 'background:#fce8e8;color:#c62828';
        var cell = '<div style="flex:1;min-width:150px;border:1px solid #eee;border-radius:8px;padding:12px;background:#fafafa">';
        cell += '<div style="font-size:10pt;font-weight:700;margin-bottom:8px">' + c.nome + '</div>';
        cell += '<div style="font-size:9pt;color:#777;margin-bottom:4px">Posiz.: <span style="padding:1px 7px;border-radius:10px;font-weight:700;font-size:8pt;' + pCls + '">#' + pNum + '</span></div>';
        if (!useSerp) {
          cell += '<div style="font-size:9pt;color:#777;margin-bottom:4px">Rating: <strong>' + (c.rating || 'N/D') + '</strong> (' + (c.n_recensioni || 0) + ' rec.)</div>';
          cell += '<div style="font-size:9pt;color:#777">Sito: <strong>' + (c.ha_sito ? 'Si' : 'No') + '</strong></div>';
        } else if (c.dominio) {
          cell += '<div style="font-size:8.5pt;color:#1565c0;margin-top:4px">' + c.dominio + '</div>';
        }
        cell += '</div>';
        return cell;
      }).join('');
      var fonte = useSerp ? 'Dati Google Search reali' : 'Dati Google Maps reali';
      competitorHTML = '<div style="margin-bottom:20px">' +
        '<div style="font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #E8001C">Competitor di Zona - ' + fonte + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cells + '</div></div>';
    }

    // Scenario
    var nRating = lead.nRating || 0;
    var sbSito = hasSito ? 40 : 5;
    var sbSocial = hasSocial ? 20 : 5;
    var sbGoogle = seo && seo.trovato ? Math.max(5, Math.round((1 - (seo.posizione/100)) * 60)) : 10;

    function barra(label, before, after) {
      return '<div style="margin-bottom:12px">' +
        '<div style="font-size:9pt;color:#555;margin-bottom:5px;font-weight:600">' + label + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
          '<span style="font-size:8pt;color:#aaa;width:34px;flex-shrink:0">Ora</span>' +
          '<div style="flex:1;height:7px;background:#f0f0f0;border-radius:99px">' +
            '<div style="height:7px;width:' + before + '%;background:#E8001C;border-radius:99px"></div>' +
          '</div>' +
          '<span style="font-size:9pt;color:#E8001C;font-weight:700;width:40px;text-align:right">' + before + '%</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:8pt;color:#aaa;width:34px;flex-shrink:0">Dopo</span>' +
          '<div style="flex:1;height:7px;background:#f0f0f0;border-radius:99px">' +
            '<div style="height:7px;width:84%;background:#4caf50;border-radius:99px"></div>' +
          '</div>' +
          '<span style="font-size:9pt;color:#4caf50;font-weight:700;width:40px;text-align:right">+84%</span>' +
        '</div>' +
      '</div>';
    }

    // Opportunita
    var opps = [];
    if (!hasSito) opps.push('Creare sito web: indispensabile per comparire su "' + keyword + '"');
    else if (posLivello === 'BASSO') opps.push('SEO locale: scalare verso le prime 10 posizioni per "' + keyword + '"');
    if (!hasSocial) opps.push('Aprire profili FB+IG: nessuna presenza social rilevata');
    else opps.push('Gestione social professionale: da profilo statico a contenuti regolari');
    if (nRating < 50) opps.push('Piano recensioni: aumentare da ' + nRating + ' verso 50+ per migliorare Google Maps');

    var oppsHTML = opps.map(function(o) {
      return '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:7px;padding:9px 13px;margin-bottom:7px;font-size:10pt;color:#6d4c00">+ ' + o + '</div>';
    }).join('');

    // Social links
    var socialLinksHTML = '';
    if (isFb) socialLinksHTML += '<a href="' + socialLink + '" target="_blank" style="display:inline-block;margin-right:8px;padding:6px 16px;background:#1877f2;color:white;border-radius:20px;font-size:9.5pt;font-weight:600;text-decoration:none">Facebook</a>';
    if (isIg) socialLinksHTML += '<a href="' + socialLink + '" target="_blank" style="display:inline-block;padding:6px 16px;background:#e1306c;color:white;border-radius:20px;font-size:9.5pt;font-weight:600;text-decoration:none">Instagram</a>';

    var secStyle = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #E8001C';

    var body = '';

    // Posizionamento
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Posizionamento Google</div>';
    body += '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">';
    body += '<div style="text-align:center;background:#f9f9f9;border:1px solid #eee;border-radius:10px;padding:20px 28px;flex-shrink:0">';
    body += '<div style="font-size:2.8rem;font-weight:800;color:' + posColore + ';line-height:1">' + posizioneLabel + '</div>';
    body += '<div style="font-size:8pt;color:#aaa;margin-top:5px;text-transform:uppercase">Posizione su Google</div>';
    body += '</div>';
    body += '<div style="flex:1;min-width:180px">';
    var posLivBg = posLivello === 'ALTO' ? 'background:#e8f5e9;color:#2e7d32' : posLivello === 'MEDIO' ? 'background:#fff8e1;color:#f57f17' : posLivello === 'BASSO' ? 'background:#fce8e8;color:#c62828' : 'background:#f5f5f5;color:#9e9e9e';
    body += '<span style="display:inline-block;padding:3px 12px;border-radius:12px;font-weight:700;font-size:10pt;' + posLivBg + '">' + posLivello + '</span>';
    body += '<div style="font-size:9.5pt;color:#555;margin-top:8px">Keyword: <strong>' + keyword + '</strong></div>';
    body += '<div style="font-size:9pt;color:#888;margin-top:4px">' + posCommento + '</div>';
    if (seo && seo.urlTrovato) body += '<div style="font-size:8.5pt;color:#aaa;margin-top:6px">URL: ' + seo.urlTrovato + '</div>';
    body += '</div></div></div>';

    // Social
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Presenza Social Media</div>';
    body += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 18px">';
    var socBg = hasSocial ? 'background:#fff8e1;color:#f57f17' : 'background:#fce8e8;color:#c62828';
    body += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
    body += '<span style="padding:4px 14px;border-radius:20px;font-weight:700;font-size:10.5pt;' + socBg + '">' + (hasSocial ? 'PRESENTE' : 'ASSENTE') + '</span>';
    body += '<span style="font-size:9.5pt;color:#555">' + (hasSocial ? 'Profilo social trovato tramite Google Maps' : 'Nessun profilo social rilevato') + '</span>';
    body += '</div>';
    if (socialLinksHTML) body += socialLinksHTML;
    body += '</div></div>';

    // Competitor
    body += competitorHTML;

    // Scenario
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Scenario di Crescita Atteso</div>';
    body += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px">';
    body += barra('Visibilita sito', sbSito, 82);
    body += barra('Presenza social', sbSocial, 76);
    body += barra('Posiz. Google', sbGoogle, 84);
    body += '</div></div>';

    // Opportunita
    if (oppsHTML) {
      body += '<div>';
      body += '<div style="' + secStyle + '">Opportunita Identificate</div>';
      body += oppsHTML;
      body += '</div>';
    }

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - ' + lead.nome + '</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.page{max-width:860px;margin:0 auto;background:white;border-radius:12px;margin-top:24px;margin-bottom:24px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.header{background:#111;padding:18px 24px;display:flex;align-items:center;gap:12px}.header-title{font-size:13pt;font-weight:700;color:white}.header-sub{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.body{padding:28px}</style>' +
      '</head><body><div class="page">' +
      '<div class="header"><div><div class="header-title">Analisi Digitale - ' + lead.nome + '</div><div class="header-sub">' + (lead.indirizzo || '') + ' - Lead Agent by Pagine Si!</div></div></div>' +
      '<div class="body">' + body + '</div>' +
      '</div></body></html>';

    res.json({ html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LeadAgent Backend running on port ' + PORT));
