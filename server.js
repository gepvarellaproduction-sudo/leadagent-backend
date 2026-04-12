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


// Cerca recensioni Google con percentuale risposte via DataForSEO Business Data API
async function cercaRecensioni(placeId, nomeLead) {
  if (!placeId && !nomeLead) return null;
  try {
    // Step 1: crea task
    var payload = [{
      depth: 10,
      sort_by: 'newest',
      location_code: 2380,
      language_code: 'it'
    }];
    if (placeId) {
      payload[0].place_id = placeId;
    } else {
      payload[0].keyword = nomeLead;
    }

    var postResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
      method: 'POST',
      headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var postData = await postResp.json();
    var taskId = postData.tasks && postData.tasks[0] && postData.tasks[0].id;
    if (!taskId) return null;

    // Step 2: poll task_get (max 4 tentativi, ogni 3 secondi)
    var risultati = null;
    for (var attempt = 0; attempt < 4; attempt++) {
      await new Promise(function(r){ setTimeout(r, 3000); });
      var getResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/' + taskId, {
        headers: { 'Authorization': dfsAuth() }
      });
      var getData = await getResp.json();
      var task = getData.tasks && getData.tasks[0];
      if (task && task.status_code === 20000 && task.result) {
        risultati = task.result;
        break;
      }
    }

    if (!risultati || !risultati[0]) return null;

    var result = risultati[0];
    var items = result.items || [];
    var totale = result.reviews_count || items.length;
    var conRisposta = items.filter(function(r){ return !!r.owner_answer; }).length;
    var percRisposta = items.length > 0 ? Math.round((conRisposta / items.length) * 100) : 0;

    // Ultima recensione
    var ultima = items[0] || null;

    return {
      totale_recensioni: totale,
      campione: items.length,
      con_risposta: conRisposta,
      perc_risposta: percRisposta,
      ultima_recensione: ultima ? {
        testo: ultima.review_text || '',
        rating: ultima.rating && ultima.rating.value,
        time_ago: ultima.time_ago || '',
        ha_risposta: !!ultima.owner_answer
      } : null
    };
  } catch(e) {
    return null;
  }
}

// Cerca profili social reali via Google
function estraiFollower(snippet, title) {
  // Cerca pattern tipo: 1.234 follower, 1,2K follower, 1.2K followers, 12K Mi piace
  var testo = (snippet || '') + ' ' + (title || '');
  var pattern = /(\d+[.,]?\d*)\s*[KkMm]?\s*(follower|followers|seguaci|Mi piace|like)/i;
  var match = testo.match(pattern);
  if (match) return match[0].trim();
  // Pattern alternativo: K/M prima della parola
  var pattern2 = /(\d+[.,]?\d*\s*[KkMm])\s+(follower|seguaci)/i;
  var match2 = testo.match(pattern2);
  if (match2) return match2[0].trim();
  return null;
}

