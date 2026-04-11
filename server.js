const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

function dfsAuth() {
  return 'Basic ' + Buffer.from(DATAFORSEO_LOGIN + ':' + DATAFORSEO_PASSWORD).toString('base64');
}

async function dfsSearch(keyword, depth) {
  depth = depth || 10;
  var resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword: keyword, location_code: 2380, language_code: 'it', depth: depth }])
  });
  var data = await resp.json();
  var task = data.tasks && data.tasks[0];
  if (!task || !task.result) return [];
  return (task.result || []).flatMap(function(r) { return r.items || []; }).filter(function(i) { return i.type === 'organic'; });
}

app.get('/', function(req, res) {
  res.json({ status: 'ok', service: 'LeadAgent Backend - Pagine Si!' });
});

app.post('/places', async function(req, res) {
  try {
    var body = { textQuery: req.body.query, languageCode: 'it', maxResultCount: 20 };
    if (req.body.pageToken) body.pageToken = req.body.pageToken;
    var resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.id,places.photos,places.editorialSummary,places.types,nextPageToken'
      },
      body: JSON.stringify(body)
    });
    res.json(await resp.json());
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/analyze', async function(req, res) {
  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: req.body.messages })
    });
    res.json(await resp.json());
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/preview', async function(req, res) {
  try {
    var nome = req.body.nome, indirizzo = req.body.indirizzo, telefono = req.body.telefono;
    var tipi = req.body.tipi, rating = req.body.rating, nRating = req.body.nRating, logoUrl = req.body.logoUrl;
    var logoSection = logoUrl
      ? 'Usa questo logo: <img src="' + logoUrl + '" style="max-height:70px">'
      : 'Crea logo testuale con iniziali in cerchio colorato.';
    var tipiStr = (tipi||[]).slice(0,3).join(', ') || 'attivita locale';
    var prompt = '<!DOCTYPE html> - Genera SOLO HTML completo per: "' + nome + '", ' + tipiStr + ', ' + indirizzo + ', tel: ' + (telefono||'da inserire') + '. ' +
      logoSection + (rating ? ' Rating: '+rating+'/5 ('+nRating+' rec).' : '') +
      ' DESIGN professionale Google Fonts, Unsplash, responsive. STRUTTURA: header banner Pagine Si!, hero fullscreen, storia, 6 servizi, 4 recensioni, contatti maps, footer. INIZIA CON <!DOCTYPE html>.';
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
    });
    var data = await resp.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    var html = (data.content || []).filter(function(b){ return b.type==='text'; }).map(function(b){ return b.text; }).join('');
    html = html.trim().replace(/^```html?\n?/, '').replace(/\n?```$/, '');
    res.json({ html: html });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Cerca profili social tramite Google Search
async function cercaSocial(nomeAzienda, citta) {
  var risultati = { facebook: null, instagram: null };
  try {
    var items = await dfsSearch('"' + nomeAzienda + '" ' + citta + ' facebook OR instagram', 10);
    items.forEach(function(item) {
      var url = (item.url || '').toLowerCase();
      var dom = (item.domain || '').toLowerCase();
      if (!risultati.facebook && (dom === 'www.facebook.com' || dom === 'facebook.com') && url.includes('facebook.com/')) {
        // Verifica che non sia la homepage di Facebook
        var path = url.replace(/https?:\/\/(www\.)?facebook\.com\/?/, '');
        if (path && path.length > 2 && !path.startsWith('search') && !path.startsWith('pages/search')) {
          risultati.facebook = item.url;
        }
      }
      if (!risultati.instagram && (dom === 'www.instagram.com' || dom === 'instagram.com') && url.includes('instagram.com/')) {
        var path2 = url.replace(/https?:\/\/(www\.)?instagram\.com\/?/, '');
        if (path2 && path2.length > 2 && !path2.startsWith('explore')) {
          risultati.instagram = item.url;
        }
      }
    });
  } catch(e) {}
  return risultati;
}

// Cerca posizione Google reale
async function cercaPosizioneGoogle(nome, web, categoria, citta) {
  var keyword = categoria + ' ' + citta;
  try {
    var items = await dfsSearch(keyword, 100);
    var nomeNorm = (nome || '').toLowerCase();
    var webNorm = web ? web.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;
    for (var i = 0; i < items.length; i++) {
      var dom = (items[i].domain || '').toLowerCase();
      var tit = (items[i].title || '').toLowerCase();
      if (webNorm && dom.includes(webNorm)) return { posizione: i+1, url: items[i].url, keyword: keyword };
      if (nomeNorm.split(' ')[0] && tit.includes(nomeNorm.split(' ')[0]) && tit.includes(citta.toLowerCase())) {
        return { posizione: i+1, url: items[i].url, keyword: keyword };
      }
    }
    return { posizione: null, url: null, keyword: keyword, non_trovato: true };
  } catch(e) {
    return null;
  }
}

