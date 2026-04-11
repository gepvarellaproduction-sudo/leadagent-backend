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
  var resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
    method: 'POST',
    headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keyword: keyword, location_code: 2380, language_code: 'it', depth: depth || 10 }])
  });
  var data = await resp.json();
  var task = data.tasks && data.tasks[0];
  if (!task || !task.result) return [];
  return (task.result || []).flatMap(function(r){ return r.items || []; }).filter(function(i){ return i.type === 'organic'; });
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
    var logoSection = logoUrl ? 'Usa questo logo: <img src="' + logoUrl + '" style="max-height:70px">' : 'Crea logo testuale con iniziali in cerchio colorato.';
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
    var html = (data.content||[]).filter(function(b){ return b.type==='text'; }).map(function(b){ return b.text; }).join('');
    html = html.trim().replace(/^```html?\n?/,'').replace(/\n?```$/,'');
    res.json({ html: html });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Cerca profili social reali via Google
async function cercaSocial(nome, citta) {
  var out = { facebook: null, instagram: null };
  try {
    var items = await dfsSearch('"' + nome + '" ' + citta + ' facebook OR instagram', 10);
    items.forEach(function(item) {
      var url = (item.url || '').toLowerCase();
      var dom = (item.domain || '').toLowerCase();
      if (!out.facebook && dom.includes('facebook.com')) {
        var path = url.replace(/https?:\/\/(www\.)?facebook\.com\/?/,'');
        if (path && path.length > 2 && !path.startsWith('search') && !path.startsWith('watch') && !path.startsWith('groups')) {
          out.facebook = item.url;
        }
      }
      if (!out.instagram && dom.includes('instagram.com')) {
        var path2 = url.replace(/https?:\/\/(www\.)?instagram\.com\/?/,'');
        if (path2 && path2.length > 2 && !path2.startsWith('explore') && !path2.startsWith('p/')) {
          out.instagram = item.url;
        }
      }
    });
  } catch(e) {}
  return out;
}

// Posizione Google organica del lead
async function cercaPosizioneGoogle(nome, web, categoria, citta) {
  var keyword = categoria + ' ' + citta;
  // Domini directory da escludere sempre
  var directory = ['paginegialle','paginebianche','tripadvisor','virgilio','yelp','google','facebook','instagram','tiktok','linkedin','twitter','youtube','wikipedia','comune.','regione.','gov.it','informagiovani','tuttitalia','italiaoggi','corriere','repubblica','sole24ore','lastampa'];
  try {
    var items = await dfsSearch(keyword, 100);
    var webNorm = web ? web.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;
    // Cerca SOLO per dominio del sito - mai per titolo (troppo impreciso)
    if (!webNorm) return { posizione: null, url: null, keyword: keyword, non_trovato: true, items: items, no_sito: true };
    for (var i = 0; i < items.length; i++) {
      var dom = (items[i].domain||'').toLowerCase();
      // Salta le directory
      if (directory.some(function(d){ return dom.includes(d); })) continue;
      if (dom.includes(webNorm)) return { posizione: i+1, url: items[i].url, keyword: keyword, items: items };
    }
    return { posizione: null, url: null, keyword: keyword, non_trovato: true, items: items };
  } catch(e) { return null; }
}

