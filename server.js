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
    html = html.trim().replace(/^```html?\n?/, '').replace(/\n?```$/, '');
    res.json({ html: html });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

//  ANALISI ENDPOINT 
async function cercaPosizioneGoogle(nome, web, categoria, citta) {
  var keyword = categoria + ' ' + citta;
  var dir = ['paginegialle','paginebianche','tripadvisor','virgilio','yelp','google','facebook','instagram','tiktok','linkedin','twitter','youtube','wikipedia'];
  try {
    var items = await dfsSearch(keyword, 100);
    if (!web) return { posizione: null, keyword: keyword, no_sito: true, items: items };
    var webNorm = web.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    for (var i = 0; i < items.length; i++) {
      var dom = (items[i].domain || '').toLowerCase();
      if (dir.some(function(d){ return dom.includes(d); })) continue;
      if (dom.includes(webNorm)) return { posizione: i+1, url: items[i].url, keyword: keyword, items: items };
    }
    return { posizione: null, keyword: keyword, non_trovato: true, items: items };
  } catch(e) { return { posizione: null, keyword: keyword, items: [] }; }
}

function estraiFollower(snippet, title) {
  var testo = (snippet||'') + ' ' + (title||'');
  var m = testo.match(/(\d+[.,]?\d*\s*[KkMm]?)\s*(follower|followers|seguaci|Mi piace)/i);
  return m ? m[0].trim() : null;
}

function trovaSocial(items, tipo) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var url = (item.url || '').toLowerCase();
    var dom = (item.domain || '').toLowerCase();
    if (!dom.includes(tipo + '.com')) continue;
    var path = url.replace(new RegExp('https?://(www\\.)?' + tipo + '\\.com/?'), '');
    var skip = tipo === 'facebook' ? ['search','watch','groups','login','pages/search','sharer'] : ['explore','p/','reel/','accounts'];
    if (!path || path.length < 3 || skip.some(function(s){ return path.startsWith(s); })) continue;
    return { url: item.url, follower: estraiFollower(item.description||'', item.title||'') };
  }
  return null;
}

async function cercaSocial(nome, citta) {
  var out = { facebook: null, facebook_follower: null, instagram: null, instagram_follower: null };
  try {
    // Ricerca combinata
    var items1 = await dfsSearch('"' + nome + '" ' + citta + ' facebook OR instagram', 10);
    // Ricerca specifica Instagram se non trovato
    var items2 = await dfsSearch(nome + ' instagram ' + citta, 5);
    var allItems = items1.concat(items2);

    var fb = trovaSocial(allItems, 'facebook');
    if (fb) { out.facebook = fb.url; out.facebook_follower = fb.follower; }

    var ig = trovaSocial(allItems, 'instagram');
    if (ig) { out.instagram = ig.url; out.instagram_follower = ig.follower; }

    // Se Instagram ancora non trovato, cerca piu aggressivamente
    if (!out.instagram) {
      var items3 = await dfsSearch(nome + ' instagram', 5);
      var ig2 = trovaSocial(items3, 'instagram');
      if (ig2) { out.instagram = ig2.url; out.instagram_follower = ig2.follower; }
    }
  } catch(e) {}
  return out;
}