async function cercaSocial(nome, citta) {
  var out = { facebook: null, facebook_follower: null, instagram: null, instagram_follower: null };
  try {
    var items = await dfsSearch('"' + nome + '" ' + citta + ' facebook OR instagram', 10);
    items.forEach(function(item) {
      var url = (item.url || '').toLowerCase();
      var dom = (item.domain || '').toLowerCase();
      var snippet = item.description || item.snippet || '';
      var title = item.title || '';
      if (!out.facebook && dom.includes('facebook.com')) {
        var path = url.replace(/https?:\/\/(www\.)?facebook\.com\/?/,'');
        if (path && path.length > 2 && !path.startsWith('search') && !path.startsWith('watch') && !path.startsWith('groups')) {
          out.facebook = item.url;
          out.facebook_follower = estraiFollower(snippet, title);
        }
      }
      if (!out.instagram && dom.includes('instagram.com')) {
        var path2 = url.replace(/https?:\/\/(www\.)?instagram\.com\/?/,'');
        if (path2 && path2.length > 2 && !path2.startsWith('explore') && !path2.startsWith('p/')) {
          out.instagram = item.url;
          out.instagram_follower = estraiFollower(snippet, title);
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

    // Competitor: escludi il lead, mantieni posizione reale nella lista Maps originale
    var competitorList = [];
    for (var ci = 0; ci < data.places.length; ci++) {
      var cp = data.places[ci];
      var cn = ((cp.displayName && cp.displayName.text)||'').toLowerCase().trim();
      var isLead = cn.includes(nomeLeadNorm.slice(0,5)) || (webLeadNorm && (cp.websiteUri||'').toLowerCase().includes(webLeadNorm));
      if (!isLead && cn) {
        var sito = cp.websiteUri || null;
        var sitoDom = sito ? sito.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;
        var posizioneSerp = null;
        if (sitoDom && serpItems && serpItems.length && !directory.some(function(d){ return sitoDom.includes(d); })) {
          for (var si = 0; si < serpItems.length; si++) {
            var serpDom = (serpItems[si].domain||'').toLowerCase();
            if (!directory.some(function(d){ return serpDom.includes(d); }) && serpDom.includes(sitoDom)) {
              posizioneSerp = si + 1;
              break;
            }
          }
        }
        competitorList.push({
          nome: (cp.displayName && cp.displayName.text) || 'N/D',
          posizione_maps: ci + 1,
          posizione_serp: posizioneSerp,
          rating: cp.rating ? cp.rating.toFixed(1) : null,
          n_recensioni: cp.userRatingCount || 0,
          ha_sito: !!sito,
          sito: sito,
          sito_dom: sitoDom
        });
        if (competitorList.length >= 3) break;
      }
    }
    risultato.competitor = competitorList;
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

    // Tutte le ricerche in parallelo (senza recensioni - troppo lente)
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta)
    ]);

    var seo = risultati[0];
    var social = risultati[1];
    var recensioni = null; // caricato in background dalla pagina
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

    // Agente Claude: analisi strategica basata sui dati reali
    var analisiStrategica = '';
    try {
      var datiRaccolti = {
        nome: nome,
        categoria: categoria,
        citta: citta,
        sito: web || 'nessun sito',
        rating: rating || 'N/D',
        n_recensioni: nRating,
        posizione_google: seo && seo.posizione ? '#' + seo.posizione : 'non trovato',
        keyword_google: (seo && seo.keyword) || (categoria + ' ' + citta),
        posizione_maps: posizioneMapLead ? '#' + posizioneMapLead : 'non trovato',
        facebook: social.facebook ? 'presente' + (social.facebook_follower ? ' (' + social.facebook_follower + ')' : '') : 'assente',
        instagram: social.instagram ? 'presente' + (social.instagram_follower ? ' (' + social.instagram_follower + ')' : '') : 'assente',
        competitor: competitor.map(function(c) {
          return c.nome + ' | Maps #' + c.posizione_maps + (c.posizione_serp ? ' | Google #' + c.posizione_serp : ' | Google: non trovato') + ' | Rating: ' + (c.rating || 'N/D') + ' | Sito: ' + (c.ha_sito ? 'si' : 'no');
        }).join(', ')
      };

      var promptStrategia = [
        'Sei un senior digital marketing strategist italiano specializzato in PMI locali.',
        'Analizza questi dati reali di un attivita locale e produci un analisi strategica concreta',
        'con obiettivi tangibili e raggiungibili attraverso i servizi di Pagine Si!.',
        '',
        'DATI REALI RACCOLTI:',
        'Attivita: ' + datiRaccolti.nome + ' (' + datiRaccolti.categoria + ' a ' + datiRaccolti.citta + ')',
        'Sito web: ' + datiRaccolti.sito,
        'Rating Google: ' + datiRaccolti.rating + '/5 con ' + datiRaccolti.n_recensioni + ' recensioni',
        'Posizione Google organico per "' + datiRaccolti.keyword_google + '": ' + datiRaccolti.posizione_google,
        'Posizione Google Maps: ' + datiRaccolti.posizione_maps,
        'Facebook: ' + datiRaccolti.facebook,
        'Instagram: ' + datiRaccolti.instagram,
        'Competitor principali:',
        datiRaccolti.competitor || 'nessuno trovato',
        '',
        'SERVIZI PAGINE SI! DISPONIBILI:',
        '- Sito web professionale (Si!2Site): aumenta visibilita organica Google',
        '- Google Business Profile ottimizzato (GBP): migliora posizione Maps',
        '- Gestione social media FB+IG: post e reels professionali settimanali',
        '- SEO locale: posizionamento nelle prime posizioni Google per keyword locali',
        '- Gestione recensioni (Instatrust): raccolta automatica e gestione reputation',
        '- Google Ads locale: visibilita immediata nelle ricerche a pagamento',
        '',
        'PRODUCI una analisi in italiano con questi 5 punti:',
        '1. SITUAZIONE ATTUALE: 2-3 righe sui gap piu critici basati sui dati reali',
        '2. OBIETTIVI A 90 GIORNI: 3 obiettivi specifici con numeri reali (es: passare da ' + datiRaccolti.posizione_maps + ' a top 3 su Maps, raccogliere 20 nuove recensioni)',
        '3. OBIETTIVI A 6 MESI: 3 obiettivi con proiezioni concrete e numeri',
        '4. STRATEGIA SOCIAL: almeno 2 punti specifici su come usare Reels e contenuti social per questa categoria di business. Includi dati reali di mercato: i Reels ottengono mediamente 3x piu reach dei post statici, le attivita locali con 3+ reels/settimana aumentano le visite in negozio del 25-40%',
        '5. PRIORITA DI INTERVENTO: i 3 servizi Pagine Si! piu urgenti con motivazione basata sui dati raccolti',
        '',
        'Sii specifico e usa i numeri dai dati forniti. Massimo 400 parole. Usa titoli in grassetto con **Titolo**.'
      ].join('\n');


      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [{ role: 'user', content: promptStrategia }]
        })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        var testo = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
        analisiStrategica = '<p style="margin-bottom:10px">' + testo + '</p>';
      }
    } catch(e) {
      analisiStrategica = '<p style="color:#aaa;font-size:9pt">Analisi strategica non disponibile</p>';
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

    // Placeholder recensioni - verranno caricate in background dalla pagina
    body += '<div style="margin-bottom:28px" id="rec-section">';
    body += '<div style="' + secStyle + '">Gestione Recensioni</div>';
    body += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;color:#aaa;font-size:9.5pt" id="rec-loading">';
    body += '<div style="font-size:13pt;margin-bottom:6px">&#8987;</div>Analisi recensioni in corso...</div>';
    body += '</div>';

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
    body += '<div style="' + secStyle + '">Profili Social</div>';
    if (!social.facebook && !social.instagram) {
      body += '<div style="' + boxStyle + ';border-left:4px solid #c62828">';
      body += '<div style="color:#c62828;font-weight:600;margin-bottom:6px">Nessun profilo social trovato tramite ricerca Google</div>';
      body += '<div style="font-size:9pt;color:#888">Opportunita: apertura e gestione profili FB+IG da zero</div>';
      body += '</div>';
    } else {
      body += '<div style="display:flex;gap:14px;flex-wrap:wrap">';
      if (social.facebook) {
        body += '<div style="flex:1;min-width:200px;border:1px solid #1877f2;border-radius:10px;overflow:hidden">';
        body += '<div style="background:#1877f2;padding:10px 16px"><span style="color:white;font-weight:700;font-size:10pt">Facebook</span></div>';
        body += '<div style="padding:14px 16px">';
        if (social.facebook_follower) {
          body += '<div style="font-size:1.4rem;font-weight:800;color:#1877f2;margin-bottom:4px">' + social.facebook_follower + '</div>';
          body += '<div style="font-size:8.5pt;color:#aaa;margin-bottom:10px">da snippet Google</div>';
        } else {
          body += '<div style="font-size:9pt;color:#aaa;margin-bottom:10px">Follower non rilevati da Google</div>';
        }
        body += '<a href="' + social.facebook + '" target="_blank" style="display:inline-block;padding:7px 16px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        body += '</div></div>';
      }
      if (social.instagram) {
        body += '<div style="flex:1;min-width:200px;border:1px solid #e1306c;border-radius:10px;overflow:hidden">';
        body += '<div style="background:#e1306c;padding:10px 16px"><span style="color:white;font-weight:700;font-size:10pt">Instagram</span></div>';
        body += '<div style="padding:14px 16px">';
        if (social.instagram_follower) {
          body += '<div style="font-size:1.4rem;font-weight:800;color:#e1306c;margin-bottom:4px">' + social.instagram_follower + '</div>';
          body += '<div style="font-size:8.5pt;color:#aaa;margin-bottom:10px">da snippet Google</div>';
        } else {
          body += '<div style="font-size:9pt;color:#aaa;margin-bottom:10px">Follower non rilevati da Google</div>';
        }
        body += '<a href="' + social.instagram + '" target="_blank" style="display:inline-block;padding:7px 16px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        body += '</div></div>';
      }
      body += '</div>';
      body += '<div style="font-size:8.5pt;color:#aaa;margin-top:10px">Follower estratti dallo snippet Google quando disponibili - clicca per verifica manuale</div>';
    }
    body += '</div>';

    // Sezione analisi strategica
    var sezioneStrategia = '';
    if (analisiStrategica) {
      sezioneStrategia += '<div style="margin-bottom:28px">';
      sezioneStrategia += '<div style="' + secStyle + '">Analisi Strategica e Obiettivi</div>';
      sezioneStrategia += '<div style="background:#fff;border:1.5px solid #E8001C;border-radius:10px;padding:20px 22px;font-size:9.5pt;color:#1a1a1a;line-height:1.7">';
      sezioneStrategia += analisiStrategica;
      sezioneStrategia += '</div>';
      sezioneStrategia += '<div style="font-size:8pt;color:#aaa;margin-top:8px">Analisi generata da AI sulla base dei dati reali raccolti - Lead Agent by Pagine Si!</div>';
      sezioneStrategia += '</div>';
    }

    // HTML pagina completa
    var oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    var leadJson = JSON.stringify({
      nome: nome, indirizzo: lead.indirizzo || '', web: web || null,
      telefono: lead.telefono || null, tipi: lead.tipi || [],
      rating: rating, nRating: nRating, descrizione: lead.descrizione || null,
      fotoRefs: lead.fotoRefs || [], placeId: lead.placeId || null,
      categoria: categoria, citta: citta
    });

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Analisi - ' + nome + '</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}' +
      '.page{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}' +
      '.hdr{background:#111;padding:22px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.hdr-l .title{font-size:14pt;font-weight:700;color:white}.hdr-l .sub{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:3px}' +
      '.hdr-r{font-size:8.5pt;color:rgba(255,255,255,0.4);text-align:right}' +
      '.lead-bar{background:#fff;border-left:5px solid #E8001C;padding:14px 22px;margin:20px 30px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}' +
      '.lead-bar .ln{font-size:13pt;font-weight:700;margin-bottom:4px}.lead-bar .ls{font-size:9pt;color:#777;display:flex;gap:16px;flex-wrap:wrap}' +
      '.body{padding:20px 30px 30px}' +
      '.no-print{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}' +
      '.btn-a{padding:9px 20px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:opacity 0.2s}' +
      '.btn-a:disabled{opacity:0.5;cursor:not-allowed}' +
      '.btn-red{background:#E8001C;color:white}' +
      '.btn-dark{background:#111;color:white}' +
      '.btn-green{background:#2e7d32;color:white}' +
      '.btn-gray{background:#f5f5f5;color:#555;border:1px solid #ddd}' +
      '#proposta-wrap{margin-top:8px}' +
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
      '<button class="btn-a btn-red" onclick="window.print()">Stampa / Salva PDF</button>' +
      '<button class="btn-a btn-dark" id="btn-proposta" onclick="mostraPannelloProposta()">Genera Proposta</button>' +
      (web ? '<button class="btn-a btn-green" id="btn-anteprima" onclick="generaAnteprima()">Anteprima Sito</button>' : '') +
      '<button class="btn-a btn-gray" onclick="window.close()">Chiudi</button>' +
      '</div>' +
      '<div id="pannello-consulente" style="display:none;background:#fff9e6;border:1px solid #ffe082;border-radius:8px;padding:14px 18px;margin-bottom:16px;display:none">' +
      '<div style="font-size:10pt;font-weight:600;color:#795548;margin-bottom:10px">Inserisci il nome del consulente per la proposta:</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<input id="input-consulente" type="text" placeholder="Nome Cognome" style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:10pt;min-width:200px">' +
      '<button onclick="generaProposta()" style="padding:8px 18px;background:#E8001C;color:white;border:none;border-radius:6px;font-size:10pt;font-weight:600;cursor:pointer">Genera</button>' +
      '<button onclick="chiudiPanCons()" style="padding:8px 14px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:6px;font-size:10pt;cursor:pointer">Annulla</button>' +
      '</div></div>' +
      body +
      sezioneStrategia +
      '<div id="proposta-wrap"></div>' +
      '</div></div>' +
      '<script>' +
      'var BACKEND="https://leadagent-backend.onrender.com";' +
      'var LEAD=' + leadJson + ';' +
      'function chiudiPanCons(){document.getElementById("pannello-consulente").style.display="none";}' +
      'function renderRecensioni(r){' +
      '  var sec=document.getElementById("rec-section");if(!sec)return;' +
      '  if(!r){sec.innerHTML="<div style=\"font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C\">Gestione Recensioni</div><div style=\"background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px;color:#aaa;font-size:9.5pt\">Dati recensioni non disponibili</div>";return;}' +
      '  var pColor=r.perc_risposta>=70?"#2e7d32":r.perc_risposta>=30?"#e65100":"#c62828";' +
      '  var pLabel=r.perc_risposta>=70?"Buona gestione":r.perc_risposta>=30?"Gestione parziale":"Scarsa gestione";' +
      '  var html="<div style=\"font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C\">Gestione Recensioni</div>";' +
      '  html+="<div style=\"display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px\">";' +
      '  html+="<div style=\"flex:1;min-width:100px;background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;text-align:center\"><div style=\"font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px\">Totale</div><div style=\"font-size:2.2rem;font-weight:800\">"+r.totale_recensioni+"</div></div>";' +
      '  html+="<div style=\"flex:1;min-width:100px;background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;text-align:center\"><div style=\"font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px\">% risposte</div><div style=\"font-size:2.2rem;font-weight:800;color:"+pColor+"\">"+r.perc_risposta+"%</div><div style=\"font-size:8.5pt;color:"+pColor+";font-weight:600;margin-top:3px\">"+pLabel+"</div></div>";' +
      '  html+="<div style=\"flex:1;min-width:100px;background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;text-align:center\"><div style=\"font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px\">Su "+r.campione+" analizzate</div><div style=\"font-size:2.2rem;font-weight:800\">"+r.con_risposta+"/"+r.campione+"</div></div>";' +
      '  html+="</div>";' +
      '  if(r.ultima_recensione&&r.ultima_recensione.testo){' +
      '    var ur=r.ultima_recensione;' +
      '    var sColor=ur.rating>=4?"#2e7d32":ur.rating>=3?"#e65100":"#c62828";' +
      '    var stars=["&#9733;&#9733;&#9733;&#9733;&#9733;","&#9733;&#9733;&#9733;&#9733;&#9734;","&#9733;&#9733;&#9733;&#9734;&#9734;","&#9733;&#9733;&#9734;&#9734;&#9734;","&#9733;&#9734;&#9734;&#9734;&#9734;"][Math.max(0,5-(ur.rating||0))];' +
      '    html+="<div style=\"background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 16px\">";' +
      '    html+="<div style=\"font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px\">Ultima recensione"+(ur.time_ago?" ("+ur.time_ago+")":"")+"</div>";' +
      '    html+="<div style=\"font-size:11pt;color:"+sColor+";margin-bottom:5px\">"+stars+"</div>";' +
      '    html+="<div style=\"font-size:9.5pt;color:#555;line-height:1.5;font-style:italic\">&quot;"+ur.testo.slice(0,250).replace(/[<>]/g,"")+(ur.testo.length>250?"...":"")+"&quot;</div>";' +
      '    html+="<div style=\"font-size:8.5pt;margin-top:6px;font-weight:600;color:"+(ur.ha_risposta?"#2e7d32":"#c62828")+"\">"+(ur.ha_risposta?"Il proprietario ha risposto":"Nessuna risposta del proprietario")+"</div>";' +
      '    html+="</div>";' +
      '  }' +
      '  sec.innerHTML=html;' +
      '}' +
      '(async function loadRecensioni(){' +
      '  try{' +
      '    var r=await fetch(BACKEND+"/analisi-recensioni",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({placeId:LEAD.placeId,nome:LEAD.nome})});' +
      '    var d=await r.json();' +
      '    renderRecensioni(d.recensioni);' +
      '  }catch(e){renderRecensioni(null);}' +
      '})();' +
      'function mostraPannelloProposta(){' +
      '  var pan=document.getElementById("pannello-consulente");' +
      '  pan.style.display=pan.style.display==="none"?"block":"none";' +
      '  if(pan.style.display==="block"){document.getElementById("input-consulente").focus();}' +
      '}' +
      'async function generaProposta(){' +
      '  var consulente=document.getElementById("input-consulente").value.trim()||"Consulente Pagine Si!";' +
      '  document.getElementById("pannello-consulente").style.display="none";' +
      '  var btn=document.getElementById("btn-proposta");' +
      '  btn.disabled=true;btn.textContent="Generazione in corso...";' +
      '  try{' +
      '    var r=await fetch(BACKEND+"/proposal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:LEAD,consulente:consulente})});' +
      '    var d=await r.json();' +
      '    if(d.error)throw new Error(d.error);' +
      '    if(d.html){' +
      '      var wrap=document.getElementById("proposta-wrap");' +
      '      wrap.innerHTML="<hr style=\"border:none;border-top:3px solid #E8001C;margin:32px 0 24px\">";' +
      '      var iframe=document.createElement("iframe");' +
      '      iframe.style.cssText="width:100%;border:none;min-height:800px";' +
      '      iframe.srcdoc=d.html;' +
      '      wrap.appendChild(iframe);' +
      '      wrap.scrollIntoView({behavior:"smooth"});' +
      '      btn.textContent="Proposta generata";' +
      '    }' +
      '  }catch(e){console.error("Errore proposta:",e);btn.disabled=false;btn.textContent="Genera Proposta";}' +
      '}' +
      'async function generaAnteprima(){' +
      '  var btn=document.getElementById("btn-anteprima");' +
      '  if(btn){btn.disabled=true;btn.textContent="Generazione...";}' +
      '  try{' +
      '    var r=await fetch(BACKEND+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:LEAD.nome,indirizzo:LEAD.indirizzo,telefono:LEAD.telefono,tipi:LEAD.tipi,rating:LEAD.rating,nRating:LEAD.nRating,descrizione:LEAD.descrizione})});' +
      '    var d=await r.json();' +
      '    if(d.html){var b=new Blob([d.html],{type:"text/html;charset=utf-8"});var u=URL.createObjectURL(b);window.open(u,"_blank");setTimeout(function(){URL.revokeObjectURL(u);},10000);}' +
      '  }catch(e){console.error("Errore anteprima:",e);}' +
      '  if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}' +
      '}' +
      '</script>' +
      '</body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// Endpoint unificato: analisi completa + proposta commerciale