// Cerca competitor reali su Google Maps
async function cercaCompetitorMaps(categoria, citta, nomeLeadNorm) {
  try {
    var resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber'
      },
      body: JSON.stringify({ textQuery: categoria + ' ' + citta, languageCode: 'it', maxResultCount: 10 })
    });
    var data = await resp.json();
    if (!data.places) return [];
    return data.places
      .filter(function(p) {
        var nome = ((p.displayName && p.displayName.text) || '').toLowerCase().trim();
        return nome && nome !== nomeLeadNorm && !nome.includes(nomeLeadNorm.slice(0, 5));
      })
      .slice(0, 3)
      .map(function(p) {
        return {
          nome: (p.displayName && p.displayName.text) || 'N/D',
          rating: p.rating ? p.rating.toFixed(1) : null,
          n_recensioni: p.userRatingCount || 0,
          ha_sito: !!p.websiteUri,
          sito: p.websiteUri || null
        };
      });
  } catch(e) { return []; }
}

// Endpoint analisi completa
app.post('/analisi', async function(req, res) {
  try {
    var lead = req.body.lead;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    var nome = lead.nome || '';
    var categoria = lead.categoria || '';
    var citta = lead.citta || '';
    var web = (lead.web && lead.web !== 'N/D') ? lead.web : null;
    var nRating = lead.nRating || 0;
    var rating = lead.rating || null;
    var nomeNorm = nome.toLowerCase().trim();

    // Tre ricerche in parallelo
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta),
      cercaCompetitorMaps(categoria, citta, nomeNorm)
    ]);

    var seo = risultati[0];
    var social = risultati[1];
    var competitor = risultati[2];

    // Costruisci HTML analisi
    var secStyle = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var boxStyle = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;margin-bottom:24px';

    var body = '';

    // Posizionamento Google
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Posizionamento Google</div>';
    if (seo && seo.posizione) {
      var posColor = seo.posizione <= 10 ? '#2e7d32' : seo.posizione <= 30 ? '#f57f17' : '#c62828';
      var posLabel = seo.posizione <= 10 ? 'Prima pagina' : seo.posizione <= 30 ? 'Pagine 2-3' : 'Oltre pagina 3';
      body += '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;' + boxStyle + '">';
      body += '<div style="text-align:center;flex-shrink:0"><div style="font-size:3rem;font-weight:800;color:' + posColor + ';line-height:1">#' + seo.posizione + '</div>';
      body += '<div style="font-size:8pt;color:#aaa;margin-top:4px;text-transform:uppercase">Posizione su Google</div></div>';
      body += '<div><div style="font-size:10pt;font-weight:700;color:' + posColor + ';margin-bottom:6px">' + posLabel + '</div>';
      body += '<div style="font-size:9.5pt;color:#555">Keyword: <strong>' + (seo.keyword || '') + '</strong></div>';
      if (seo.url) body += '<div style="font-size:8.5pt;color:#aaa;margin-top:6px;word-break:break-all">' + seo.url + '</div>';
      body += '</div></div>';
    } else if (seo && seo.non_trovato) {
      body += '<div style="' + boxStyle + '">';
      body += '<div style="font-size:1.8rem;font-weight:800;color:#c62828;margin-bottom:8px">Non trovato</div>';
      body += '<div style="font-size:9.5pt;color:#555">Non rilevato nelle prime 100 posizioni per: <strong>' + (seo.keyword || categoria + ' ' + citta) + '</strong></div>';
      body += '<div style="font-size:9pt;color:#888;margin-top:6px">Assenza quasi totale dalla ricerca organica Google</div>';
      body += '</div>';
    } else {
      body += '<div style="' + boxStyle + '"><div style="color:#aaa;font-size:9.5pt">Analisi non disponibile - verifica categoria e citta</div></div>';
    }
    body += '</div>';

    // Social Media
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Profili Social</div>';
    body += '<div style="' + boxStyle + '">';
    var haFb = !!social.facebook;
    var haIg = !!social.instagram;
    if (!haFb && !haIg) {
      body += '<div style="color:#c62828;font-weight:600;margin-bottom:6px">Nessun profilo social trovato</div>';
      body += '<div style="font-size:9pt;color:#888">Nessun profilo Facebook o Instagram rilevato tramite ricerca Google</div>';
    } else {
      if (haFb) body += '<a href="' + social.facebook + '" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:#1877f2;color:white;border-radius:8px;font-size:10pt;font-weight:600;text-decoration:none;margin-right:10px;margin-bottom:8px">Facebook - Apri profilo</a>';
      if (haIg) body += '<a href="' + social.instagram + '" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:#e1306c;color:white;border-radius:8px;font-size:10pt;font-weight:600;text-decoration:none;margin-bottom:8px">Instagram - Apri profilo</a>';
    }
    body += '</div></div>';

    // Competitor
    body += '<div style="margin-bottom:24px">';
    body += '<div style="' + secStyle + '">Competitor di Zona - Dati Google Maps</div>';
    if (competitor && competitor.length) {
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
      competitor.forEach(function(c) {
        body += '<div style="flex:1;min-width:160px;border:1px solid #eee;border-radius:8px;padding:14px;background:#fafafa">';
        body += '<div style="font-size:10pt;font-weight:700;color:#1a1a1a;margin-bottom:10px">' + c.nome + '</div>';
        if (c.rating) {
          body += '<div style="font-size:9pt;color:#777;margin-bottom:5px">Rating: <strong>' + c.rating + '/5</strong> (' + c.n_recensioni + ' recensioni)</div>';
        }
        body += '<div style="font-size:9pt;color:#777;margin-bottom:5px">Sito web: <strong>' + (c.ha_sito ? 'Si' : 'No') + '</strong></div>';
        if (c.ha_sito && c.sito) {
          var dom = c.sito.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
          body += '<div style="font-size:8.5pt;color:#1565c0">' + dom + '</div>';
        }
        body += '</div>';
      });
      body += '</div>';

      // Gap analysis
      body += '<div style="margin-top:16px;padding:14px 16px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px">';
      body += '<div style="font-size:9.5pt;font-weight:700;color:#795548;margin-bottom:8px">Gap Analysis - Confronto con i competitor</div>';
      var leadHaSito = !!web;
      var compConSito = competitor.filter(function(c){ return c.ha_sito; }).length;
      var compRatingMedio = competitor.filter(function(c){ return c.rating; }).reduce(function(acc,c){ return acc+parseFloat(c.rating); }, 0) / (competitor.filter(function(c){ return c.rating; }).length || 1);
      var compRecMedio = competitor.reduce(function(acc,c){ return acc+c.n_recensioni; }, 0) / competitor.length;

      if (!leadHaSito && compConSito > 0) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">- Sito web: <strong>' + compConSito + '/' + competitor.length + ' competitor ce l\'hanno</strong>, il lead no</div>';
      }
      if (rating && compRatingMedio > rating) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">- Rating: lead ' + rating + '/5 vs media competitor ' + compRatingMedio.toFixed(1) + '/5</div>';
      }
      if (nRating < compRecMedio) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">- Recensioni: lead ' + nRating + ' vs media competitor ' + Math.round(compRecMedio) + '</div>';
      }
      body += '</div>';
    } else {
      body += '<div style="' + boxStyle + '"><div style="color:#aaa;font-size:9.5pt">Nessun competitor trovato su Google Maps per questa categoria e zona</div></div>';
    }
    body += '</div>';

    // HTML completo
    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Analisi - ' + nome + '</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}' +
      '.page{max-width:860px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}' +
      '.hdr{background:#111;padding:20px 28px}.hdr-t{font-size:13pt;font-weight:700;color:white}.hdr-s{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:3px}' +
      '.lead-box{border-left:5px solid #E8001C;background:#f9f9f9;padding:14px 20px;margin:20px 28px;border-radius:0 8px 8px 0}' +
      '.body{padding:8px 28px 28px}' +
      '@media print{body{background:white}.page{box-shadow:none}}</style>' +
      '</head><body><div class="page">' +
      '<div class="hdr"><div class="hdr-t">Analisi Digitale - ' + nome + '</div>' +
      '<div class="hdr-s">' + (lead.indirizzo || '') + ' | Lead Agent - Pagine Si!</div></div>' +
      '<div class="lead-box">' +
      '<div style="font-size:9pt;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Dati lead</div>' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:9.5pt;color:#555">' +
      (web ? '<span>Sito: <a href="' + web + '" target="_blank" style="color:#1565c0">' + web + '</a></span>' : '<span style="color:#c62828">Nessun sito web</span>') +
      '<span>Rating: ' + (rating ? rating + '/5 (' + nRating + ' rec.)' : 'N/D') + '</span>' +
      '<span>Categoria: ' + categoria + ' ' + citta + '</span>' +
      '</div></div>' +
      '<div class="body">' + body + '</div>' +
      '</div></body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('LeadAgent Backend running on port ' + PORT); });