async function cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems) {
  var dir = ['paginegialle','paginebianche','tripadvisor','virgilio','yelp','google','facebook','instagram','tiktok'];
  var out = { posizione_maps_lead: null, competitor: [] };
  try {
    var resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.websiteUri,places.id' },
      body: JSON.stringify({ textQuery: categoria + ' ' + citta, languageCode: 'it', maxResultCount: 15 })
    });
    var data = await resp.json();
    if (!data.places) return out;
    // Posizione Maps del lead
    for (var i = 0; i < data.places.length; i++) {
      var n = ((data.places[i].displayName && data.places[i].displayName.text)||'').toLowerCase();
      if (n.includes(nomeNorm.slice(0,5)) || (webNorm && (data.places[i].websiteUri||'').toLowerCase().includes(webNorm))) {
        out.posizione_maps_lead = i + 1; break;
      }
    }
    // Competitor
    var count = 0;
    for (var ci = 0; ci < data.places.length && count < 3; ci++) {
      var cp = data.places[ci];
      var cn = ((cp.displayName && cp.displayName.text)||'').toLowerCase();
      var isLead = cn.includes(nomeNorm.slice(0,5)) || (webNorm && (cp.websiteUri||'').toLowerCase().includes(webNorm));
      if (isLead || !cn) continue;
      var sito = cp.websiteUri || null;
      var sitoDom = sito ? sito.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;
      var posizioneSerp = null;
      if (sitoDom && serpItems && serpItems.length && !dir.some(function(d){ return sitoDom.includes(d); })) {
        for (var si = 0; si < serpItems.length; si++) {
          var sd = (serpItems[si].domain||'').toLowerCase();
          if (!dir.some(function(d){ return sd.includes(d); }) && sd.includes(sitoDom)) { posizioneSerp = si+1; break; }
        }
      }
      // Recensioni competitor (Google Places, 5 rec, sincrono)
      var recComp = await cercaRecensioniComp(cp.id);
      out.competitor.push({
        nome: (cp.displayName && cp.displayName.text) || 'N/D',
        posizione_maps: ci + 1,
        posizione_serp: posizioneSerp,
        rating: cp.rating ? cp.rating.toFixed(1) : null,
        n_recensioni: cp.userRatingCount || 0,
        ha_sito: !!sito,
        sito_dom: sitoDom,
        rec_comp: recComp
      });
      count++;
    }
  } catch(e) {}
  return out;
}

// Avvia task DataForSEO recensioni (async) - restituisce taskId subito
async function avviaTaskRecensioni(placeId, nome) {
  if (!placeId && !nome) return null;
  try {
    var payload = [{ depth: 50, sort_by: 'newest', location_code: 2380, language_code: 'it' }];
    if (placeId) { payload[0].place_id = placeId; } else { payload[0].keyword = nome; }
    var resp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
      method: 'POST',
      headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await resp.json();
    return (data.tasks && data.tasks[0] && data.tasks[0].id) || null;
  } catch(e) { return null; }
}

// Raccogli risultati task recensioni
async function raccogliRecensioni(taskId, totaleRecensioni) {
  if (!taskId) return null;
  try {
    for (var i = 0; i < 10; i++) {
      await new Promise(function(r){ setTimeout(r, 2000); });
      var resp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/' + taskId, {
        headers: { 'Authorization': dfsAuth() }
      });
      var data = await resp.json();
      var task = data.tasks && data.tasks[0];
      if (task && task.status_code === 20000 && task.result && task.result[0]) {
        var result = task.result[0];
        var items = result.items || [];
        var totale = totaleRecensioni || result.reviews_count || items.length;
        var risposte = items.filter(function(r){ return !!r.owner_answer; }).length;
        var campione = items.length;
        var perc = campione > 0 ? Math.round((risposte/campione)*100) : 0;
        var pos = items.filter(function(r){ return r.rating && r.rating.value >= 4; }).length;
        var neg = items.filter(function(r){ return r.rating && r.rating.value <= 2; }).length;
        var ultima = items[0];
        return {
          totale_recensioni: totale,
          campione: campione,
          con_risposta: risposte,
          perc_risposta: perc,
          positive: pos,
          negative: neg,
          testi: items.slice(0,20).map(function(r){ return { rating: r.rating&&r.rating.value, testo: r.review_text||'', ha_risposta: !!r.owner_answer, time_ago: r.time_ago||'' }; }),
          ultima: ultima ? { rating: ultima.rating&&ultima.rating.value, testo: ultima.review_text||'', ha_risposta: !!ultima.owner_answer, time_ago: ultima.time_ago||'' } : null
        };
      }
    }
  } catch(e) {}
  return null;
}

// Recensioni rapide per competitor (Google Places, 5 rec, sincrono)
async function cercaRecensioniComp(placeId) {
  if (!placeId) return null;
  try {
    var resp = await fetch('https://places.googleapis.com/v1/places/' + placeId, {
      headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'reviews' }
    });
    var data = await resp.json();
    if (!data.reviews || !data.reviews.length) return null;
    var reviews = data.reviews;
    var risposte = reviews.filter(function(r){ return !!(r.reviewReply && r.reviewReply.text); }).length;
    return { campione: reviews.length, risposte: risposte, perc: Math.round((risposte/reviews.length)*100) };
  } catch(e) { return null; }
}