app.post('/analisi-proposta', async function(req, res) {
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
      cercaSocial(nome, citta),
      cercaRecensioni(lead.placeId, nome)
    ]);
    var seo = risultati[0];
    var social = risultati[1];
    var recensioni = risultati[2];
    var serpItems = (seo && seo.items) || [];
    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);
    var competitor = mapsData.competitor;
    var posizioneMapLead = mapsData.posizione_maps_lead;

    // Preventivo personalizzato
    var fatturato = stimaFatturato(lead);
    var analisiDig = analisiDigitale(lead);
    var prodotti = costruisciPreventivo(lead, fatturato, analisiDig);
    if (lead.sigleExtra && lead.sigleExtra.length) {
      var gia = new Set(prodotti.map(function(p){ return p.sigla; }));
      lead.sigleExtra.forEach(function(s) {
        if (!gia.has(s) && PRODOTTI[s]) prodotti.push({ sigla: s, ...PRODOTTI[s], motivazione: 'Aggiunto manualmente', priorita: 10 });
      });
    }

    // Analisi strategica Claude
    var analisiStrategica = '';
    try {
      var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);
      var datiStr = [
        'Attivita: ' + nome + ' (' + categoria + ' a ' + citta + ')',
        'Sito web: ' + (web || 'nessun sito'),
        'Rating: ' + (rating || 'N/D') + '/5 con ' + nRating + ' recensioni',
        'Posizione Google per "' + keyword + '": ' + (seo && seo.posizione ? '#'+seo.posizione : 'non trovato nei primi 100'),
        'Posizione Maps: ' + (posizioneMapLead ? '#'+posizioneMapLead : 'non trovato'),
        'Facebook: ' + (social.facebook ? 'presente' + (social.facebook_follower ? ' ('+social.facebook_follower+')' : '') : 'assente'),
        'Instagram: ' + (social.instagram ? 'presente' + (social.instagram_follower ? ' ('+social.instagram_follower+')' : '') : 'assente'),
        'Competitor: ' + competitor.map(function(c){ return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' rating:'+(c.rating||'N/D'); }).join(', '),
        'Servizi proposti: ' + prodotti.map(function(p){ return p.sigla; }).join(', ')
      ].join('\n');

      var prompt = [
        'Sei un senior digital marketing strategist italiano per PMI locali.',
        'Analizza questi dati e produci una analisi strategica in italiano.',
        '',
        'DATI REALI:',
        datiStr,
        '',
        'SERVIZI PAGINE SI! GIA SELEZIONATI: ' + prodotti.map(function(p){ return p.nome; }).join(', '),
        '',
        'PRODUCI (max 350 parole, titoli con **Titolo**):',
        '1. **Situazione Attuale** - gap critici in 2-3 righe con numeri reali',
        '2. **Obiettivi a 90 Giorni** - 3 obiettivi con numeri specifici basati sui dati',
        '3. **Obiettivi a 6 Mesi** - 3 proiezioni concrete',
        '4. **Strategia Social** - come usare Reels per questa categoria (i Reels ottengono 3x piu reach dei post statici, attivita con 3+ reels/settimana aumentano visite del 25-40%)',
        '5. **Perche questi Servizi** - spiega in 2 righe perche i servizi selezionati risolvono i gap specifici di questa attivita'
      ].join('\n');

      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 700, messages: [{ role: 'user', content: prompt }] })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        analisiStrategica = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
      }
    } catch(e) {}

    // Genera HTML completo: analisi + proposta
    var oggi = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var scadenza = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var totAnno1 = prodotti.reduce(function(s,p){ return s+(p.anno1||0); }, 0);
    var totMens = prodotti.reduce(function(s,p){ return s+(p.mens||0); }, 0);

    var secStyle = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var boxStyle = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:16px 18px;margin-bottom:20px';

    // Sezione posizionamento
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);
    var gPos = seo && seo.posizione;
    var gColor = gPos ? (gPos<=10?'#2e7d32':gPos<=30?'#e65100':'#c62828') : '#c62828';
    var gLabel = gPos ? '#'+gPos : (seo&&seo.no_sito?'No sito':'N/T');
    var mPos = posizioneMapLead;
    var mColor = mPos ? (mPos<=3?'#2e7d32':mPos<=7?'#e65100':'#c62828') : '#9e9e9e';

    var bodyHtml = '';

    // Posizionamento
    bodyHtml += '<div style="margin-bottom:24px">';
    bodyHtml += '<div style="'+secStyle+'">Posizionamento - '+keyword+'</div>';
    bodyHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    bodyHtml += '<div style="flex:1;min-width:120px;'+boxStyle+';text-align:center;margin-bottom:0">';
    bodyHtml += '<div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div>';
    bodyHtml += '<div style="font-size:2.4rem;font-weight:800;color:'+gColor+'">'+gLabel+'</div>';
    bodyHtml += '</div>';
    bodyHtml += '<div style="flex:1;min-width:120px;'+boxStyle+';text-align:center;margin-bottom:0">';
    bodyHtml += '<div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div>';
    bodyHtml += '<div style="font-size:2.4rem;font-weight:800;color:'+mColor+'">'+(mPos?'#'+mPos:'N/T')+'</div>';
    bodyHtml += '</div>';
    bodyHtml += '</div></div>';

    // Competitor
    if (competitor && competitor.length) {
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Competitor di Zona</div>';
      bodyHtml += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9pt">';
      bodyHtml += '<thead><tr style="background:#111;color:white"><th style="padding:8px 10px;text-align:left">Attivita</th><th style="padding:8px 10px;text-align:center">Maps</th><th style="padding:8px 10px;text-align:center">Google</th><th style="padding:8px 10px;text-align:center">Rating</th><th style="padding:8px 10px;text-align:center">Rec.</th><th style="padding:8px 10px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,idx) {
        var bg = idx%2===0?'white':'#fafafa';
        bodyHtml += '<tr style="background:'+bg+';border-bottom:1px solid #f0f0f0">';
        bodyHtml += '<td style="padding:8px 10px;font-weight:600">'+c.nome+'</td>';
        bodyHtml += '<td style="padding:8px 10px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td>';
        bodyHtml += '<td style="padding:8px 10px;text-align:center">'+(c.posizione_serp?'<span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td>';
        bodyHtml += '<td style="padding:8px 10px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>':'N/D')+'</td>';
        bodyHtml += '<td style="padding:8px 10px;text-align:center">'+c.n_recensioni+'</td>';
        bodyHtml += '<td style="padding:8px 10px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td>';
        bodyHtml += '</tr>';
      });
      bodyHtml += '</tbody></table></div></div>';
    }

    // Social
    if (social.facebook || social.instagram) {
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Profili Social</div>';
      bodyHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) {
        bodyHtml += '<div style="flex:1;min-width:160px;border:1px solid #1877f2;border-radius:8px;overflow:hidden">';
        bodyHtml += '<div style="background:#1877f2;padding:8px 14px"><span style="color:white;font-weight:700">Facebook</span></div>';
        bodyHtml += '<div style="padding:12px 14px">';
        if (social.facebook_follower) bodyHtml += '<div style="font-size:1.4rem;font-weight:800;color:#1877f2;margin-bottom:4px">'+social.facebook_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>';
        bodyHtml += '<a href="'+social.facebook+'" target="_blank" style="padding:5px 12px;background:#1877f2;color:white;border-radius:5px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        bodyHtml += '</div></div>';
      }
      if (social.instagram) {
        bodyHtml += '<div style="flex:1;min-width:160px;border:1px solid #e1306c;border-radius:8px;overflow:hidden">';
        bodyHtml += '<div style="background:#e1306c;padding:8px 14px"><span style="color:white;font-weight:700">Instagram</span></div>';
        bodyHtml += '<div style="padding:12px 14px">';
        if (social.instagram_follower) bodyHtml += '<div style="font-size:1.4rem;font-weight:800;color:#e1306c;margin-bottom:4px">'+social.instagram_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>';
        bodyHtml += '<a href="'+social.instagram+'" target="_blank" style="padding:5px 12px;background:#e1306c;color:white;border-radius:5px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        bodyHtml += '</div></div>';
      }
      bodyHtml += '</div></div>';
    }

    // Recensioni in analisi-proposta
    if (recensioni) {
      var percColorP = recensioni.perc_risposta >= 70 ? '#2e7d32' : recensioni.perc_risposta >= 30 ? '#e65100' : '#c62828';
      var percLabelP = recensioni.perc_risposta >= 70 ? 'Buona gestione' : recensioni.perc_risposta >= 30 ? 'Gestione parziale' : 'Scarsa gestione';
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Gestione Recensioni</div>';
      bodyHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">% risposte</div><div style="font-size:2rem;font-weight:800;color:'+percColorP+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+percColorP+';font-weight:600;margin-top:3px">'+percLabelP+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Su '+recensioni.campione+' analizzate</div><div style="font-size:2rem;font-weight:800">'+recensioni.con_risposta+'/'+recensioni.campione+'</div></div>';
      bodyHtml += '</div>';
      if (recensioni.ultima_recensione && recensioni.ultima_recensione.testo) {
        var urP = recensioni.ultima_recensione;
        bodyHtml += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 14px">';
        bodyHtml += '<div style="font-size:8pt;color:#aaa;text-transform:uppercase;margin-bottom:5px">Ultima recensione</div>';
        bodyHtml += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+urP.testo.slice(0,200).replace(/[<>]/g,'')+(urP.testo.length>200?'...':'')+'&quot;</div>';
        bodyHtml += '<div style="font-size:8.5pt;margin-top:5px;font-weight:600;color:'+(urP.ha_risposta?'#2e7d32':'#c62828')+'">'+(urP.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div>';
        bodyHtml += '</div>';
      }
      bodyHtml += '</div>';
    }

    // Recensioni in proposta
    if (recensioni) {
      var percColorP = recensioni.perc_risposta >= 70 ? '#2e7d32' : recensioni.perc_risposta >= 30 ? '#e65100' : '#c62828';
      var percLabelP = recensioni.perc_risposta >= 70 ? 'Buona gestione' : recensioni.perc_risposta >= 30 ? 'Gestione parziale' : 'Scarsa gestione';
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Gestione Recensioni</div>';
      bodyHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">% risposte</div><div style="font-size:2rem;font-weight:800;color:'+percColorP+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+percColorP+';font-weight:600;margin-top:3px">'+percLabelP+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Su '+recensioni.campione+' analizzate</div><div style="font-size:2rem;font-weight:800">'+recensioni.con_risposta+'/'+recensioni.campione+'</div></div>';
      bodyHtml += '</div>';
      if (recensioni.ultima_recensione && recensioni.ultima_recensione.testo) {
        var urP = recensioni.ultima_recensione;
        bodyHtml += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 14px">';
        bodyHtml += '<div style="font-size:8pt;color:#aaa;text-transform:uppercase;margin-bottom:5px">Ultima recensione</div>';
        bodyHtml += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+urP.testo.slice(0,200).replace(/[<>]/g,'')+(urP.testo.length>200?'...':'')+'&quot;</div>';
        bodyHtml += '<div style="font-size:8.5pt;margin-top:5px;font-weight:600;color:'+(urP.ha_risposta?'#2e7d32':'#c62828')+'">'+(urP.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div>';
        bodyHtml += '</div>';
      }
      bodyHtml += '</div>';
    }

    // Recensioni in proposta
    if (recensioni) {
      var percColorP = recensioni.perc_risposta >= 70 ? '#2e7d32' : recensioni.perc_risposta >= 30 ? '#e65100' : '#c62828';
      var percLabelP = recensioni.perc_risposta >= 70 ? 'Buona gestione' : recensioni.perc_risposta >= 30 ? 'Gestione parziale' : 'Scarsa gestione';
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Gestione Recensioni</div>';
      bodyHtml += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px">';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">% risposte</div><div style="font-size:2rem;font-weight:800;color:'+percColorP+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+percColorP+';font-weight:600;margin-top:3px">'+percLabelP+'</div></div>';
      bodyHtml += '<div style="flex:1;min-width:100px;'+boxStyle+';text-align:center;margin-bottom:0"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">Su '+recensioni.campione+' analizzate</div><div style="font-size:2rem;font-weight:800">'+recensioni.con_risposta+'/'+recensioni.campione+'</div></div>';
      bodyHtml += '</div>';
      if (recensioni.ultima_recensione && recensioni.ultima_recensione.testo) {
        var urP = recensioni.ultima_recensione;
        bodyHtml += '<div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px 14px">';
        bodyHtml += '<div style="font-size:8pt;color:#aaa;text-transform:uppercase;margin-bottom:5px">Ultima recensione</div>';
        bodyHtml += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+urP.testo.slice(0,200).replace(/[<>]/g,'')+(urP.testo.length>200?'...':'')+'&quot;</div>';
        bodyHtml += '<div style="font-size:8.5pt;margin-top:5px;font-weight:600;color:'+(urP.ha_risposta?'#2e7d32':'#c62828')+'">'+(urP.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div>';
        bodyHtml += '</div>';
      }
      bodyHtml += '</div>';
    }

    // Analisi strategica
    if (analisiStrategica) {
      bodyHtml += '<div style="margin-bottom:24px">';
      bodyHtml += '<div style="'+secStyle+'">Analisi Strategica e Obiettivi</div>';
      bodyHtml += '<div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7">';
      bodyHtml += '<p style="margin-bottom:10px">'+analisiStrategica+'</p>';
      bodyHtml += '</div></div>';
    }

    // Proposta commerciale
    var righe = prodotti.map(function(p,i) {
      return '<tr class="removable" id="row-'+i+'" data-anno1="'+(p.anno1||0)+'" data-mens="'+(p.mens||0)+'" style="border-bottom:1px solid #f0f0f0">' +
        '<td style="padding:10px 12px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>' +
        '<td style="padding:10px 12px"><div style="font-weight:600;margin-bottom:2px" contenteditable="true">'+p.nome+'</div><div style="font-size:8.5pt;color:#777" contenteditable="true">'+p.desc+'</div><div style="font-size:8pt;color:#aaa;font-style:italic" contenteditable="true">'+p.motivazione+'</div></td>' +
        '<td style="padding:10px 12px;font-size:8.5pt"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px">'+p.cat+'</span></td>' +
        '<td style="padding:10px 12px;text-align:right;font-weight:600;white-space:nowrap">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>' +
        '<td style="padding:10px 12px;text-align:right;font-weight:600;white-space:nowrap">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>' +
        '<td style="text-align:center" class="no-print"><button onclick="rimuoviRiga('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:4px 8px">&#10005;</button></td>' +
        '</tr>';
    }).join('');

    var consulente = req.body.consulente || 'Consulente Pagine Si!';

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Analisi e Proposta - '+nome+'</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}' +
      '.page{max-width:920px;margin:0 auto;background:white}' +
      '.cover{background:#111;color:white;padding:40px 40px 32px;position:relative;overflow:hidden}' +
      '.cover-bg{position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:#E8001C;border-radius:50%;opacity:0.12}' +
      '.cover h1{font-size:24pt;font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin-bottom:8px}' +
      '.cover h1 em{font-style:normal;color:#E8001C}' +
      '.cover-sub{font-size:10pt;color:rgba(255,255,255,0.5)}' +
      '.meta{background:#f9f9f9;border-bottom:1px solid #eee;padding:12px 40px;display:flex;gap:28px;flex-wrap:wrap}' +
      '.meta-i{display:flex;flex-direction:column;gap:2px}' +
      '.meta-l{font-size:8pt;color:#aaa;text-transform:uppercase;letter-spacing:0.06em}' +
      '.meta-v{font-size:9.5pt;font-weight:600}' +
      '.body{padding:30px 40px}' +
      '.divider{border:none;border-top:3px solid #E8001C;margin:28px 0}' +
      '.tot-box{background:#111;color:white;border-radius:8px;padding:18px 22px;margin-bottom:20px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:14px;align-items:center}' +
      '.tot-item{text-align:center}.tot-lbl{font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px}' +
      '.tot-val{font-size:18pt;font-weight:800;color:#E8001C}' +
      '.no-print{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap}' +
      '.btn-print{padding:8px 18px;background:#E8001C;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}' +
      '.btn-close{padding:8px 18px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}' +
      'table{width:100%;border-collapse:collapse}thead tr{background:#111;color:white}thead th{padding:9px 12px;text-align:left;font-size:8.5pt;font-weight:500;letter-spacing:0.03em}' +
      'tbody tr:nth-child(even){background:#fafafa}' +
      '@media print{.no-print{display:none}body{background:white}.page{max-width:100%}}' +
      '</style></head><body>' +
      '<div class="page">' +
      '<div class="cover"><div class="cover-bg"></div>' +
      '<div style="margin-bottom:28px"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0iTGF5ZXJfMSIgeD0iMHB4IiB5PSIwcHgiIHZpZXdCb3g9IjAgMCAxMjAwIDQwMCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTIwMCA0MDA7IiB4bWw6c3BhY2U9InByZXNlcnZlIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgkuc3Qwe2ZpbGw6I0ZGRkZGRjt9CS5zdDF7ZmlsbDp1cmwoI1NWR0lEXzFfKTt9CS5zdDJ7ZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTEzMzE1OTAwMzAyMzgxNTIzMjIwMDAwMDAyOTYwMTM2MjM2ODY4NTIxMzYxXyk7fQkuc3Qze2ZpbGw6dXJsKCNTVkdJRF8wMDAwMDE4MTA0NjQzMDY2MTczNjk2ODAzMDAwMDAwOTY4MjgxNDU1MjM4MDMyNDI4NV8pO30JLnN0NHtmaWxsOnVybCgjU1ZHSURfMDAwMDAxMDgzMTA4NDI2NzQ0Mjk3NTUwODAwMDAwMTM2MzUzMjc5NzUxODMyNTY5ODZfKTt9CS5zdDV7ZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTMzNDk3NzA5MzM3OTM2MTQ4NTkwMDAwMDE2MTg4MzY4ODkzODg4NTYxODM0Xyk7fTwvc3R5bGU+PGc+CTxnPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTE3Ny4zLDI2Ni42Yy0xNi4yLDAtMjkuMi01LjctMzguNC0xNi41bDAuNSw1NS45YzAsMS4zLTEsMi40LTIuMywyLjRoLTM1LjJjLTEuMywwLTIuNC0xLTIuNC0yLjRsMC44LTk2LjYgICBsLTAuOC03Ny41YzAtMS4zLDEtMi40LDIuNC0yLjRoMzVjMS4zLDAsMi40LDEsMi40LDIuNGwtMC44LDEzLjNjOS40LTExLjUsMjIuNy0xOC4zLDM5LjctMTguM2MzOC4xLDAsNTguMiwzMC4zLDU4LjIsNjkuNSAgIEMyMzYuMywyMzUuMywyMTMuOSwyNjYuNiwxNzcuMywyNjYuNnogTTE2Ni4zLDI0MC4yYzE5LjgsMCwzMC0xNC40LDMwLTQxLjhjMC0yOS44LTEwLjItNDQuOS0yOS4yLTQ0LjlzLTI5LjIsMTQuNC0yOS41LDQyLjMgICBDMTM3LjQsMjI0LjMsMTQ3LjUsMjQwLjIsMTY2LjMsMjQwLjJ6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMzQyLjMsMjY0Yy0xLjMsMC0yLjMtMS0yLjMtMi40bDAuNS0xMy4zYy05LjQsMTEuNS0yMi43LDE4LjMtMzkuNywxOC4zYy0zOC4xLDAtNTguMi0zMC4zLTU4LjItNjkuNSAgIGMwLTM4LjksMjIuNS03MC4yLDU5LTcwLjJjMTYuNywwLDI5LjgsNiwzOC45LDE3bC0wLjgtMTJjMC0xLjMsMS0yLjQsMi40LTIuNGgzNWMxLjMsMCwyLjQsMSwyLjQsMi40bC0wLjgsNjVsMC44LDY0LjggICBjMCwxLjMtMSwyLjQtMi40LDIuNEgzNDIuM3ogTTMxMS44LDI0MC41YzE5LjEsMCwyOS4yLTE0LjQsMjkuNS00Mi44YzAuMy0yOC43LTkuOS00NC40LTI4LjctNDQuNmMtMTkuOC0wLjUtMzAsMTQuNC0zMCw0MiAgIEMyODIuNSwyMjUuMywyOTMsMjQwLjgsMzExLjgsMjQwLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDU4LDMxNi4yYy0zNS4yLDAuNS02Mi4xLTEzLjgtNjQuMi00My4zYzAtMS4zLDEtMi40LDIuNC0yLjRoMzMuN2MxLjYsMCwyLjYsMSwyLjksMi40ICAgYzEuOCwxMSwxMC43LDE3LjUsMjYuNiwxNy41YzE3LDAsMjguNy05LjQsMjguNy0zMC41di0xNS40Yy04LjksMTEuNy0yMS45LDE4LjgtMzguNiwxOC44Yy0zOS45LDAtNjAuOC0yOS41LTYwLjgtNjcuNCAgIGMwLTM3LjYsMjIuNS02OC4xLDU5LTY4LjFjMTYuNywwLDI5LjgsNS43LDM4LjksMTYuNWwtMC44LTEyLjNjMC0xLjMsMS0yLjQsMi40LTIuNGgzNC41YzEuMywwLDIuNCwxLDIuNCwyLjRsLTAuNSw2Ni44bDAuMyw2MS42ICAgQzUyNC42LDI5NC4zLDUwMi40LDMxNi4yLDQ1OCwzMTYuMnogTTQ1Ny43LDIzNy42YzE5LjEsMCwyOS4yLTEzLjYsMjkuNS00MC43YzAuMy0yNy45LTkuOS00My4zLTI4LjctNDMuNiAgIGMtMTkuOC0wLjUtMzAsMTQuMS0zMCw0MUM0MjguNSwyMjMuMyw0MzguOSwyMzcuOSw0NTcuNywyMzcuNnoiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik01NDAuNSwxMTYuNWMtMS4zLDAtMi40LTEtMi40LTIuM1Y4My42YzAtMS4zLDEtMi40LDIuNC0yLjRoMzVjMS4zLDAsMi40LDEsMi40LDIuNHYzMC41ICAgYzAsMS4zLTEsMi4zLTIuNCwyLjNINTQwLjV6IE01NDAuNSwyNjRjLTEuMywwLTIuNC0xLTIuNC0yLjRsMC44LTY0LjhsLTAuOC02NWMwLTEuMywxLTIuNCwyLjQtMi40aDM1LjJjMS4zLDAsMi40LDEsMi40LDIuNCAgIGwtMC44LDY1bDAuOCw2NC44YzAsMS4zLTEsMi40LTIuNCwyLjRINTQwLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNTkzLjUsMjY0Yy0xLjMsMC0yLjQtMS0yLjQtMi40bDAuOC02Mi4xbC0wLjMtNjcuNmMwLTEuMywxLTIuNCwyLjQtMi40aDMzLjJjMS4zLDAsMi40LDEsMi40LDIuNGwtMC44LDE0LjYgICBjOS4xLTExLjcsMjQuNS0yMC4xLDQzLjMtMjAuMWMyOC41LDAsNDYuNywxOS4zLDQ2LjcsNTIuMnYyOC4ybDAuOCw1NC44YzAsMS4zLTEsMi40LTIuNCwyLjRoLTM1Yy0xLjMsMC0yLjQtMS0yLjQtMi40bDAuNS01NC44ICAgdi0yNy43YzAtMTQuNi04LjYtMjQtMjAuNC0yNGMtMTQuMSwwLTI5LjIsMTMuMS0yOS4yLDQxLjh2OS45bDAuNSw1NC44YzAsMS4zLTEsMi40LTIuNCwyLjRINTkzLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNODU5LDIxOC42YzEuMywwLDIuNCwxLDIuMSwyLjRjLTMuNCwyNC41LTI2LjksNDYuNS02NC41LDQ2LjVjLTQ0LjksMC02OS4yLTI5LjUtNjkuMi03MC4yICAgYzAtNDIuOCwyNS42LTcxLDY4LjQtNzFjNDQuMSwwLDY4LjcsMjkuMiw2OS41LDc2LjJjMCwxLjMtMSwyLjQtMi4zLDIuNGgtOTYuMWMxLjYsMjUuMywxMS41LDM2LjYsMzAuMywzNi42ICAgYzEzLjEsMCwyMi41LTYsMjYuMS0yMC40YzAuMy0xLjMsMS42LTIuNCwyLjktMi40SDg1OXogTTc5Ni4xLDE1MmMtMTUuNywwLTI1LjEsOS40LTI4LjIsMjcuOUg4MjMgICBDODIxLjQsMTY1LjYsODEzLjMsMTUyLDc5Ni4xLDE1MnoiPjwvcGF0aD4JCTwvZz48L2c+PC9zdmc+" alt="Pagine Si!" style="height:36px;width:auto" /></div>' +
      '<h1>Analisi e Proposta<br><em>Commerciale</em></h1>' +
      '<p class="cover-sub">Comunicazione e Marketing Digitale su misura</p>' +
      '</div>' +
      '<div class="meta">' +
      '<div class="meta-i"><span class="meta-l">Preparata per</span><span class="meta-v">'+nome+'</span></div>' +
      '<div class="meta-i"><span class="meta-l">Data</span><span class="meta-v">'+oggi+'</span></div>' +
      '<div class="meta-i"><span class="meta-l">Consulente</span><span class="meta-v">'+consulente+'</span></div>' +
      '<div class="meta-i"><span class="meta-l">Valida fino al</span><span class="meta-v">'+scadenza+'</span></div>' +
      '</div>' +
      '<div class="body">' +
      '<div class="no-print">' +
      '<button class="btn-print" onclick="window.print()">Stampa / Salva PDF</button>' +
      '<button class="btn-close" onclick="window.close()">Chiudi</button>' +
      '</div>' +
      '<div style="font-size:9.5pt;background:#fff9e6;border:1px solid #ffe082;border-radius:8px;padding:10px 16px;margin-bottom:20px;color:#795548" class="no-print">&#9999;&#65039; <strong>Proposta modificabile</strong> &mdash; clicca sui testi per modificarli, clicca &#10005; per rimuovere righe</div>' +
      bodyHtml +
      '<hr class="divider">' +
      '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #E8001C">Soluzione Proposta</div>' +
      '<table id="tabella-prodotti">' +
      '<thead><tr><th>Sigla</th><th>Prodotto e motivazione</th><th>Area</th><th style="text-align:right">Anno 1</th><th style="text-align:right">Mensile</th><th class="no-print" style="width:30px"></th></tr></thead>' +
      '<tbody>'+righe+'</tbody>' +
      '<tfoot class="no-print"><tr><td colspan="6" style="padding:10px 12px;border-top:2px dashed #f0f0f0;background:#fafafa">' +
      '<button onclick="apriPannello()" style="padding:6px 14px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">&#65291; Aggiungi servizio dal listino</button>' +
      '</td></tr></tfoot></table>' +
      '<div class="tot-box">' +
      '<div class="tot-item"><div class="tot-lbl">Investimento Anno 1</div><div class="tot-val" id="tot-anno1">&euro; '+totAnno1.toLocaleString('it-IT')+'</div><div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>' +
      '<div style="width:1px;background:rgba(255,255,255,0.1);height:40px"></div>' +
      '<div class="tot-item"><div class="tot-lbl">Canone Mensile</div><div class="tot-val" id="tot-mens">&euro; '+totMens+'<span style="font-size:11pt;color:rgba(255,255,255,0.4)">/mese</span></div></div>' +
      '<div style="width:1px;background:rgba(255,255,255,0.1);height:40px"></div>' +
      '<div class="tot-item"><div class="tot-lbl">Soluzioni incluse</div><div class="tot-val" id="tot-num">'+prodotti.length+'</div></div>' +
      '</div>' +
      '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:8.5pt;color:#bbb;flex-wrap:wrap;gap:10px">' +
      '<div><strong style="color:#E8001C">Pagine Si! SpA</strong> &middot; P.zza San Giovanni Decollato 1, 05100 Terni &middot; paginesispa.it</div>' +
      '<div>Prezzi al netto di IVA &middot; Proposta valida 30 giorni</div>' +
      '</div>' +
      '</div></div>' +
      '<script>' +
      'var LISTINO=' + JSON.stringify(PRODOTTI) + ';' +
      'function rimuoviRiga(i){var r=document.getElementById("row-"+i);if(r){r.remove();aggiornaT();}}' +
      'function aggiornaT(){var a=0,m=0,n=0;document.querySelectorAll("#tabella-prodotti tbody tr").forEach(function(t){a+=parseFloat(t.dataset.anno1||0);m+=parseFloat(t.dataset.mens||0);n++;});' +
      'document.getElementById("tot-anno1").innerHTML="&euro; "+a.toLocaleString("it-IT");' +
      'document.getElementById("tot-mens").innerHTML="&euro; "+m+"/mese";' +
      'document.getElementById("tot-num").textContent=n;}' +
      'var _sel=null;' +
      'function apriPannello(){' +
      'var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM"],"Directory PagineSi.it":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social Media":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Marketing Automation":["Si4BLD","Si4BEN"]};' +
      'var h="";for(var cat in cats){h+="<div style=\"margin-bottom:14px\"><div style=\"font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px\">"+cat+"</div><div style=\"display:flex;flex-wrap:wrap;gap:4px\">";' +
      'cats[cat].forEach(function(s){var p=LISTINO[s];if(!p)return;var pr=p.mens?"\u20ac"+p.mens+"/mese":(p.anno1?"\u20ac"+p.anno1+"/anno":"");' +
      'var btn=document.createElement("button");btn.id="chip-"+s;btn.dataset.sigla=s;btn.onclick=function(){selSigla(this,this.dataset.sigla);};btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";btn.innerHTML="<b style=\"font-family:monospace;color:#E8001C\">"+s+"</b> "+p.nome+" <span style=\"opacity:0.5;font-size:9px\">"+pr+"</span>";h+=btn.outerHTML;' +
      '});h+="</div></div>";}' +
      'document.getElementById("pan-body").innerHTML=h;document.getElementById("pannello").style.display="flex";}' +
      'function selSigla(el,s){document.querySelectorAll("[id^=chip-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_sel=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";document.getElementById("btn-ok").disabled=false;}' +
      'function aggiungiS(){if(!_sel)return;var p=LISTINO[_sel];if(!p)return;' +
      'var tb=document.querySelector("#tabella-prodotti tbody");var id="e"+Date.now();var tr=document.createElement("tr");' +
      'tr.id="row-"+id;tr.dataset.anno1=p.anno1||0;tr.dataset.mens=p.mens||0;tr.style.borderBottom="1px solid #f0f0f0";' +
      'tr.innerHTML="<td style=\"padding:10px 12px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600\">"+_sel+"</td>' +
      '<td style=\"padding:10px 12px\"><div contenteditable=\"true\" style=\"font-weight:600;margin-bottom:2px\">"+p.nome+"</div><div contenteditable=\"true\" style=\"font-size:8.5pt;color:#777\">"+p.desc+"</div></td>' +
      '<td style=\"padding:10px 12px;font-size:8.5pt\"><span style=\"background:#f5f5f5;padding:2px 8px;border-radius:4px\">"+p.cat+"</span></td>' +
      '<td style=\"padding:10px 12px;text-align:right;font-weight:600\">"+(p.anno1?"\u20ac "+p.anno1.toLocaleString("it-IT"):"\u2014")+"</td>' +
      '<td style=\"padding:10px 12px;text-align:right;font-weight:600\">"+(p.mens?"\u20ac "+p.mens+"/mese":"\u2014")+"</td>' +
      '<td style=\"text-align:center\" class=\"no-print\"><button onclick=\"this.closest(String.fromCharCode(39)+\'tr\'+String.fromCharCode(39)).remove();aggiornaT()\" style=\"background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:4px 8px\">&#10005;</button></td>";' +
      'tb.appendChild(tr);aggiornaT();chiudiPan();_sel=null;}' +
      'function chiudiPan(){document.getElementById("pannello").style.display="none";}' +
      '</script>' +
      '</body></html>';
    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});



// Endpoint separato per recensioni - chiamato in background dalla pagina
app.post('/analisi-recensioni', async function(req, res) {
  try {
    var placeId = req.body.placeId || null;
    var nome = req.body.nome || '';
    var rec = await cercaRecensioni(placeId, nome);
    res.json({ recensioni: rec });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('LeadAgent Backend running on port ' + PORT); });