// Competitor da Google Maps con posizione SERP
async function cercaCompetitor(categoria, citta, nomeLeadNorm, webLeadNorm, serpItems) {
  var directory = ['paginegialle','paginebianche','tripadvisor','virgilio','yelp','google','facebook','instagram','tiktok','linkedin','twitter','youtube','wikipedia'];
  var risultato = { posizione_maps_lead: null, competitor: [] };
  try {
    var resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.id'
      },
      body: JSON.stringify({ textQuery: categoria + ' ' + citta, languageCode: 'it', maxResultCount: 15 })
    });
    var data = await resp.json();
    if (!data.places) return risultato;

    // Trova posizione Maps del lead
    for (var i = 0; i < data.places.length; i++) {
      var n = ((data.places[i].displayName && data.places[i].displayName.text)||'').toLowerCase().trim();
      if (n.includes(nomeLeadNorm.slice(0,5)) || (webLeadNorm && (data.places[i].websiteUri||'').toLowerCase().includes(webLeadNorm))) {
        risultato.posizione_maps_lead = i + 1;
        break;
      }
    }

    // Competitor: escludi il lead
    risultato.competitor = data.places
      .filter(function(p) {
        var n = ((p.displayName && p.displayName.text)||'').toLowerCase().trim();
        return n && !n.includes(nomeLeadNorm.slice(0,5)) && !(webLeadNorm && (p.websiteUri||'').toLowerCase().includes(webLeadNorm));
      })
      .slice(0, 3)
      .map(function(p, idx) {
        var sito = p.websiteUri || null;
        var sitoDom = sito ? sito.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;

        // Posizione SERP competitor - solo se non e una directory
        var posizioneSerp = null;
        if (sitoDom && serpItems && serpItems.length && !directory.some(function(d){ return sitoDom.includes(d); })) {
          for (var i = 0; i < serpItems.length; i++) {
            var serpDom = (serpItems[i].domain||'').toLowerCase();
            if (!directory.some(function(d){ return serpDom.includes(d); }) && serpDom.includes(sitoDom)) {
              posizioneSerp = i + 1;
              break;
            }
          }
        }

        return {
          nome: (p.displayName && p.displayName.text) || 'N/D',
          posizione_maps: idx + 1,
          posizione_serp: posizioneSerp,
          rating: p.rating ? p.rating.toFixed(1) : null,
          n_recensioni: p.userRatingCount || 0,
          ha_sito: !!sito,
          sito: sito,
          sito_dom: sitoDom
        };
      });
  } catch(e) {}
  return risultato;
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
    var webNorm = web ? web.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;

    // Tutte le ricerche in parallelo
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta)
    ]);

    var seo = risultati[0];
    var social = risultati[1];
    var serpItems = (seo && seo.items) || [];

    // Competitor con SERP
    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);
    var competitor = mapsData.competitor;
    var posizioneMapLead = mapsData.posizione_maps_lead;

    // Keyword gap: domini competitor che appaiono in SERP ma il lead no
    var keywordGap = [];
    if (serpItems.length && competitor.length) {
      competitor.forEach(function(c) {
        if (c.posizione_serp && c.posizione_serp < 20) {
          keywordGap.push({ competitor: c.nome, posizione: c.posizione_serp, dominio: c.sito_dom });
        }
      });
    }

    // Costruisci HTML
    var secStyle = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var boxStyle = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;margin-bottom:24px';
    var body = '';

    // 1. Posizionamento Google + Maps
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);
    body += '<div style="margin-bottom:28px">';
    body += '<div style="' + secStyle + '">Posizionamento - Keyword: ' + keyword + '</div>';
    body += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">';
    // Box Google
    var gPos = seo && seo.posizione;
    var gColor = gPos ? (gPos <= 10 ? '#2e7d32' : gPos <= 30 ? '#e65100' : '#c62828') : '#c62828';
    var gLabel = gPos ? '#' + gPos : (seo && seo.no_sito ? 'Nessun sito' : 'Non trovato');
    var gDesc = gPos ? (gPos <= 10 ? 'Prima pagina Google' : gPos <= 30 ? 'Pagine 2-3 Google' : 'Oltre pag. 3') : (seo && seo.no_sito ? 'Senza sito non tracciabile' : 'Assente dai primi 100');
    body += '<div style="flex:1;min-width:140px;' + boxStyle + ';text-align:center;margin-bottom:0">';
    body += '<div style="font-size:8.5pt;color:#777;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Google Organico</div>';
    body += '<div style="font-size:2.6rem;font-weight:800;color:' + gColor + ';line-height:1">' + gLabel + '</div>';
    body += '<div style="font-size:8.5pt;color:' + gColor + ';font-weight:600;margin-top:6px">' + gDesc + '</div>';
    if (seo && seo.url) body += '<div style="margin-top:6px;font-size:8pt"><a href="' + seo.url + '" target="_blank" style="color:#1565c0">' + seo.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,40) + '</a></div>';
    body += '</div>';
    // Box Maps
    var mPos = posizioneMapLead;
    var mColor = mPos ? (mPos <= 3 ? '#2e7d32' : mPos <= 7 ? '#e65100' : '#c62828') : '#9e9e9e';
    var mLabel = mPos ? '#' + mPos : 'N/T';
    var mDesc = mPos ? (mPos <= 3 ? 'Top 3 su Maps' : mPos <= 7 ? 'Buona posizione Maps' : 'Bassa visibilita Maps') : 'Non in lista Maps';
    body += '<div style="flex:1;min-width:140px;' + boxStyle + ';text-align:center;margin-bottom:0">';
    body += '<div style="font-size:8.5pt;color:#777;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Google Maps</div>';
    body += '<div style="font-size:2.6rem;font-weight:800;color:' + mColor + ';line-height:1">' + mLabel + '</div>';
    body += '<div style="font-size:8.5pt;color:' + mColor + ';font-weight:600;margin-top:6px">' + mDesc + '</div>';
    body += '</div>';
    body += '</div></div>';

    // 2. Presenza digitale del lead
    body += '<div style="margin-bottom:28px">';
    body += '<div style="' + secStyle + '">Presenza Digitale</div>';
    body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';

    var items = [
      { label: 'Sito Web', val: web ? 'Presente' : 'Assente', ok: !!web, link: web },
      { label: 'Google Maps', val: nRating > 0 ? nRating + ' recensioni' : 'Nessuna recensione', ok: nRating >= 20 },
      { label: 'Rating Google', val: rating ? rating + '/5' : 'N/D', ok: rating >= 4.0 },
      { label: 'Facebook', val: social.facebook ? 'Trovato' : 'Non trovato', ok: !!social.facebook, link: social.facebook },
      { label: 'Instagram', val: social.instagram ? 'Trovato' : 'Non trovato', ok: !!social.instagram, link: social.instagram },
    ];

    items.forEach(function(item) {
      var bg = item.ok ? '#e8f5e9' : '#fce8e8';
      var col = item.ok ? '#2e7d32' : '#c62828';
      body += '<div style="flex:1;min-width:120px;background:' + bg + ';border-radius:8px;padding:12px;text-align:center">';
      body += '<div style="font-size:8.5pt;color:#777;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">' + item.label + '</div>';
      if (item.link) {
        body += '<a href="' + item.link + '" target="_blank" style="font-size:10pt;font-weight:700;color:' + col + ';text-decoration:none">' + item.val + '</a>';
      } else {
        body += '<div style="font-size:10pt;font-weight:700;color:' + col + '">' + item.val + '</div>';
      }
      body += '</div>';
    });
    body += '</div></div>';

    // 3. Competitor analisi
    body += '<div style="margin-bottom:28px">';
    body += '<div style="' + secStyle + '">Competitor di Zona</div>';
    if (competitor && competitor.length) {
      body += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt">';
      body += '<thead><tr style="background:#111;color:white">';
      body += '<th style="padding:10px 12px;text-align:left;font-weight:600">Attivita</th>';
      body += '<th style="padding:10px 12px;text-align:center;font-weight:600">Pos. Maps</th>';
      body += '<th style="padding:10px 12px;text-align:center;font-weight:600">Pos. Google</th>';
      body += '<th style="padding:10px 12px;text-align:center;font-weight:600">Rating</th>';
      body += '<th style="padding:10px 12px;text-align:center;font-weight:600">Recensioni</th>';
      body += '<th style="padding:10px 12px;text-align:center;font-weight:600">Sito</th>';
      body += '</tr></thead><tbody>';
      competitor.forEach(function(c, idx) {
        var bg = idx % 2 === 0 ? 'white' : '#fafafa';
        body += '<tr style="background:' + bg + ';border-bottom:1px solid #f0f0f0">';
        body += '<td style="padding:10px 12px;font-weight:600">' + c.nome + (c.sito_dom ? '<br><span style="font-size:8pt;color:#1565c0;font-weight:400">' + c.sito_dom + '</span>' : '') + '</td>';
        body += '<td style="padding:10px 12px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-weight:700">#' + c.posizione_maps + '</span></td>';
        var serpDisplay = c.posizione_serp ? '<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-weight:700">#' + c.posizione_serp + '</span>' : '<span style="color:#aaa;font-size:8.5pt">Non trovato</span>';
        body += '<td style="padding:10px 12px;text-align:center">' + serpDisplay + '</td>';
        body += '<td style="padding:10px 12px;text-align:center">' + (c.rating ? '<strong>' + c.rating + '</strong>/5' : '<span style="color:#aaa">N/D</span>') + '</td>';
        body += '<td style="padding:10px 12px;text-align:center">' + c.n_recensioni + '</td>';
        body += '<td style="padding:10px 12px;text-align:center">' + (c.ha_sito ? '<span style="color:#2e7d32;font-weight:700">Si</span>' : '<span style="color:#c62828;font-weight:700">No</span>') + '</td>';
        body += '</tr>';
      });
      body += '</tbody></table></div>';

      // Gap analysis vs competitor
      var leadHaSito = !!web;
      var compConSito = competitor.filter(function(c){ return c.ha_sito; }).length;
      var compConSerp = competitor.filter(function(c){ return c.posizione_serp; }).length;
      var compRatings = competitor.filter(function(c){ return c.rating; });
      var compRatingMedio = compRatings.length ? compRatings.reduce(function(a,c){ return a+parseFloat(c.rating); },0)/compRatings.length : 0;
      var compRecMedio = competitor.reduce(function(a,c){ return a+c.n_recensioni; },0)/competitor.length;

      body += '<div style="margin-top:16px;padding:16px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px">';
      body += '<div style="font-size:9.5pt;font-weight:700;color:#795548;margin-bottom:10px">Gap Analysis</div>';

      if (!leadHaSito && compConSito > 0) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#c62828;font-weight:700">!</span> Sito web: ' + compConSito + '/' + competitor.length + ' competitor ce l\'hanno, il lead no</div>';
      } else if (leadHaSito && compConSito === 0) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#2e7d32;font-weight:700">+</span> Sito web: vantaggio - i competitor non hanno sito</div>';
      }

      if (compConSerp > 0 && !(seo && seo.posizione && seo.posizione <= 30)) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#c62828;font-weight:700">!</span> SERP Google: ' + compConSerp + ' competitor trovati in posizione, il lead no</div>';
      }

      if (rating && compRatingMedio > 0) {
        if (rating < compRatingMedio) {
          body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#c62828;font-weight:700">!</span> Rating: lead ' + rating + '/5 vs media competitor ' + compRatingMedio.toFixed(1) + '/5</div>';
        } else {
          body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#2e7d32;font-weight:700">+</span> Rating: lead ' + rating + '/5 superiore alla media competitor ' + compRatingMedio.toFixed(1) + '/5</div>';
        }
      }

      if (nRating < compRecMedio) {
        body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:6px;display:flex;gap:8px"><span style="color:#c62828;font-weight:700">!</span> Recensioni: lead ' + nRating + ' vs media competitor ' + Math.round(compRecMedio) + '</div>';
      }

      body += '</div>';
    } else {
      body += '<div style="' + boxStyle + '"><div style="color:#aaa">Nessun competitor trovato su Google Maps per questa ricerca</div></div>';
    }
    body += '</div>';

    // 4. Profili social dettaglio
    body += '<div style="margin-bottom:28px">';
    body += '<div style="' + secStyle + '">Profili Social Rilevati</div>';
    body += '<div style="' + boxStyle + '">';
    if (!social.facebook && !social.instagram) {
      body += '<div style="color:#c62828;font-weight:600;margin-bottom:6px">Nessun profilo social trovato tramite ricerca Google</div>';
      body += '<div style="font-size:9pt;color:#888">Opportunita: apertura e gestione profili FB+IG da zero</div>';
    } else {
      body += '<div style="font-size:9pt;color:#555;margin-bottom:12px">Profili trovati tramite ricerca Google - verifica manualmente l\'attivita sui profili:</div>';
      if (social.facebook) {
        body += '<div style="margin-bottom:10px"><a href="' + social.facebook + '" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#1877f2;color:white;border-radius:8px;font-size:10pt;font-weight:600;text-decoration:none">Apri profilo Facebook</a>';
        body += '<div style="font-size:8.5pt;color:#aaa;margin-top:4px">' + social.facebook + '</div></div>';
      }
      if (social.instagram) {
        body += '<div style="margin-bottom:10px"><a href="' + social.instagram + '" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#e1306c;color:white;border-radius:8px;font-size:10pt;font-weight:600;text-decoration:none">Apri profilo Instagram</a>';
        body += '<div style="font-size:8.5pt;color:#aaa;margin-top:4px">' + social.instagram + '</div></div>';
      }
    }
    body += '</div></div>';

    // HTML pagina completa
    var oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Analisi Digitale - ' + nome + '</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}' +
      '.page{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}' +
      '.hdr{background:#111;padding:22px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.hdr-l .title{font-size:14pt;font-weight:700;color:white}.hdr-l .sub{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:3px}' +
      '.hdr-r{font-size:8.5pt;color:rgba(255,255,255,0.4);text-align:right}' +
      '.lead-bar{background:#fff;border-left:5px solid #E8001C;padding:14px 22px;margin:20px 30px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}' +
      '.lead-bar .ln{font-size:13pt;font-weight:700;margin-bottom:4px}.lead-bar .ls{font-size:9pt;color:#777;display:flex;gap:16px;flex-wrap:wrap}' +
      '.body{padding:20px 30px 30px}' +
      '.no-print{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}' +
      '.btn-print{padding:8px 18px;background:#E8001C;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}' +
      '.btn-close{padding:8px 18px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}' +
      '@media print{.no-print{display:none}body{background:white}.page{box-shadow:none;border-radius:0;margin:0}}' +
      '</style></head><body>' +
      '<div class="page">' +
      '<div class="hdr"><div class="hdr-l"><div class="title">Analisi Digitale Prevendita</div><div class="sub">Lead Agent - Pagine Si!</div></div>' +
      '<div class="hdr-r">Generata il ' + oggi + '</div></div>' +
      '<div class="lead-bar"><div class="ln">' + nome + '</div>' +
      '<div class="ls">' +
      '<span>' + (lead.indirizzo || '') + '</span>' +
      (web ? '<span>Sito: <a href="' + web + '" target="_blank" style="color:#1565c0">' + web + '</a></span>' : '<span style="color:#c62828">Nessun sito web</span>') +
      '<span>Rating: ' + (rating ? rating + '/5 (' + nRating + ' rec.)' : 'N/D') + '</span>' +
      '<span>Categoria: ' + categoria + ' ' + citta + '</span>' +
      '</div></div>' +
      '<div class="body">' +
      '<div class="no-print">' +
      '<button class="btn-print" onclick="window.print()">Stampa / Salva PDF</button>' +
      '<button class="btn-close" onclick="window.close()">Chiudi</button>' +
      '</div>' +
      body +
      '</div></div></body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('LeadAgent Backend running on port ' + PORT); });