async function analisiClaude(lead, seo, social, recensioni, competitor) {
  try {
    var keyword = (seo && seo.keyword) || (lead.categoria + ' ' + lead.citta);
    var recTesti = recensioni && recensioni.testi ? recensioni.testi.map(function(r){ return (r.rating||'?') + '/5: ' + r.testo.slice(0,100); }).join(' | ') : 'nessuna';
    var dati = [
      'Attivita: ' + lead.nome + ' (' + lead.categoria + ' a ' + lead.citta + ')',
      'Sito: ' + (lead.web || 'nessun sito'),
      'Rating: ' + (lead.rating||'N/D') + '/5 con ' + (lead.nRating||0) + ' recensioni',
      'Posizione Google per "' + keyword + '": ' + (seo && seo.posizione ? '#'+seo.posizione : 'non trovato'),
      'Posizione Maps: ' + (lead._mapsPos ? '#'+lead._mapsPos : 'non trovato'),
      'Facebook: ' + (social.facebook ? 'presente' + (social.facebook_follower ? ' ('+social.facebook_follower+')' : '') : 'assente'),
      'Instagram: ' + (social.instagram ? 'presente' + (social.instagram_follower ? ' ('+social.instagram_follower+')' : '') : 'assente'),
      'Gestione recensioni: ' + (recensioni ? recensioni.perc_risposta + '% di risposte su ' + recensioni.campione + ' analizzate, ' + recensioni.positive + ' positive, ' + recensioni.negative + ' negative' : 'dati non disponibili'),
      'Ultime recensioni: ' + recTesti,
      'Competitor principali: ' + competitor.map(function(c){ return c.nome + ' Maps#' + c.posizione_maps + (c.posizione_serp ? '/Google#'+c.posizione_serp : '') + ' rating:' + (c.rating||'N/D'); }).join(', ')
    ].join('\n');

    var prompt = [
      'Sei un senior digital marketing strategist italiano specializzato in PMI locali.',
      'Analizza questi dati reali e produci una analisi strategica concreta.',
      '',
      'DATI REALI:',
      dati,
      '',
      'PRODUCI (max 400 parole, usa **Titolo** per i titoli in grassetto):',
      '**Situazione Attuale** - descrivi i 2-3 gap critici piu urgenti con numeri reali',
      '**Analisi Recensioni** - punti di forza, punti deboli e criticita emergenti dalle recensioni reali',
      '**Obiettivi a 90 Giorni** - 3 obiettivi specifici con numeri (es: da #'+((seo&&seo.posizione)||'N/T')+' a top 10 Google)',
      '**Obiettivi a 6 Mesi** - 3 proiezioni concrete',
      '**Strategia Social** - come usare Reels per questa categoria specifica (i Reels ottengono 3x piu reach dei post, attivita con 3+ reels/settimana aumentano visite del 25-40%)',
      '**Priorita di Intervento** - i 3 servizi Pagine Si! piu urgenti con motivazione basata sui dati'
    ].join('\n');

    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });
    var aiData = await resp.json();
    if (aiData.content && aiData.content[0] && aiData.content[0].text) {
      return aiData.content[0].text
        .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
        .split('\n\n').join('</p><p style="margin-bottom:10px">')
        .split('\n').join('<br>');
    }
  } catch(e) {}
  return null;
}

function calcolaVisibilitaAI(web, social, nRating, rating, seo, competitor) {
  var score = 0;
  var dettagli = [];
  // Google Maps (max 25)
  if (nRating >= 100) { score += 25; dettagli.push('Google Maps: ottimo (' + nRating + ' recensioni)'); }
  else if (nRating >= 30) { score += 15; dettagli.push('Google Maps: buono (' + nRating + ' recensioni)'); }
  else if (nRating > 0) { score += 8; dettagli.push('Google Maps: debole (' + nRating + ' recensioni)'); }
  else { dettagli.push('Google Maps: assente'); }
  // Rating (max 15)
  if (rating >= 4.5) { score += 15; }
  else if (rating >= 4.0) { score += 10; }
  else if (rating >= 3.5) { score += 5; }
  // Sito web (max 20)
  if (web) {
    if (seo && seo.posizione && seo.posizione <= 10) { score += 20; dettagli.push('Sito web: prima pagina Google'); }
    else if (seo && seo.posizione && seo.posizione <= 30) { score += 12; dettagli.push('Sito web: pagine 2-3 Google'); }
    else { score += 6; dettagli.push('Sito web: presente ma non indicizzato'); }
  } else { dettagli.push('Sito web: assente'); }
  // Social (max 20)
  if (social.facebook && social.instagram) { score += 20; dettagli.push('Social: FB + IG presenti'); }
  else if (social.facebook || social.instagram) { score += 10; dettagli.push('Social: un profilo presente'); }
  else { dettagli.push('Social: assenti'); }
  // TripAdvisor/directory (max 10)
  if (competitor && competitor.some) { score += 5; } // presenza indiretta
  // Articoli/menzioni (max 10) - stima
  if (score >= 40) { score += 5; } // attivita con buona base tendono ad avere menzioni
  score = Math.min(score, 100);
  var livello = score >= 70 ? 'ALTA' : score >= 40 ? 'MEDIA' : 'BASSA';
  var colore = score >= 70 ? '#2e7d32' : score >= 40 ? '#e65100' : '#c62828';
  return { score: score, livello: livello, colore: colore, dettagli: dettagli };
}

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

    // Avvia task recensioni SUBITO (async, non blocca)
    var recTaskId = await avviaTaskRecensioni(lead.placeId, nome);

    // Tutte le altre ricerche in parallelo
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta)
    ]);
    var seo = risultati[0];
    var social = risultati[1];
    var serpItems = (seo && seo.items) || [];

    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);

    // Ora raccoglie recensioni (il task e' stato avviato ~20s fa, probabilmente gia pronto)
    var recensioni = await raccogliRecensioni(recTaskId, nRating);
    var competitor = mapsData.competitor;
    lead._mapsPos = mapsData.posizione_maps_lead;

    // Visibilita AI
    var ai = calcolaVisibilitaAI(web, social, nRating, rating, seo, competitor);

    // Analisi Claude: generata in background dalla pagina via /analisi-strategica
    var strategia = null;

    //  Build HTML 
    var oggi = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var sec = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var box = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 18px;margin-bottom:8px';
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);

    var body = '';

    // 1. POSIZIONAMENTO
    var gPos = seo && seo.posizione;
    var gColor = gPos ? (gPos<=10?'#2e7d32':gPos<=30?'#e65100':'#c62828') : '#c62828';
    var gLabel = gPos ? '#'+gPos : (seo&&seo.no_sito?'Nessun sito':'N/T');
    var gDesc = gPos ? (gPos<=10?'Prima pagina Google':gPos<=30?'Pagine 2-3':'Oltre pag. 3') : (seo&&seo.no_sito?'Senza sito':'Non nei primi 100');
    var mPos = mapsData.posizione_maps_lead;
    var mColor = mPos ? (mPos<=3?'#2e7d32':mPos<=7?'#e65100':'#c62828') : '#9e9e9e';

    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Posizionamento - '+keyword+'</div>';
    body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div><div style="font-size:2.6rem;font-weight:800;color:'+gColor+'">'+gLabel+'</div><div style="font-size:8.5pt;color:'+gColor+';font-weight:600;margin-top:4px">'+gDesc+'</div>'+(seo&&seo.url?'<div style="font-size:8pt;margin-top:5px"><a href="'+seo.url+'" target="_blank" style="color:#1565c0">'+seo.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,35)+'</a></div>':'')+'</div>';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div><div style="font-size:2.6rem;font-weight:800;color:'+mColor+'">'+(mPos?'#'+mPos:'N/T')+'</div><div style="font-size:8.5pt;color:'+mColor+';font-weight:600;margin-top:4px">'+(mPos?(mPos<=3?'Top 3 su Maps':mPos<=7?'Buona posizione':'Bassa visibilita'):'Non in lista')+'</div></div>';
    body += '</div></div>';

    // 2. PRESENZA DIGITALE
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Presenza Digitale</div>';
    body += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    var ind = [
      { label:'Sito Web', val: web?'Presente':'Assente', ok: !!web, link: web },
      { label:'Google Maps', val: nRating>0?nRating+' rec.':'Assente', ok: nRating>=20 },
      { label:'Rating', val: rating?rating+'/5':'N/D', ok: rating>=4.0 },
      { label:'Facebook', val: social.facebook?(social.facebook_follower||'Trovato'):'Assente', ok: !!social.facebook, link: social.facebook },
      { label:'Instagram', val: social.instagram?(social.instagram_follower||'Trovato'):'Assente', ok: !!social.instagram, link: social.instagram }
    ];
    ind.forEach(function(item){
      var bg = item.ok ? '#e8f5e9' : '#fce8e8';
      var col = item.ok ? '#2e7d32' : '#c62828';
      body += '<div style="flex:1;min-width:100px;background:'+bg+';border-radius:8px;padding:12px;text-align:center">';
      body += '<div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">'+item.label+'</div>';
      if (item.link) body += '<a href="'+item.link+'" target="_blank" style="font-size:9.5pt;font-weight:700;color:'+col+';text-decoration:none">'+item.val+'</a>';
      else body += '<div style="font-size:9.5pt;font-weight:700;color:'+col+'">'+item.val+'</div>';
      body += '</div>';
    });
    body += '</div></div>';

    // 3. GESTIONE RECENSIONI
    if (recensioni) {
      var pColor = recensioni.perc_risposta>=70?'#2e7d32':recensioni.perc_risposta>=30?'#e65100':'#c62828';
      var pLabel = recensioni.perc_risposta>=70?'Buona gestione':recensioni.perc_risposta>=30?'Gestione parziale':'Scarsa gestione';
      var stars5 = ['&#9733;&#9733;&#9733;&#9733;&#9733;','&#9733;&#9733;&#9733;&#9733;&#9734;','&#9733;&#9733;&#9733;&#9734;&#9734;','&#9733;&#9733;&#9734;&#9734;&#9734;','&#9733;&#9734;&#9734;&#9734;&#9734;'];
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Gestione Recensioni</div>';
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">% Risposte</div><div style="font-size:2rem;font-weight:800;color:'+pColor+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+pColor+';font-weight:600;margin-top:3px">'+pLabel+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Positive/Negative</div><div style="font-size:1.4rem;font-weight:800"><span style="color:#2e7d32">'+recensioni.positive+'</span> / <span style="color:#c62828">'+recensioni.negative+'</span></div></div>';
      body += '</div>';
      if (recensioni.ultima) {
        var ur = recensioni.ultima;
        var sColor = ur.rating>=4?'#2e7d32':ur.rating>=3?'#e65100':'#c62828';
        var starsHtml = ur.rating ? stars5[Math.max(0,5-Math.round(ur.rating))] : '';
        body += '<div style="'+box+'"><div style="font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px">Ultima recensione'+(ur.time_ago?' ('+ur.time_ago+')':'')+'</div>';
        if (starsHtml) body += '<div style="font-size:10pt;color:'+sColor+';margin-bottom:5px">'+starsHtml+'</div>';
        if (ur.testo) body += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+ur.testo.slice(0,280).replace(/[<>]/g,'')+(ur.testo.length>280?'...':'')+'&quot;</div>';
        body += '<div style="font-size:8.5pt;margin-top:6px;font-weight:600;color:'+(ur.ha_risposta?'#2e7d32':'#c62828')+'">'+(ur.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div>';
        body += '</div>';
      }
      body += '</div>';
    }

    // 4. COMPETITOR
    if (competitor && competitor.length) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Competitor di Zona</div>';
      body += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt">';
      body += '<thead><tr style="background:#111;color:white"><th style="padding:9px 11px;text-align:left">Attivita</th><th style="padding:9px 11px;text-align:center">Maps</th><th style="padding:9px 11px;text-align:center">Google</th><th style="padding:9px 11px;text-align:center">Rating</th><th style="padding:9px 11px;text-align:center">Rec.</th><th style="padding:9px 11px;text-align:center">% Risposte</th><th style="padding:9px 11px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,idx){
        var bg = idx%2===0?'white':'#fafafa';
        var mCls = 'background:#e8f5e9;color:#2e7d32';
        var sCls = c.posizione_serp ? (c.posizione_serp<=10?'background:#e8f5e9;color:#2e7d32':'background:#fff8e1;color:#e65100') : '';
        body += '<tr style="background:'+bg+';border-bottom:1px solid #f0f0f0">';
        body += '<td style="padding:9px 11px;font-weight:600">'+c.nome+(c.sito_dom?'<br><span style="font-size:8pt;color:#1565c0;font-weight:400">'+c.sito_dom+'</span>':'')+'</td>';
        body += '<td style="padding:9px 11px;text-align:center"><span style="'+mCls+';padding:2px 8px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td>';
        body += '<td style="padding:9px 11px;text-align:center">'+(c.posizione_serp?'<span style="'+sCls+';padding:2px 8px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td>';
        body += '<td style="padding:9px 11px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>/5':'N/D')+'</td>';
        body += '<td style="padding:9px 11px;text-align:center">'+c.n_recensioni+'</td>';
        body += '<td style="padding:9px 11px;text-align:center">'+(c.rec_comp?'<span style="font-weight:700;color:'+(c.rec_comp.perc>=70?'#2e7d32':c.rec_comp.perc>=30?'#e65100':'#c62828')+'">'+c.rec_comp.perc+'%</span>':'<span style="color:#aaa">N/D</span>')+'</td>';
        body += '<td style="padding:9px 11px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td>';
        body += '</tr>';
      });
      // Gap analysis
      var leadHaSito = !!web;
      var compConSito = competitor.filter(function(c){ return c.ha_sito; }).length;
      var compSerp = competitor.filter(function(c){ return c.posizione_serp; }).length;
      var ratMed = competitor.filter(function(c){ return c.rating; }).reduce(function(a,c){ return a+parseFloat(c.rating); },0) / (competitor.filter(function(c){ return c.rating; }).length||1);
      var recMed = Math.round(competitor.reduce(function(a,c){ return a+c.n_recensioni; },0) / competitor.length);
      body += '</tbody></table></div>';
      body += '<div style="margin-top:12px;padding:12px 14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px">';
      body += '<div style="font-size:9pt;font-weight:700;color:#795548;margin-bottom:8px">Gap Analysis</div>';
      if (!leadHaSito && compConSito>0) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">! Sito web: '+compConSito+'/'+competitor.length+' competitor ce l\'hanno, tu no</div>';
      else if (leadHaSito && compConSito===0) body += '<div style="font-size:9pt;color:#2e7d32;margin-bottom:5px">+ Vantaggio: sei l\'unico con sito web</div>';
      if (compSerp>0 && !(seo&&seo.posizione&&seo.posizione<=30)) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">! SERP Google: '+compSerp+' competitor presenti, tu no</div>';
      if (rating && ratMed>0 && rating<ratMed) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">! Rating: '+rating+'/5 vs media competitor '+ratMed.toFixed(1)+'/5</div>';
      if (nRating<recMed) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:5px">! Recensioni: '+nRating+' vs media competitor '+recMed+'</div>';
      body += '</div></div>';
    }

    // 5. SOCIAL
    if (social.facebook || social.instagram) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div>';
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) {
        body += '<div style="flex:1;min-width:180px;border:1px solid #1877f2;border-radius:10px;overflow:hidden">';
        body += '<div style="background:#1877f2;padding:9px 14px"><span style="color:white;font-weight:700">Facebook</span></div>';
        body += '<div style="padding:12px 14px">';
        if (social.facebook_follower) body += '<div style="font-size:1.4rem;font-weight:800;color:#1877f2;margin-bottom:3px">'+social.facebook_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>';
        body += '<a href="'+social.facebook+'" target="_blank" style="display:inline-block;padding:6px 14px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        body += '</div></div>';
      }
      if (social.instagram) {
        body += '<div style="flex:1;min-width:180px;border:1px solid #e1306c;border-radius:10px;overflow:hidden">';
        body += '<div style="background:#e1306c;padding:9px 14px"><span style="color:white;font-weight:700">Instagram</span></div>';
        body += '<div style="padding:12px 14px">';
        if (social.instagram_follower) body += '<div style="font-size:1.4rem;font-weight:800;color:#e1306c;margin-bottom:3px">'+social.instagram_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>';
        body += '<a href="'+social.instagram+'" target="_blank" style="display:inline-block;padding:6px 14px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a>';
        body += '</div></div>';
      }
      body += '</div></div>';
    } else {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div>';
      body += '<div style="'+box+';border-left:4px solid #c62828"><div style="color:#c62828;font-weight:600;margin-bottom:4px">Nessun profilo social trovato</div><div style="font-size:9pt;color:#888">Opportunita: apertura e gestione profili FB+IG da zero</div></div></div>';
    }

    // 6. VISIBILITA AI
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div>';
    body += '<div style="display:flex;gap:14px;align-items:stretch;flex-wrap:wrap">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:110px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa;margin-top:3px">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:8px">Le AI generative citano le attivita che trovano su fonti autorevoli. Piu fonti presenti = piu probabilita di essere citati quando qualcuno chiede "migliore '+categoria+' a '+citta+'".</div>';
    body += '<div style="display:flex;flex-direction:column;gap:4px">';
    ai.dettagli.forEach(function(d){
      var isPos = d.indexOf('ottimo')>-1||d.indexOf('buono')>-1||d.indexOf('prima pagina')>-1||d.indexOf('presenti')>-1||d.indexOf('unico')>-1||d.indexOf('vantaggio')>-1;
      body += '<div style="font-size:9pt;color:'+(isPos?'#2e7d32':'#c62828')+'">'+(isPos?'+ ':'- ')+d+'</div>';
    });
    body += '</div></div></div></div>';

    // 7. ANALISI STRATEGICA
    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div>';
      body += '<div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7">';
      body += '<p style="margin-bottom:10px">'+strategia+'</p>';
      body += '</div></div>';
    }

    //  Embed lead data per JS interno 
    var leadJson = JSON.stringify({
      nome: nome, indirizzo: lead.indirizzo||'', web: web||null,
      telefono: lead.telefono||null, tipi: lead.tipi||[],
      rating: rating, nRating: nRating, descrizione: lead.descrizione||null,
      fotoRefs: lead.fotoRefs||[], placeId: lead.placeId||null,
      categoria: categoria, citta: citta, logoUrl: lead.logoUrl||null
    });

    var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.page{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.hdr{background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}.hdr .title{font-size:13pt;font-weight:700;color:white}.hdr .sub{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.hdr .date{font-size:8.5pt;color:rgba(255,255,255,0.4)}.lead-bar{border-left:5px solid #E8001C;background:white;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}.lead-bar .ln{font-size:12pt;font-weight:700;margin-bottom:4px}.lead-bar .ls{font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap}.body{padding:18px 26px 26px}.azioni{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee}.btn{padding:9px 18px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:opacity 0.2s}.btn:disabled{opacity:0.5;cursor:not-allowed}.btn-red{background:#E8001C;color:white}.btn-dark{background:#111;color:white}.btn-green{background:#2e7d32;color:white}.btn-gray{background:#f0f0f0;color:#555}#consulente-panel{display:none;background:#fff9e6;border:1px solid #ffe082;border-radius:8px;padding:12px 16px;margin-bottom:14px}.consulente-row{display:flex;gap:8px;align-items:center;margin-top:8px}#consulente-input{flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:10pt}@media print{.azioni{display:none}body{background:white}.page{box-shadow:none;border-radius:0;margin:0}}';

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - '+nome+'</title><style>'+css+'</style></head><body>' +
      '<div class="page">' +
      '<div class="hdr"><div><div class="title">Analisi Digitale Prevendita</div><div class="sub">Lead Agent - Pagine Si!</div></div><div class="date">'+oggi+'</div></div>' +
      '<div class="lead-bar"><div class="ln">'+nome+'</div><div class="ls">' +
      '<span>'+(lead.indirizzo||'')+'</span>' +
      (web?'<span>Sito: <a href="'+web+'" target="_blank" style="color:#1565c0">'+web+'</a></span>':'<span style="color:#c62828">Nessun sito web</span>') +
      '<span>Rating: '+(rating?rating+'/5 ('+nRating+' rec.)':'N/D')+'</span>' +
      '<span>'+categoria+' '+citta+'</span>' +
      '</div></div>' +
      '<div class="body">' +
      '<div class="azioni">' +
      '<button class="btn btn-red" onclick="window.print()">Stampa / PDF</button>' +
      '<button class="btn btn-dark" id="btn-prop" onclick="toggleConsulente()">Genera Proposta</button>' +
      '<button class="btn btn-green" id="btn-ant" onclick="apriAnteprima()">Anteprima Sito</button>' +
      '<button class="btn btn-gray" onclick="window.close()">Chiudi</button>' +
      '</div>' +
      '<div id="consulente-panel">' +
      '<div style="font-size:10pt;font-weight:600;color:#795548">Nome del consulente per la proposta:</div>' +
      '<div class="consulente-row"><input id="consulente-input" type="text" placeholder="Nome Cognome"><button class="btn btn-dark" onclick="generaProposta()">Genera</button><button class="btn btn-gray" onclick="toggleConsulente()">Annulla</button></div>' +
      '</div>' +
      body +
      '</div></div>' +
      '<script>' +
      'var B="https://leadagent-backend.onrender.com";' +
      'var AP=' + JSON.stringify(analisiPayloadJson) + ';' +
      '(async function loadStrategia(){' +
      '  try{' +
      '    var r=await fetch(B+"/analisi-strategica",{method:"POST",headers:{"Content-Type":"application/json"},body:AP});' +
      '    var d=await r.json();' +
      '    var el=document.getElementById("strategia-loading");' +
      '    if(el&&d.testo){el.style.textAlign="left";el.style.color="#1a1a1a";el.innerHTML="<p style=\"margin-bottom:10px\">"+d.testo+"</p>";}' +
      '    else if(el){el.innerHTML="Analisi non disponibile.";}' +
      '  }catch(e){var el=document.getElementById("strategia-loading");if(el)el.innerHTML="Analisi non disponibile.";}' +
      '})();' +
      'var L='+leadJson+';' +
      'function toggleConsulente(){var p=document.getElementById("consulente-panel");p.style.display=p.style.display==="block"?"none":"block";if(p.style.display==="block")document.getElementById("consulente-input").focus();}' +
      'function generaProposta(){' +
      '  var c=document.getElementById("consulente-input").value.trim()||"Consulente Pagine Si!";' +
      '  document.getElementById("consulente-panel").style.display="none";' +
      '  var btn=document.getElementById("btn-prop");btn.disabled=true;btn.textContent="Generazione...";' +
      '  fetch(B+"/proposal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:L,consulente:c})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){' +
      '    if(d.html){var blob=new Blob([d.html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);window.open(url,"_blank");setTimeout(function(){URL.revokeObjectURL(url);},30000);}' +
      '    btn.disabled=false;btn.textContent="Proposta generata";' +
      '  })' +
      '  .catch(function(e){console.error(e);btn.disabled=false;btn.textContent="Genera Proposta";});' +
      '}' +
      'function apriAnteprima(){' +
      '  var btn=document.getElementById("btn-ant");btn.disabled=true;btn.textContent="Generazione...";' +
      '  fetch(B+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:L.nome,indirizzo:L.indirizzo,telefono:L.telefono,tipi:L.tipi,rating:L.rating,nRating:L.nRating,descrizione:L.descrizione,logoUrl:L.logoUrl})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){' +
      '    if(d.html){var blob=new Blob([d.html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);window.open(url,"_blank");setTimeout(function(){URL.revokeObjectURL(url);},30000);}' +
      '    btn.disabled=false;btn.textContent="Anteprima Sito";' +
      '  })' +
      '  .catch(function(e){console.error(e);btn.disabled=false;btn.textContent="Anteprima Sito";});' +
      '}' +
      '</script>' +
      '</body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/analisi-strategica', async function(req, res) {
  try {
    var lead = req.body.lead;
    var seoData = req.body.seo || {};
    var socialData = req.body.social || {};
    var recData = req.body.recensioni || null;
    var compData = req.body.competitor || [];
    var testo = await analisiClaude(lead, seoData, socialData, recData, compData);
    res.json({ testo: testo || '' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function(){ console.log('LeadAgent Backend running on port ' + PORT); });
