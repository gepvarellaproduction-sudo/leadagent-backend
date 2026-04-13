const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: function(origin, cb){ cb(null, true); } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Health check
app.get('/', function(req, res) {
  res.json({ status: 'ok', service: 'LeadAgent Backend - Pagine Si!' });
});

// Google Places search
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

// Analisi mercato AI
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

// Preview sito
app.post('/preview', async function(req, res) {
  try {
    var n = req.body.nome, ind = req.body.indirizzo, tel = req.body.telefono;
    var tipi = req.body.tipi, rat = req.body.rating, nRat = req.body.nRating, logo = req.body.logoUrl;
    var logoS = logo ? 'Usa questo logo: <img src="' + logo + '" style="max-height:70px">' : 'Crea logo testuale con iniziali in cerchio colorato.';
    var tipiS = (tipi||[]).slice(0,3).join(', ') || 'attivita locale';
    var prompt = '<!DOCTYPE html> - Genera SOLO HTML completo per: "' + n + '", ' + tipiS + ', ' + ind + ', tel: ' + (tel||'da inserire') + '. ' + logoS + (rat ? ' Rating: '+rat+'/5 ('+nRat+' rec).' : '') + ' DESIGN professionale Google Fonts, Unsplash, responsive. STRUTTURA: header banner Pagine Si!, hero fullscreen, storia, 6 servizi, 4 recensioni, contatti maps, footer. INIZIA CON <!DOCTYPE html>.';
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

//  Helpers analisi 

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

async function cercaSocial(nome, citta) {
  var out = { facebook: null, facebook_follower: null, instagram: null, instagram_follower: null };
  function estraiF(s, t) { var m = (s+' '+t).match(/(\d+[.,]?\d*\s*[KkMm]?)\s*(follower|followers|seguaci|Mi piace)/i); return m ? m[0].trim() : null; }
  function trovaSu(items, tipo) {
    for (var i = 0; i < items.length; i++) {
      var url = (items[i].url||'').toLowerCase(), dom = (items[i].domain||'').toLowerCase();
      if (!dom.includes(tipo+'.com')) continue;
      var path = url.replace(new RegExp('https?://(www\\.)?'+tipo+'\\.com/?'),'');
      var skip = tipo==='facebook' ? ['search','watch','groups','login','sharer'] : ['explore','p/','reel/','accounts'];
      if (!path || path.length < 3 || skip.some(function(s){ return path.startsWith(s); })) continue;
      return { url: items[i].url, follower: estraiF(items[i].description||'', items[i].title||'') };
    }
    return null;
  }
  try {
    var q1 = await dfsSearch('"' + nome + '" ' + citta + ' facebook OR instagram', 10);
    var q2 = await dfsSearch(nome + ' instagram ' + citta, 5);
    var all = q1.concat(q2);
    var fb = trovaSu(all, 'facebook');
    if (fb) { out.facebook = fb.url; out.facebook_follower = fb.follower; }
    var ig = trovaSu(all, 'instagram');
    if (ig) { out.instagram = ig.url; out.instagram_follower = ig.follower; }
    if (!out.instagram) {
      var q3 = await dfsSearch(nome + ' instagram', 5);
      var ig2 = trovaSu(q3, 'instagram');
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
    for (var i = 0; i < data.places.length; i++) {
      var n = ((data.places[i].displayName && data.places[i].displayName.text)||'').toLowerCase();
      if (n.includes(nomeNorm.slice(0,5)) || (webNorm && (data.places[i].websiteUri||'').toLowerCase().includes(webNorm))) {
        out.posizione_maps_lead = i + 1; break;
      }
    }
    var count = 0;
    for (var ci = 0; ci < data.places.length && count < 3; ci++) {
      var cp = data.places[ci];
      var cn = ((cp.displayName && cp.displayName.text)||'').toLowerCase();
      if (!cn || cn.includes(nomeNorm.slice(0,5)) || (webNorm && (cp.websiteUri||'').toLowerCase().includes(webNorm))) continue;
      var sito = cp.websiteUri || null;
      var sitoDom = sito ? sito.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;
      var posizioneSerp = null;
      if (sitoDom && serpItems && serpItems.length && !dir.some(function(d){ return sitoDom.includes(d); })) {
        for (var si = 0; si < serpItems.length; si++) {
          var sd = (serpItems[si].domain||'').toLowerCase();
          if (!dir.some(function(d){ return sd.includes(d); }) && sd.includes(sitoDom)) { posizioneSerp = si+1; break; }
        }
      }
      var recComp = null;
      if (cp.id) {
        try {
          var rr = await fetch('https://places.googleapis.com/v1/places/' + cp.id, {
            headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'reviews' }
          });
          var rd = await rr.json();
          if (rd.reviews && rd.reviews.length) {
            var risposte = rd.reviews.filter(function(r){ return !!(r.reviewReply && r.reviewReply.text); }).length;
            recComp = { campione: rd.reviews.length, risposte: risposte, perc: Math.round((risposte/rd.reviews.length)*100) };
          }
        } catch(e) {}
      }
      out.competitor.push({ nome: (cp.displayName && cp.displayName.text)||'N/D', posizione_maps: ci+1, posizione_serp: posizioneSerp, rating: cp.rating ? cp.rating.toFixed(1) : null, n_recensioni: cp.userRatingCount||0, ha_sito: !!sito, sito_dom: sitoDom, rec_comp: recComp });
      count++;
    }
  } catch(e) {}
  return out;
}

// Visibilita AI - analizza fonti che alimentano le AI generative
async function calcolaAI(nome, citta, web, social, nRating, rating, seo) {
  var score = 0, det = [];
  var fonti = [];

  // Cerca presenza su fonti autorevoli via DataForSEO
  try {
    var items = await dfsSearch('"' + nome + '" ' + citta, 20);
    var dominiTrovati = items.map(function(i){ return (i.domain||'').toLowerCase(); });

    // TripAdvisor
    var haTrip = dominiTrovati.some(function(d){ return d.includes('tripadvisor'); });
    if (haTrip) { score += 10; fonti.push({ label: 'TripAdvisor', ok: true }); }
    else { fonti.push({ label: 'TripAdvisor', ok: false }); }

    // Pagine Gialle
    var haGialle = dominiTrovati.some(function(d){ return d.includes('paginegialle'); });
    if (haGialle) { score += 5; fonti.push({ label: 'Pagine Gialle', ok: true }); }
    else { fonti.push({ label: 'Pagine Gialle', ok: false }); }

    // Quotidiani/blog locali
    var quotidiani = ['baritoday','lagazzettadelmezzogiorno','corriereditaranto','puglialive','noinotizie','brindisireport','tarantobuonsera'];
    var haQuotidiani = dominiTrovati.some(function(d){ return quotidiani.some(function(q){ return d.includes(q); }); });
    if (haQuotidiani) { score += 8; fonti.push({ label: 'Stampa locale online', ok: true }); }
    else { fonti.push({ label: 'Stampa locale online', ok: false }); }

    // Sito proprio indicizzato
    if (web) {
      var haWeb = dominiTrovati.some(function(d){ return d.includes(web.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]); });
      if (haWeb || (seo && seo.posizione && seo.posizione <= 30)) {
        score += 15; fonti.push({ label: 'Sito web indicizzato', ok: true });
      } else {
        score += 5; fonti.push({ label: 'Sito web (non indicizzato)', ok: false });
      }
    } else {
      fonti.push({ label: 'Sito web', ok: false });
    }
  } catch(e) {
    // Fallback senza ricerca
    if (web) { score += 8; fonti.push({ label: 'Sito web', ok: true }); }
    else { fonti.push({ label: 'Sito web', ok: false }); }
    fonti.push({ label: 'TripAdvisor', ok: false });
    fonti.push({ label: 'Stampa locale', ok: false });
  }

  // Google Maps
  if (nRating >= 100) { score += 20; fonti.push({ label: 'Google Maps ('+nRating+' rec.)', ok: true }); }
  else if (nRating >= 30) { score += 12; fonti.push({ label: 'Google Maps ('+nRating+' rec.)', ok: true }); }
  else if (nRating > 0) { score += 6; fonti.push({ label: 'Google Maps ('+nRating+' rec.)', ok: false }); }
  else { fonti.push({ label: 'Google Maps', ok: false }); }

  // Rating boost
  if (rating >= 4.5) score += 10; else if (rating >= 4.0) score += 6; else if (rating >= 3.5) score += 3;

  // Social
  if (social.facebook && social.instagram) { score += 15; fonti.push({ label: 'Facebook + Instagram', ok: true }); }
  else if (social.facebook || social.instagram) { score += 8; fonti.push({ label: social.facebook?'Facebook':'Instagram', ok: true }); fonti.push({ label: social.facebook?'Instagram':'Facebook', ok: false }); }
  else { fonti.push({ label: 'Facebook', ok: false }); fonti.push({ label: 'Instagram', ok: false }); }

  score = Math.min(score, 100);
  return { score: score, livello: score>=70?'ALTA':score>=40?'MEDIA':'BASSA', colore: score>=70?'#2e7d32':score>=40?'#e65100':'#c62828', fonti: fonti };
}

//  Endpoint /analisi 
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

    // 1. Avvia task recensioni DataForSEO subito (async)
    var recTaskId = null;
    try {
      var payload = [{ depth: 50, sort_by: 'newest', location_code: 2380, language_code: 'it' }];
      if (lead.placeId) { payload[0].place_id = lead.placeId; } else { payload[0].keyword = nome + ' ' + citta; }
      var postResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
        method: 'POST',
        headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var postData = await postResp.json();
      recTaskId = postData.tasks && postData.tasks[0] && postData.tasks[0].id;
    } catch(e) {}

    // 2. Tutte le altre ricerche in parallelo
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta)
    ]);
    var seo = risultati[0];
    var social = risultati[1];
    var serpItems = (seo && seo.items) || [];
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);

    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);
    var competitor = mapsData.competitor;
    var mapsPos = mapsData.posizione_maps_lead;

    // 3. Raccoglie recensioni (il task gira da ~20s, quasi certamente pronto)
    var recensioni = null;
    if (recTaskId) {
      for (var attempt = 0; attempt < 4; attempt++) {
        await new Promise(function(r){ setTimeout(r, 2500); });
        try {
          var getResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/' + recTaskId, {
            headers: { 'Authorization': dfsAuth() }
          });
          var getData = await getResp.json();
          var task = getData.tasks && getData.tasks[0];
          if (task && task.status_code === 20000 && task.result && task.result[0]) {
            var result = task.result[0];
            var items = result.items || [];
            var totale = nRating || result.reviews_count || items.length;
            var risposte = items.filter(function(r){ return !!r.owner_answer; }).length;
            var pos = items.filter(function(r){ return r.rating && r.rating.value >= 4; }).length;
            var neg = items.filter(function(r){ return r.rating && r.rating.value <= 2; }).length;
            recensioni = {
              totale_recensioni: totale,
              campione: items.length,
              con_risposta: risposte,
              perc_risposta: items.length > 0 ? Math.round((risposte/items.length)*100) : 0,
              positive: pos,
              negative: neg,
              testi: items.slice(0,20).map(function(r){ return { rating: r.rating&&r.rating.value, testo: r.review_text||'', ha_risposta: !!r.owner_answer, time_ago: r.time_ago||'' }; }),
              ultima: items[0] ? { rating: items[0].rating&&items[0].rating.value, testo: items[0].review_text||'', ha_risposta: !!items[0].owner_answer, time_ago: items[0].time_ago||'' } : null
            };
            break;
          }
        } catch(e) {}
      }
    }

    // 4. Analisi Claude - dati per chiamata in background dalla pagina
    // Analisi Claude - Haiku veloce, inclusa direttamente nell'HTML
    var strategia = null;
    try {
      var recTesti = recensioni && recensioni.testi ? recensioni.testi.slice(0,10).map(function(r){ return (r.rating||'?')+'/5: '+r.testo.slice(0,80); }).join(' | ') : 'nessuna';
      var datiStr = [
        'Attivita: '+nome+' ('+categoria+' a '+citta+')',
        'Sito: '+(web||'nessun sito'),
        'Rating: '+(rating||'N/D')+'/5 con '+nRating+' recensioni',
        'Pos. Google "'+keyword+'": '+(seo&&seo.posizione?'#'+seo.posizione:'non trovato'),
        'Pos. Maps: '+(mapsPos?'#'+mapsPos:'non trovato'),
        'Facebook: '+(social.facebook?'presente'+(social.facebook_follower?' ('+social.facebook_follower+')':''):'assente'),
        'Instagram: '+(social.instagram?'presente'+(social.instagram_follower?' ('+social.instagram_follower+')':''):'assente'),
        'Recensioni: '+(recensioni?recensioni.perc_risposta+'% risposte su '+recensioni.campione+', '+recensioni.positive+' pos, '+recensioni.negative+' neg':'N/D'),
        'Ultime rec: '+recTesti,
        'Competitor: '+competitor.map(function(c){ return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' '+(c.rating||'N/D')+'/5'; }).join(', ')
      ].join('\n');
      var prompt = 'Sei un senior digital marketing strategist italiano per PMI locali. Analizza questi dati reali.\n\nDATI:\n'+datiStr+'\n\nPRODUCI (max 500 parole, **Titolo** per titoli in grassetto):\n**Situazione Attuale** - 2-3 gap critici con numeri reali\n**Analisi Recensioni** - punti forza, punti deboli, criticita dalle recensioni\n**Obiettivi a 90 Giorni** - 3 obiettivi con numeri specifici\n**Obiettivi a 6 Mesi** - 3 proiezioni concrete\n**Strategia Social** - uso Reels per questa categoria (3x reach, +25-40% visite con 3+ reels/settimana)\n**Priorita Intervento** - i 3 servizi Pagine Si! piu urgenti';
      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        strategia = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
      }
    } catch(e) {}

    var ai = await calcolaAI(nome, citta, web, social, nRating, rating, seo);
    var oggi = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var sec = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var box = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 18px;margin-bottom:8px';

    var body = '';

    // POSIZIONAMENTO
    var gPos = seo && seo.posizione;
    var gColor = gPos ? (gPos<=10?'#2e7d32':gPos<=30?'#e65100':'#c62828') : '#c62828';
    var gLabel = gPos ? '#'+gPos : (seo&&seo.no_sito?'Nessun sito':'N/T');
    var mColor = mapsPos ? (mapsPos<=3?'#2e7d32':mapsPos<=7?'#e65100':'#c62828') : '#9e9e9e';
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Posizionamento - '+keyword+'</div>';
    body += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div><div style="font-size:2.6rem;font-weight:800;color:'+gColor+'">'+gLabel+'</div><div style="font-size:8.5pt;color:'+gColor+';font-weight:600;margin-top:4px">'+(gPos?(gPos<=10?'Prima pagina':gPos<=30?'Pagine 2-3':'Oltre pag. 3'):(seo&&seo.no_sito?'Senza sito':'Non trovato'))+'</div>'+(seo&&seo.url?'<div style="font-size:8pt;margin-top:5px"><a href="'+seo.url+'" target="_blank" style="color:#1565c0">'+seo.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,35)+'</a></div>':'')+'</div>';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div><div style="font-size:2.6rem;font-weight:800;color:'+mColor+'">'+(mapsPos?'#'+mapsPos:'N/T')+'</div><div style="font-size:8.5pt;color:'+mColor+';font-weight:600;margin-top:4px">'+(mapsPos?(mapsPos<=3?'Top 3':'Posizione '+mapsPos):'Non in lista')+'</div></div>';
    body += '</div></div>';

    // PRESENZA DIGITALE
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Presenza Digitale</div><div style="display:flex;gap:10px;flex-wrap:wrap">';
    [{label:'Sito Web',val:web?'Presente':'Assente',ok:!!web,link:web},{label:'Google Maps',val:nRating>0?nRating+' rec.':'Assente',ok:nRating>=20},{label:'Rating',val:rating?rating+'/5':'N/D',ok:rating>=4.0},{label:'Facebook',val:social.facebook?(social.facebook_follower||'Trovato'):'Assente',ok:!!social.facebook,link:social.facebook},{label:'Instagram',val:social.instagram?(social.instagram_follower||'Trovato'):'Assente',ok:!!social.instagram,link:social.instagram}].forEach(function(item){
      var bg=item.ok?'#e8f5e9':'#fce8e8', col=item.ok?'#2e7d32':'#c62828';
      body += '<div style="flex:1;min-width:100px;background:'+bg+';border-radius:8px;padding:12px;text-align:center"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">'+item.label+'</div>'+(item.link?'<a href="'+item.link+'" target="_blank" style="font-size:9.5pt;font-weight:700;color:'+col+';text-decoration:none">'+item.val+'</a>':'<div style="font-size:9.5pt;font-weight:700;color:'+col+'">'+item.val+'</div>')+'</div>';
    });
    body += '</div></div>';

    // RECENSIONI
    if (recensioni) {
      var pColor=recensioni.perc_risposta>=70?'#2e7d32':recensioni.perc_risposta>=30?'#e65100':'#c62828';
      var pLabel=recensioni.perc_risposta>=70?'Buona gestione':recensioni.perc_risposta>=30?'Gestione parziale':'Scarsa gestione';
      var stars5=['&#9733;&#9733;&#9733;&#9733;&#9733;','&#9733;&#9733;&#9733;&#9733;&#9734;','&#9733;&#9733;&#9733;&#9734;&#9734;','&#9733;&#9733;&#9734;&#9734;&#9734;','&#9733;&#9734;&#9734;&#9734;&#9734;'];
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Gestione Recensioni</div>';
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">% Risposte</div><div style="font-size:2rem;font-weight:800;color:'+pColor+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+pColor+';font-weight:600;margin-top:3px">'+pLabel+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Pos/Neg</div><div style="font-size:1.6rem;font-weight:800"><span style="color:#2e7d32">'+recensioni.positive+'</span> / <span style="color:#c62828">'+recensioni.negative+'</span></div><div style="font-size:8pt;color:#aaa;margin-top:3px">su '+recensioni.campione+' analizzate</div></div>';
      body += '</div>';
      if (recensioni.ultima && recensioni.ultima.testo) {
        var ur=recensioni.ultima, sColor=ur.rating>=4?'#2e7d32':ur.rating>=3?'#e65100':'#c62828';
        var stH=ur.rating?stars5[Math.max(0,5-Math.round(ur.rating))]:'';
        body += '<div style="'+box+'"><div style="font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px">Ultima recensione'+(ur.time_ago?' ('+ur.time_ago+')':'')+'</div>';
        if (stH) body += '<div style="font-size:10pt;color:'+sColor+';margin-bottom:5px">'+stH+'</div>';
        body += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+ur.testo.slice(0,280).replace(/[<>]/g,'')+(ur.testo.length>280?'...':'')+'&quot;</div>';
        body += '<div style="font-size:8.5pt;margin-top:6px;font-weight:600;color:'+(ur.ha_risposta?'#2e7d32':'#c62828')+'">'+(ur.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div></div>';
      }
      body += '</div>';
    }

    // COMPETITOR
    if (competitor && competitor.length) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Competitor di Zona</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt"><thead><tr style="background:#111;color:white"><th style="padding:9px 10px;text-align:left">Attivita</th><th style="padding:9px 10px;text-align:center">Maps</th><th style="padding:9px 10px;text-align:center">Google</th><th style="padding:9px 10px;text-align:center">Rating</th><th style="padding:9px 10px;text-align:center">Rec.</th><th style="padding:9px 10px;text-align:center">% Risp.</th><th style="padding:9px 10px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,i){
        var bg=i%2===0?'white':'#fafafa';
        body += '<tr style="background:'+bg+';border-bottom:1px solid #f0f0f0"><td style="padding:9px 10px;font-weight:600">'+c.nome+(c.sito_dom?'<br><span style="font-size:8pt;color:#1565c0">'+c.sito_dom+'</span>':'')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.posizione_serp?'<span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>/5':'N/D')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+c.n_recensioni+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.rec_comp?'<span style="font-weight:700;color:'+(c.rec_comp.perc>=70?'#2e7d32':c.rec_comp.perc>=30?'#e65100':'#c62828')+'">'+c.rec_comp.perc+'%</span>':'<span style="color:#aaa">N/D</span>')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td></tr>';
      });
      var compConSito=competitor.filter(function(c){return c.ha_sito;}).length;
      var compSerp=competitor.filter(function(c){return c.posizione_serp;}).length;
      var ratMed=competitor.filter(function(c){return c.rating;}).reduce(function(a,c){return a+parseFloat(c.rating);},0)/(competitor.filter(function(c){return c.rating;}).length||1);
      var recMed=Math.round(competitor.reduce(function(a,c){return a+c.n_recensioni;},0)/competitor.length);
      body += '</tbody></table></div><div style="margin-top:10px;padding:12px 14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px"><div style="font-size:9pt;font-weight:700;color:#795548;margin-bottom:6px">Gap Analysis</div>';
      if (!web && compConSito>0) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:4px">! Sito: '+compConSito+'/'+competitor.length+' competitor ce l\'hanno, tu no</div>';
      else if (web && compConSito===0) body += '<div style="font-size:9pt;color:#2e7d32;margin-bottom:4px">+ Vantaggio: sei l\'unico con sito web</div>';
      if (compSerp>0 && !(seo&&seo.posizione&&seo.posizione<=30)) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:4px">! SERP: '+compSerp+' competitor in Google, tu no</div>';
      if (rating && ratMed>0 && rating<ratMed) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:4px">! Rating: '+rating+'/5 vs media competitor '+ratMed.toFixed(1)+'/5</div>';
      if (nRating<recMed) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:4px">! Recensioni: '+nRating+' vs media competitor '+recMed+'</div>';
      body += '</div></div>';
    }

    // SOCIAL
    if (social.facebook || social.instagram) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) {
        body += '<div style="flex:1;min-width:160px;border:1px solid #1877f2;border-radius:10px;overflow:hidden"><div style="background:#1877f2;padding:9px 14px"><span style="color:white;font-weight:700">Facebook</span></div><div style="padding:12px 14px">'+(social.facebook_follower?'<div style="font-size:1.4rem;font-weight:800;color:#1877f2;margin-bottom:3px">'+social.facebook_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>':'')+'<a href="'+social.facebook+'" target="_blank" style="display:inline-block;padding:6px 14px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      }
      if (social.instagram) {
        body += '<div style="flex:1;min-width:160px;border:1px solid #e1306c;border-radius:10px;overflow:hidden"><div style="background:#e1306c;padding:9px 14px"><span style="color:white;font-weight:700">Instagram</span></div><div style="padding:12px 14px">'+(social.instagram_follower?'<div style="font-size:1.4rem;font-weight:800;color:#e1306c;margin-bottom:3px">'+social.instagram_follower+'</div><div style="font-size:8pt;color:#aaa;margin-bottom:8px">da Google snippet</div>':'')+'<a href="'+social.instagram+'" target="_blank" style="display:inline-block;padding:6px 14px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      }
      body += '</div></div>';
    } else {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="'+box+';border-left:4px solid #c62828"><div style="color:#c62828;font-weight:600;margin-bottom:4px">Nessun profilo social trovato</div><div style="font-size:9pt;color:#888">Opportunita: apertura e gestione profili FB+IG da zero</div></div></div>';
    }

    // VISIBILITA AI
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div>';
    body += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:110px"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa;margin-top:3px">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:10px">Le AI generative (Gemini, ChatGPT) citano le attivita presenti su fonti che scansionano: Google Maps, TripAdvisor, sito web, social, stampa locale. Piu fonti presenti = piu probabilita di essere citati per "'+categoria+' a '+citta+'".</div>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    (ai.fonti||[]).forEach(function(f){
      body += '<div style="display:flex;align-items:center;gap:6px;font-size:9pt"><span style="color:'+(f.ok?'#2e7d32':'#c62828')+';font-weight:700;font-size:11pt">'+(f.ok?'&#10003;':'&#10007;')+'</span><span style="color:'+(f.ok?'#2e7d32':'#c62828')+'">'+f.label+'</span></div>';
    });
    body += '</div></div></div></div>';

    // ANALISI STRATEGICA
    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div><div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7"><p style="margin-bottom:10px">'+strategia+'</p></div></div>';
    }

    // Dati lead per JS interno
    var leadJson = JSON.stringify({ nome:nome, indirizzo:lead.indirizzo||'', web:web||null, telefono:lead.telefono||null, tipi:lead.tipi||[], rating:rating, nRating:nRating, descrizione:lead.descrizione||null, fotoRefs:lead.fotoRefs||[], placeId:lead.placeId||null, categoria:categoria, citta:citta, logoUrl:lead.logoUrl||null });

    // Payload per analisi strategica (caricata in background)
    var strategiaPayload = JSON.stringify({
      nome:nome, categoria:categoria, citta:citta, web:web||null,
      rating:rating, nRating:nRating,
      pos_google: seo&&seo.posizione?('#'+seo.posizione):'non trovato',
      pos_maps: mapsPos?('#'+mapsPos):'non trovato',
      keyword: keyword,
      facebook: social.facebook?('presente'+(social.facebook_follower?' ('+social.facebook_follower+')':'')):'assente',
      instagram: social.instagram?('presente'+(social.instagram_follower?' ('+social.instagram_follower+')':'')):'assente',
      recensioni_perc: recensioni?recensioni.perc_risposta:null,
      recensioni_campione: recensioni?recensioni.campione:null,
      recensioni_pos: recensioni?recensioni.positive:null,
      recensioni_neg: recensioni?recensioni.negative:null,
      recensioni_testi: recensioni&&recensioni.testi?recensioni.testi.map(function(r){return (r.rating||'?')+'/5: '+r.testo.slice(0,80);}).join(' | '):'nessuna',
      competitor: competitor.map(function(c){return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' '+(c.rating||'N/D')+'/5';}).join(', ')
    });


    // Proposta generata lato server
    var propostaHtml = '';
    try {
      var pMod = require('./proposal');
      var fat = pMod.stimaFatturato(lead);
      var anBase = pMod.analisiDigitale(lead);
      anBase.bisogni = anBase.bisogni || {};
      if (!seo || !seo.posizione || seo.posizione > 30) anBase.bisogni.seo = true;
      if (!social.facebook && !social.instagram) anBase.bisogni.social = true;
      if (recensioni && recensioni.perc_risposta < 30) anBase.bisogni.reputazione = true;
      var prods = pMod.costruisciPreventivo(lead, fat, anBase);
      var PROD = pMod.PRODOTTI;
      var ogP = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var scP = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var t1 = prods.reduce(function(s,p){return s+(p.anno1||0);},0);
      var tM = prods.reduce(function(s,p){return s+(p.mens||0);},0);
      var lj = JSON.stringify(PROD);
      var rr = prods.map(function(p,i){
        return '<tr data-a1="'+(p.anno1||0)+'" data-mn="'+(p.mens||0)+'" style="border-bottom:1px solid #f0f0f0">'+
          '<td style="padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>'+
          '<td style="padding:9px 11px"><div contenteditable="true" style="font-weight:600;margin-bottom:2px">'+p.nome+'</div>'+
          '<div contenteditable="true" style="font-size:8.5pt;color:#777">'+p.desc+'</div>'+
          '<div contenteditable="true" style="font-size:8pt;color:#aaa;font-style:italic">'+p.motivazione+'</div></td>'+
          '<td style="padding:9px 11px"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt">'+p.cat+'</span></td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:center;width:28px"><button onclick="rmRiga(this)" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px">&#10005;</button></td>'+
          '</tr>';
      }).join('');
      propostaHtml =
        '<div id="prop-sec" style="display:none">'+
        '<hr style="border:none;border-top:3px solid #E8001C;margin:32px 0 24px">'+
        '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #E8001C">Proposta Commerciale</div>'+
        '<div style="font-size:9pt;color:#aaa;margin-bottom:10px">Consulente: <strong contenteditable="true" style="color:#1a1a1a">Consulente Pagine Si!</strong> &middot; '+ogP+' &middot; Valida: '+scP+'</div>'+
        '<div style="background:#fff9e6;border:1px solid #ffe082;border-radius:7px;padding:9px 14px;margin-bottom:14px;font-size:9.5pt;color:#795548">Clicca sui testi per modificarli</div>'+
        '<table id="ptbl" style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt">'+
        '<thead><tr style="background:#111;color:white">'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Sigla</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Prodotto</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Area</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Anno 1</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Mensile</th>'+
        '<th style="width:28px"></th></tr></thead>'+
        '<tbody>'+rr+'</tbody>'+
        '<tfoot><tr><td colspan="6" style="padding:8px 11px;border-top:2px dashed #f0f0f0;background:#fafafa">'+
        '<button onclick="apriLP()" style="padding:5px 12px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer">+ Aggiungi dal listino</button>'+
        '</td></tr></tfoot></table>'+
        '<div style="background:#111;color:white;border-radius:8px;padding:16px 22px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px">'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Anno 1</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="pt1">&euro; '+t1.toLocaleString('it-IT')+'</div>'+
        '<div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Mensile</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="ptm">&euro; '+tM+'<span style="font-size:10pt;color:rgba(255,255,255,0.4)">/mese</span></div></div></div>'+
        '<div style="font-size:8.5pt;color:#bbb;text-align:center;margin-bottom:20px">Pagine Si! SpA &middot; paginesispa.it &middot; IVA esclusa</div>'+
        '<div id="lp-ov" onclick="if(event.target===this)chiudiLP()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">'+
        '<div style="background:#fff;border-radius:14px;width:660px;max-width:95vw;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'+
        '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:700">Aggiungi servizio</div><button onclick="chiudiLP()" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer">&#10005;</button></div>'+
        '<div id="lp-body" style="overflow-y:auto;padding:16px 18px;flex:1"></div>'+
        '<div style="padding:10px 18px;border-top:1px solid #eee;background:#f9f9f9;display:flex;justify-content:space-between;align-items:center">'+
        '<span style="font-size:10px;color:#aaa">Seleziona</span>'+
        '<button id="lp-ok" onclick="aggLP()" disabled style="padding:7px 16px;background:#E8001C;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;opacity:0.4">Aggiungi</button>'+
        '</div></div></div>'+
        '<script>var _LP='+lj+';var _LS=null;'+
        'function rmRiga(b){var tr=b.closest("tr");if(tr){tr.remove();updT();}}'+
        'function updT(){var a=0,m=0;document.querySelectorAll("#ptbl tbody tr").forEach(function(r){a+=parseFloat(r.dataset.a1||0);m+=parseFloat(r.dataset.mn||0);});var e1=document.getElementById("pt1"),em=document.getElementById("ptm");if(e1)e1.textContent=a.toLocaleString("it-IT");if(em)em.textContent=m;}'+
        'function apriLP(){var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM","Si2VN-PM"],"Directory":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Automation":["Si4BLD","Si4BEN"]};'+
        'var bd=document.getElementById("lp-body");bd.innerHTML="";'+
        'for(var c in cats){var w=document.createElement("div");w.style.marginBottom="14px";var lb=document.createElement("div");lb.style.cssText="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px";lb.textContent=c;w.appendChild(lb);var rw=document.createElement("div");rw.style.cssText="display:flex;flex-wrap:wrap;gap:4px";cats[c].forEach(function(s){var p=_LP[s];if(!p)return;var pr=p.mens?("\u20ac"+p.mens+"/mese"):(p.anno1?("\u20ac"+p.anno1+"/anno"):"");var btn=document.createElement("button");btn.id="lc-"+s;btn.dataset.s=s;btn.onclick=function(){selLP(this,this.dataset.s);};btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";var b=document.createElement("b");b.style.cssText="font-family:monospace;color:#E8001C";b.textContent=s;btn.appendChild(b);btn.appendChild(document.createTextNode(" "+p.nome+" "+pr));rw.appendChild(btn);});w.appendChild(rw);bd.appendChild(w);}'+
        'document.getElementById("lp-ov").style.display="flex";}'+
        'function selLP(el,s){document.querySelectorAll("[id^=lc-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_LS=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";var b=document.getElementById("lp-ok");if(b){b.disabled=false;b.style.opacity="1";}}'+
        'function aggLP(){if(!_LS)return;var p=_LP[_LS];if(!p)return;var tb=document.querySelector("#ptbl tbody");var tr=document.createElement("tr");tr.dataset.a1=p.anno1||0;tr.dataset.mn=p.mens||0;tr.style.borderBottom="1px solid #f0f0f0";function mkTd(st){var td=document.createElement("td");td.style.cssText=st;return td;}var t0=mkTd("padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600");t0.textContent=_LS;var t1b=mkTd("padding:9px 11px");var dn=document.createElement("div");dn.contentEditable="true";dn.style.cssText="font-weight:600;margin-bottom:2px";dn.textContent=p.nome;var dd=document.createElement("div");dd.contentEditable="true";dd.style.cssText="font-size:8.5pt;color:#777";dd.textContent=p.desc;t1b.appendChild(dn);t1b.appendChild(dd);var t2=mkTd("padding:9px 11px");var sp=document.createElement("span");sp.style.cssText="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt";sp.textContent=p.cat;t2.appendChild(sp);var t3=mkTd("padding:9px 11px;text-align:right;font-weight:600");t3.textContent=p.anno1?"\u20ac "+p.anno1.toLocaleString("it-IT"):"\u2014";var t4=mkTd("padding:9px 11px;text-align:right;font-weight:600");t4.textContent=p.mens?"\u20ac "+p.mens+"/mese":"\u2014";var t5=mkTd("padding:9px 11px;text-align:center;width:28px");var rb=document.createElement("button");rb.onclick=function(){rmRiga(this);};rb.style.cssText="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px";rb.innerHTML="&#10005;";t5.appendChild(rb);[t0,t1b,t2,t3,t4,t5].forEach(function(t){tr.appendChild(t);});tb.appendChild(tr);updT();chiudiLP();_LS=null;}'+
        'function chiudiLP(){document.getElementById("lp-ov").style.display="none";}<\/script>'+
        '</div>';
    } catch(propErr) { propostaHtml = ''; }
    var tastoP = propostaHtml ?
      '<div style="margin-top:32px;padding:20px 0;text-align:center" class="no-print">'+
      '<button id="btn-prop" onclick="mostraP()" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>'+
      '<div style="font-size:9pt;color:#aaa;margin-top:8px">La proposta appare qui sotto</div></div>' : '';

    var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.pg{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.hdr{background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}.hdr .t{font-size:13pt;font-weight:700;color:white}.hdr .s{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.hdr .d{font-size:8.5pt;color:rgba(255,255,255,0.4)}.lb{border-left:5px solid #E8001C;background:white;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}.lb .n{font-size:12pt;font-weight:700;margin-bottom:4px}.lb .i{font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap}.bd{padding:18px 26px 26px}.az{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee}.btn{padding:9px 18px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}.btn:disabled{opacity:0.5;cursor:not-allowed}.br{background:#E8001C;color:white}.bk{background:#111;color:white}.bg{background:#2e7d32;color:white}.bgy{background:#f0f0f0;color:#555}#cp{display:none;background:#fff9e6;border:1px solid #ffe082;border-radius:8px;padding:12px 16px;margin-bottom:14px}.cr{display:flex;gap:8px;align-items:center;margin-top:8px}#ci{flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:10pt}@media print{.az{display:none}body{background:white}.pg{box-shadow:none;border-radius:0;margin:0}}';

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - '+nome+'</title><style>'+css+'</style></head><body>' +
      '<div class="pg"><div class="hdr"><div><div class="t">Analisi Digitale Prevendita</div><div class="s">Lead Agent - Pagine Si!</div></div><div class="d">'+oggi+'</div></div>' +
      '<div class="lb"><div class="n">'+nome+'</div><div class="i"><span>'+(lead.indirizzo||'')+'</span>'+(web?'<span>Sito: <a href="'+web+'" target="_blank" style="color:#1565c0">'+web+'</a></span>':'<span style="color:#c62828">Nessun sito</span>')+'<span>Rating: '+(rating?rating+'/5 ('+nRating+' rec.)':'N/D')+'</span><span>'+categoria+' '+citta+'</span></div></div>' +
      '<div class="bd">' +
      '<div class="az">' +
      '<button class="btn br" onclick="window.print()">Stampa / PDF</button>' +
      '<button class="btn bk" id="bp" onclick="toggleCP()">Genera Proposta</button>' +
      '<button class="btn bg" id="ba" onclick="apriAnt()">Anteprima Sito</button>' +
      '<button class="btn bgy" onclick="window.close()">Chiudi</button>' +
      '</div>' +
      '<div id="cp"><div style="font-size:10pt;font-weight:600;color:#795548">Nome consulente:</div><div class="cr"><input id="ci" type="text" placeholder="Nome Cognome"><button class="btn bk" onclick="genProp()">Genera</button><button class="btn bgy" onclick="toggleCP()">Annulla</button></div></div>' +
      body +
      '<div style="margin-top:32px;padding:20px 0;text-align:center" class="no-print">' +
      '<button id="btn-gen-prop" onclick="richiediProp()" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>' +
      '<div style="font-size:9pt;color:#aaa;margin-top:8px">La proposta apparira qui sotto basata sull analisi appena eseguita</div>' +
      '</div>' +
      '<div id="prop-container"></div>' +
      '</div></div>' +
      '<script>var B="https://leadagent-backend.onrender.com";var L='+leadJson+';' +
      'function mostraP(){var s=document.getElementById("prop-sec");if(s){s.style.display="block";setTimeout(function(){s.scrollIntoView({behavior:"smooth"});},100);}var b=document.getElementById("btn-prop");if(b)b.parentNode.style.display="none";}' +
      '</script></body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// Proposta inline - blocco HTML preventivo da appendere all'analisi
app.post('/proposta-inline', async function(req, res) {
  try {
    var lead = req.body.lead;
    var consulente = req.body.consulente || 'Consulente Pagine Si!';
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    var proposalMod = require('./proposal');
    var fatturato = proposalMod.stimaFatturato(lead);
    var analisi = proposalMod.analisiDigitale(lead);
    var analisiReale = req.body.analisi || {};

    // Arricchisci analisi con dati reali
    if (analisiReale.pos_google && analisiReale.pos_google !== 'non trovato') {
      var posNum = parseInt(analisiReale.pos_google.replace('#',''));
      if (posNum > 30) analisi.bisogni.seo = true;
    } else if (!lead.web) {
      analisi.bisogni.seo = false; // senza sito prima serve il sito
    }
    if (analisiReale.social_fb === 'assente' && analisiReale.social_ig === 'assente') {
      analisi.bisogni.social = true;
    }
    if (analisiReale.rec_perc !== undefined && analisiReale.rec_perc < 30) {
      analisi.bisogni.reputazione = true;
    }
    if (analisiReale.pos_maps && analisiReale.pos_maps !== 'non trovato') {
      var mapsNum = parseInt(analisiReale.pos_maps.replace('#',''));
      if (mapsNum > 5) analisi.bisogni.gbp = true;
    }

    var prodotti = proposalMod.costruisciPreventivo(lead, fatturato, analisi);
    var PRODOTTI = proposalMod.PRODOTTI;

    var oggi = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var scadenza = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var totAnno1 = prodotti.reduce(function(s,p){ return s+(p.anno1||0); }, 0);
    var totMens = prodotti.reduce(function(s,p){ return s+(p.mens||0); }, 0);

    var prodJson = JSON.stringify(prodotti);
    var listinoJson = JSON.stringify(PRODOTTI);

    var righe = prodotti.map(function(p,i){
      return '<tr id="pr-'+i+'" data-a1="'+(p.anno1||0)+'" data-mn="'+(p.mens||0)+'" style="border-bottom:1px solid #f0f0f0">' +
        '<td style="padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>' +
        '<td style="padding:9px 11px"><div style="font-weight:600;margin-bottom:2px" contenteditable="true">'+p.nome+'</div><div style="font-size:8.5pt;color:#777" contenteditable="true">'+p.desc+'</div><div style="font-size:8pt;color:#aaa;font-style:italic" contenteditable="true">'+p.motivazione+'</div></td>' +
        '<td style="padding:9px 11px"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt">'+p.cat+'</span></td>' +
        '<td style="padding:9px 11px;text-align:right;font-weight:600;white-space:nowrap">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>' +
        '<td style="padding:9px 11px;text-align:right;font-weight:600;white-space:nowrap">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>' +
        '<td style="padding:9px 11px;text-align:center;width:30px"><button onclick="rimuoviPr('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px;padding:3px 6px" class="no-print">&#10005;</button></td>' +
        '</tr>';
    }).join('');

    var html = '<div id="proposta-inline-wrap" style="margin-top:32px">' +
      '<hr style="border:none;border-top:3px solid #E8001C;margin-bottom:24px">' +
      '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #E8001C">Proposta Commerciale</div>' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:6px;font-size:9pt;color:#aaa">' +
      '<span>Consulente: <strong style="color:#1a1a1a">'+consulente+'</strong></span>' +
      '<span>Data: '+oggi+'</span><span>Valida fino al: '+scadenza+'</span></div>' +
      '<div style="background:#fff9e6;border:1px solid #ffe082;border-radius:7px;padding:9px 14px;margin-bottom:14px;font-size:9.5pt;color:#795548" class="no-print">&#9999;&#65039; Clicca sui testi per modificarli &middot; &#10005; per rimuovere righe</div>' +
      '<table id="pr-tbl" style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt">' +
      '<thead><tr style="background:#111;color:white"><th style="padding:9px 11px;text-align:left;font-size:8.5pt;font-weight:500">Sigla</th><th style="padding:9px 11px;text-align:left;font-size:8.5pt;font-weight:500">Prodotto</th><th style="padding:9px 11px;text-align:left;font-size:8.5pt;font-weight:500">Area</th><th style="padding:9px 11px;text-align:right;font-size:8.5pt;font-weight:500">Anno 1</th><th style="padding:9px 11px;text-align:right;font-size:8.5pt;font-weight:500">Mensile</th><th class="no-print" style="width:30px"></th></tr></thead>' +
      '<tbody>'+righe+'</tbody>' +
      '<tfoot class="no-print"><tr><td colspan="6" style="padding:8px 11px;border-top:2px dashed #f0f0f0;background:#fafafa">' +
      '<button onclick="apriListino()" style="padding:5px 12px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer">&#65291; Aggiungi dal listino</button>' +
      '</td></tr></tfoot></table>' +
      '<div style="background:#111;color:white;border-radius:8px;padding:18px 22px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:16px">' +
      '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Investimento Anno 1</div><div style="font-size:18pt;font-weight:800;color:#E8001C" id="pr-tot1">&euro; '+totAnno1.toLocaleString('it-IT')+'</div><div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>' +
      '<div style="width:1px;height:40px;background:rgba(255,255,255,0.1)"></div>' +
      '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Canone Mensile</div><div style="font-size:18pt;font-weight:800;color:#E8001C" id="pr-totm">&euro; '+totMens+'<span style="font-size:11pt;color:rgba(255,255,255,0.4)">/mese</span></div></div>' +
      '<div style="width:1px;height:40px;background:rgba(255,255,255,0.1)"></div>' +
      '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Soluzioni</div><div style="font-size:18pt;font-weight:800" id="pr-num">'+prodotti.length+'</div></div>' +
      '</div>' +
      '<div style="font-size:8.5pt;color:#bbb;text-align:center">Pagine Si! SpA &middot; paginesispa.it &middot; Prezzi IVA esclusa</div>' +
      '</div>' +
      '<div id="listino-overlay" onclick="if(event.target===this)chiudiListino()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">' +
      '<div style="background:#fff;border-radius:14px;width:660px;max-width:95vw;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2)">' +
      '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:700">Aggiungi servizio</div><button onclick="chiudiListino()" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer">&#10005;</button></div>' +
      '<div id="listino-body" style="overflow-y:auto;padding:16px 18px;flex:1"></div>' +
      '<div style="padding:10px 18px;border-top:1px solid #eee;background:#f9f9f9;display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;color:#aaa">Seleziona un servizio</span><button id="btn-add-ok" onclick="aggiungiDaListino()" disabled style="padding:7px 16px;background:#E8001C;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;opacity:0.4">Aggiungi</button></div>' +
      '</div></div>' +
      '<script>' +
      'var chr_tr="tr";var _LISTINO='+listinoJson+';var _selSigla=null;' +
      'function rimuoviPr(i){var r=document.getElementById("pr-"+i);if(r){r.remove();aggiornaTot();}}' +
      'function aggiornaTot(){var a=0,m=0,n=0;document.querySelectorAll("#pr-tbl tbody tr").forEach(function(t){a+=parseFloat(t.dataset.a1||0);m+=parseFloat(t.dataset.mn||0);n++;});document.getElementById("pr-tot1").innerHTML="&euro; "+a.toLocaleString("it-IT");document.getElementById("pr-totm").innerHTML="&euro; "+m+"/mese";document.getElementById("pr-num").textContent=n;}' +
      'function apriListino(){' +
      '  var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM"],"Directory":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Automation":["Si4BLD","Si4BEN"]};' +
      '  var h="";' +
      '  for(var cat in cats){' +
      '    h+="<div style=\"margin-bottom:14px\"><div style=\"font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px\">"+cat+"</div><div style=\"display:flex;flex-wrap:wrap;gap:4px\">";' +
      '    cats[cat].forEach(function(s){' +
      '      var p=_LISTINO[s];if(!p)return;' +
      '      var pr=p.mens?("&euro;"+p.mens+"/mese"):(p.anno1?("&euro;"+p.anno1+"/anno"):"");' +
      '      var btn=document.createElement("button");' +
      '      btn.id="lc-"+s;btn.dataset.sigla=s;' +
      '      btn.onclick=function(){selS(this,this.dataset.sigla);};' +
      '      btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";' +
      '      btn.innerHTML="<b style=\"font-family:monospace;color:#E8001C\">"+s+"</b> "+p.nome+" <span style=\"opacity:0.5;font-size:9px\">"+pr+"</span>";' +
      '      h+=btn.outerHTML;' +
      '    });' +
      '    h+="</div></div>";' +
      '  }' +
      '  document.getElementById("listino-body").innerHTML=h;' +
      '  document.getElementById("listino-overlay").style.display="flex";' +
      '}' +
'function selS(el,s){document.querySelectorAll("[id^=lc-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_selSigla=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";var b=document.getElementById("btn-add-ok");if(b){b.disabled=false;b.style.opacity="1";}}' +
      'function aggiungiDaListino(){' +
      '  if(!_selSigla)return;' +
      '  var p=_LISTINO[_selSigla];if(!p)return;' +
      '  var tb=document.querySelector("#pr-tbl tbody");' +
      '  var id="ex"+Date.now();' +
      '  var tr=document.createElement("tr");' +
      '  tr.id="pr-"+id;tr.dataset.a1=p.anno1||0;tr.dataset.mn=p.mens||0;' +
      '  tr.style.borderBottom="1px solid #f0f0f0";' +
      '  tr.innerHTML=' +
      '    "<td style=\"padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600\">"+_selSigla+"</td>" +' +
      '    "<td style=\"padding:9px 11px\"><div contenteditable=\"true\" style=\"font-weight:600;margin-bottom:2px\">"+p.nome+"</div><div contenteditable=\"true\" style=\"font-size:8.5pt;color:#777\">"+p.desc+"</div></td>" +' +
      '    "<td style=\"padding:9px 11px\"><span style=\"background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt\">"+p.cat+"</span></td>" +' +
      '    "<td style=\"padding:9px 11px;text-align:right;font-weight:600\">"+(p.anno1?"&euro; "+p.anno1.toLocaleString("it-IT"):"&mdash;")+"</td>" +' +
      '    "<td style=\"padding:9px 11px;text-align:right;font-weight:600\">"+(p.mens?"&euro; "+p.mens+"/mese":"&mdash;")+"</td>" +' +
      '    "<td style=\"padding:9px 11px;text-align:center\"><button onclick=\"this.closest(String.fromCharCode(39)+chr_tr+String.fromCharCode(39)).remove();aggiornaTot()\" style=\"background:none;border:none;cursor:pointer;color:#ccc;font-size:13px;padding:3px 6px\">&#10005;</button></td>";' +
      '  tb.appendChild(tr);aggiornaTot();chiudiListino();_selSigla=null;' +
      '}' +
'function chiudiListino(){document.getElementById("listino-overlay").style.display="none";}' +
      '</script>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});



app.post('/analisi-html', async function(req, res) {
  try {
    var lead = typeof req.body.lead === 'string' ? JSON.parse(req.body.lead) : req.body.lead;
    if (!lead) return res.status(400).send('<html><body>Lead mancante</body></html>');

    var nome = lead.nome || '';
    var categoria = lead.categoria || '';
    var citta = lead.citta || '';
    var web = (lead.web && lead.web !== 'N/D') ? lead.web : null;
    var nRating = lead.nRating || 0;
    var rating = lead.rating || null;
    var nomeNorm = nome.toLowerCase().trim();
    var webNorm = web ? web.toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0] : null;

    // Invia subito una loading page mentre elabora
    // (non possiamo fare streaming facile, ma il browser mostra spinner nella tab)

    // 1. Avvia task recensioni subito
    var recTaskId = null;
    try {
      var payload = [{ depth: 50, sort_by: 'newest', location_code: 2380, language_code: 'it' }];
      if (lead.placeId) { payload[0].place_id = lead.placeId; } else { payload[0].keyword = nome + ' ' + citta; }
      var postResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
        method: 'POST',
        headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var postData = await postResp.json();
      recTaskId = postData.tasks && postData.tasks[0] && postData.tasks[0].id;
    } catch(e) {}

    // 2. Ricerche in parallelo
    var risultati = await Promise.all([
      cercaPosizioneGoogle(nome, web, categoria, citta),
      cercaSocial(nome, citta)
    ]);
    var seo = risultati[0];
    var social = risultati[1];
    var serpItems = (seo && seo.items) || [];
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);

    // 3. Competitor
    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);
    var competitor = mapsData.competitor;
    var mapsPos = mapsData.posizione_maps_lead;

    // 4. Raccogli recensioni
    var recensioni = null;
    if (recTaskId) {
      for (var attempt = 0; attempt < 4; attempt++) {
        await new Promise(function(r){ setTimeout(r, 2500); });
        try {
          var getResp = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/' + recTaskId, {
            headers: { 'Authorization': dfsAuth() }
          });
          var getData = await getResp.json();
          var task = getData.tasks && getData.tasks[0];
          if (task && task.status_code === 20000 && task.result && task.result[0]) {
            var result = task.result[0];
            var items = result.items || [];
            var totale = nRating || result.reviews_count || items.length;
            var risposte = items.filter(function(r){ return !!r.owner_answer; }).length;
            var pos = items.filter(function(r){ return r.rating && r.rating.value >= 4; }).length;
            var neg = items.filter(function(r){ return r.rating && r.rating.value <= 2; }).length;
            recensioni = {
              totale_recensioni: totale, campione: items.length,
              con_risposta: risposte,
              perc_risposta: items.length > 0 ? Math.round((risposte/items.length)*100) : 0,
              positive: pos, negative: neg,
              testi: items.slice(0,20).map(function(r){ return { rating: r.rating&&r.rating.value, testo: r.review_text||'', ha_risposta: !!r.owner_answer, time_ago: r.time_ago||'' }; }),
              ultima: items[0] ? { rating: items[0].rating&&items[0].rating.value, testo: items[0].review_text||'', ha_risposta: !!items[0].owner_answer, time_ago: items[0].time_ago||'' } : null
            };
            break;
          }
        } catch(e) {}
      }
    }

    // 5. Visibilita AI
    var ai = await calcolaAI(nome, citta, web, social, nRating, rating, seo);

    // 6. Analisi Claude (prompt corto per stare nei tempi)
    var strategia = null;
    try {
      var recTesti = recensioni && recensioni.testi ? recensioni.testi.slice(0,8).map(function(r){ return (r.rating||'?')+'/5: '+r.testo.slice(0,70); }).join(' | ') : 'nessuna';
      var datiStr = 'Attivita: '+nome+' ('+categoria+' '+citta+'). Sito: '+(web||'assente')+'. Rating: '+(rating||'N/D')+'/5 ('+nRating+' rec). Google "'+keyword+'": '+(seo&&seo.posizione?'#'+seo.posizione:'non trovato')+'. Maps: '+(mapsPos?'#'+mapsPos:'non trovato')+'. FB: '+(social.facebook?'si':'no')+'. IG: '+(social.instagram?'si':'no')+'. Risposte rec: '+(recensioni?recensioni.perc_risposta+'%':'N/D')+' su '+(recensioni?recensioni.campione:0)+' ('+( recensioni?recensioni.positive+' pos, '+recensioni.negative+' neg':'')+  '). Rec: '+recTesti+'. Competitor: '+competitor.map(function(c){ return c.nome+' Maps#'+c.posizione_maps+' '+(c.rating||'N/D')+'/5'; }).join(', ');
      var prompt = 'Sei un digital marketing strategist per PMI italiane. Dati: '+datiStr+'. Scrivi max 300 parole con **Titolo** per: **Situazione Attuale** **Analisi Recensioni** **Obiettivi 90gg** **Obiettivi 6 mesi** **Strategia Social** **Priorita Intervento**';
      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        strategia = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
      }
    } catch(e) {}

    // Richiama /analisi per generare l'HTML (riuso la logica esistente)
    // In realta usiamo lo stesso codice di /analisi ma restituiamo HTML direttamente
    var req2 = { body: { lead: lead } };
    var htmlResult = null;
    // Simuliamo chiamata interna
    var fakeRes = {
      _html: null,
      json: function(d){ this._html = d.html; }
    };

    // Costruiamo l'HTML direttamente qui con tutti i dati gia pronti
    var oggi = new Date().toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
    var sec = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var box = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 18px;margin-bottom:8px';
    var body = '';

    // POSIZIONAMENTO
    var gPos = seo && seo.posizione;
    var gColor = gPos ? (gPos<=10?'#2e7d32':gPos<=30?'#e65100':'#c62828') : '#c62828';
    var gLabel = gPos ? '#'+gPos : (seo&&seo.no_sito?'Nessun sito':'N/T');
    var mColor = mapsPos ? (mapsPos<=3?'#2e7d32':mapsPos<=7?'#e65100':'#c62828') : '#9e9e9e';
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Posizionamento - '+keyword+'</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div><div style="font-size:2.6rem;font-weight:800;color:'+gColor+'">'+gLabel+'</div><div style="font-size:8.5pt;color:'+gColor+';font-weight:600;margin-top:4px">'+(gPos?(gPos<=10?'Prima pagina':gPos<=30?'Pagine 2-3':'Oltre pag. 3'):(seo&&seo.no_sito?'Senza sito':'Non trovato'))+'</div>'+(seo&&seo.url?'<div style="font-size:8pt;margin-top:5px"><a href="'+seo.url+'" target="_blank" style="color:#1565c0">'+seo.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,35)+'</a></div>':'')+'</div>';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div><div style="font-size:2.6rem;font-weight:800;color:'+mColor+'">'+(mapsPos?'#'+mapsPos:'N/T')+'</div><div style="font-size:8.5pt;color:'+mColor+';font-weight:600;margin-top:4px">'+(mapsPos?(mapsPos<=3?'Top 3':'Posizione '+mapsPos):'Non in lista')+'</div></div>';
    body += '</div></div>';

    // PRESENZA DIGITALE
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Presenza Digitale</div><div style="display:flex;gap:10px;flex-wrap:wrap">';
    [{label:'Sito Web',val:web?'Presente':'Assente',ok:!!web,link:web},{label:'Google Maps',val:nRating>0?nRating+' rec.':'Assente',ok:nRating>=20},{label:'Rating',val:rating?rating+'/5':'N/D',ok:rating>=4.0},{label:'Facebook',val:social.facebook?(social.facebook_follower||'Trovato'):'Assente',ok:!!social.facebook,link:social.facebook},{label:'Instagram',val:social.instagram?(social.instagram_follower||'Trovato'):'Assente',ok:!!social.instagram,link:social.instagram}].forEach(function(item){
      var bg=item.ok?'#e8f5e9':'#fce8e8',col=item.ok?'#2e7d32':'#c62828';
      body += '<div style="flex:1;min-width:100px;background:'+bg+';border-radius:8px;padding:12px;text-align:center"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:5px">'+item.label+'</div>'+(item.link?'<a href="'+item.link+'" target="_blank" style="font-size:9.5pt;font-weight:700;color:'+col+';text-decoration:none">'+item.val+'</a>':'<div style="font-size:9.5pt;font-weight:700;color:'+col+'">'+item.val+'</div>')+'</div>';
    });
    body += '</div></div>';

    // RECENSIONI
    if (recensioni) {
      var pColor=recensioni.perc_risposta>=70?'#2e7d32':recensioni.perc_risposta>=30?'#e65100':'#c62828';
      var pLabel=recensioni.perc_risposta>=70?'Buona gestione':recensioni.perc_risposta>=30?'Gestione parziale':'Scarsa gestione';
      var stars5=['&#9733;&#9733;&#9733;&#9733;&#9733;','&#9733;&#9733;&#9733;&#9733;&#9734;','&#9733;&#9733;&#9733;&#9734;&#9734;','&#9733;&#9733;&#9734;&#9734;&#9734;','&#9733;&#9734;&#9734;&#9734;&#9734;'];
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Gestione Recensioni</div>';
      body += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">% Risposte</div><div style="font-size:2rem;font-weight:800;color:'+pColor+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+pColor+';font-weight:600;margin-top:3px">'+pLabel+'</div></div>';
      body += '<div style="flex:1;min-width:100px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Pos/Neg</div><div style="font-size:1.6rem;font-weight:800"><span style="color:#2e7d32">'+recensioni.positive+'</span> / <span style="color:#c62828">'+recensioni.negative+'</span></div><div style="font-size:8pt;color:#aaa;margin-top:3px">su '+recensioni.campione+' analizzate</div></div>';
      body += '</div>';
      if (recensioni.ultima && recensioni.ultima.testo) {
        var ur=recensioni.ultima,sColor=ur.rating>=4?'#2e7d32':ur.rating>=3?'#e65100':'#c62828';
        var stH=ur.rating?stars5[Math.max(0,5-Math.round(ur.rating))]:'';
        body += '<div style="'+box+'"><div style="font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px">Ultima recensione'+(ur.time_ago?' ('+ur.time_ago+')':'')+'</div>';
        if (stH) body += '<div style="font-size:10pt;color:'+sColor+';margin-bottom:5px">'+stH+'</div>';
        body += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+ur.testo.slice(0,280).replace(/[<>]/g,'')+(ur.testo.length>280?'...':'')+'&quot;</div>';
        body += '<div style="font-size:8.5pt;margin-top:6px;font-weight:600;color:'+(ur.ha_risposta?'#2e7d32':'#c62828')+'">'+(ur.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div></div>';
      }
      body += '</div>';
    }

    // COMPETITOR
    if (competitor && competitor.length) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Competitor di Zona</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt"><thead><tr style="background:#111;color:white"><th style="padding:9px 10px;text-align:left">Attivita</th><th style="padding:9px 10px;text-align:center">Maps</th><th style="padding:9px 10px;text-align:center">Google</th><th style="padding:9px 10px;text-align:center">Rating</th><th style="padding:9px 10px;text-align:center">Rec.</th><th style="padding:9px 10px;text-align:center">% Risp.</th><th style="padding:9px 10px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,i){
        var bg=i%2===0?'white':'#fafafa';
        body += '<tr style="background:'+bg+';border-bottom:1px solid #f0f0f0"><td style="padding:9px 10px;font-weight:600">'+c.nome+(c.sito_dom?'<br><span style="font-size:8pt;color:#1565c0">'+c.sito_dom+'</span>':'')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.posizione_serp?'<span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>/5':'N/D')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+c.n_recensioni+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.rec_comp?'<span style="font-weight:700;color:'+(c.rec_comp.perc>=70?'#2e7d32':c.rec_comp.perc>=30?'#e65100':'#c62828')+'">'+c.rec_comp.perc+'%</span>':'<span style="color:#aaa">N/D</span>')+'</td>';
        body += '<td style="padding:9px 10px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td></tr>';
      });
      body += '</tbody></table></div></div>';
    }

    // SOCIAL
    if (social.facebook || social.instagram) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) body += '<div style="flex:1;min-width:160px;border:1px solid #1877f2;border-radius:10px;overflow:hidden"><div style="background:#1877f2;padding:9px 14px"><span style="color:white;font-weight:700">Facebook</span></div><div style="padding:12px 14px">'+(social.facebook_follower?'<div style="font-size:1.3rem;font-weight:800;color:#1877f2;margin-bottom:5px">'+social.facebook_follower+'</div>':'')+'<a href="'+social.facebook+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      if (social.instagram) body += '<div style="flex:1;min-width:160px;border:1px solid #e1306c;border-radius:10px;overflow:hidden"><div style="background:#e1306c;padding:9px 14px"><span style="color:white;font-weight:700">Instagram</span></div><div style="padding:12px 14px">'+(social.instagram_follower?'<div style="font-size:1.3rem;font-weight:800;color:#e1306c;margin-bottom:5px">'+social.instagram_follower+'</div>':'')+'<a href="'+social.instagram+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      body += '</div></div>';
    } else {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="'+box+';border-left:4px solid #c62828"><div style="color:#c62828;font-weight:600;margin-bottom:4px">Nessun profilo social trovato</div></div></div>';
    }

    // VISIBILITA AI
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div><div style="display:flex;gap:14px;flex-wrap:wrap">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:110px"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa;margin-top:3px">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:10px">Le AI generative citano le attivita presenti su fonti autorevoli (Maps, TripAdvisor, sito, social, stampa). Piu fonti = piu visibilita per "'+categoria+' a '+citta+'".</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    (ai.fonti||[]).forEach(function(f){ body += '<div style="display:flex;align-items:center;gap:6px;font-size:9pt"><span style="color:'+(f.ok?'#2e7d32':'#c62828')+';font-weight:700">'+(f.ok?'&#10003;':'&#10007;')+'</span><span style="color:'+(f.ok?'#2e7d32':'#c62828')+'">'+f.label+'</span></div>'; });
    body += '</div></div></div></div>';

    // ANALISI STRATEGICA
    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div><div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7"><p style="margin-bottom:10px">'+strategia+'</p></div></div>';
    }

    // GENERA PROPOSTA
    var leadJson = JSON.stringify({ nome:nome, indirizzo:lead.indirizzo||'', web:web||null, telefono:lead.telefono||null, tipi:lead.tipi||[], rating:rating, nRating:nRating, descrizione:lead.descrizione||null, placeId:lead.placeId||null, categoria:categoria, citta:citta, logoUrl:lead.logoUrl||null });
    var analisiDati = JSON.stringify({ pos_google: seo&&seo.posizione?'#'+seo.posizione:'non trovato', pos_maps: mapsPos?'#'+mapsPos:'non trovato', social_fb: social.facebook?'presente':'assente', social_ig: social.instagram?'presente':'assente', rec_perc: recensioni?recensioni.perc_risposta:0, rec_pos: recensioni?recensioni.positive:0, rec_neg: recensioni?recensioni.negative:0, competitor_sito: competitor.filter(function(c){return c.ha_sito;}).length });
    body += '<div style="margin-top:32px;padding:20px 0;text-align:center" class="no-print">';
    body += '<button id="btn-gen-prop" onclick="richiediProp()" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>';
    body += '<div style="font-size:9pt;color:#aaa;margin-top:8px">Il preventivo si aggiunge qui sotto</div></div>';
    body += '<div id="prop-container"></div>';


    // Proposta generata lato server
    var propostaHtml = '';
    try {
      var pMod = require('./proposal');
      var fat = pMod.stimaFatturato(lead);
      var anBase = pMod.analisiDigitale(lead);
      anBase.bisogni = anBase.bisogni || {};
      if (!seo || !seo.posizione || seo.posizione > 30) anBase.bisogni.seo = true;
      if (!social.facebook && !social.instagram) anBase.bisogni.social = true;
      if (recensioni && recensioni.perc_risposta < 30) anBase.bisogni.reputazione = true;
      var prods = pMod.costruisciPreventivo(lead, fat, anBase);
      var PROD = pMod.PRODOTTI;
      var ogP = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var scP = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var t1 = prods.reduce(function(s,p){return s+(p.anno1||0);},0);
      var tM = prods.reduce(function(s,p){return s+(p.mens||0);},0);
      var lj = JSON.stringify(PROD);
      var rr = prods.map(function(p,i){
        return '<tr data-a1="'+(p.anno1||0)+'" data-mn="'+(p.mens||0)+'" style="border-bottom:1px solid #f0f0f0">'+
          '<td style="padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>'+
          '<td style="padding:9px 11px"><div contenteditable="true" style="font-weight:600;margin-bottom:2px">'+p.nome+'</div>'+
          '<div contenteditable="true" style="font-size:8.5pt;color:#777">'+p.desc+'</div>'+
          '<div contenteditable="true" style="font-size:8pt;color:#aaa;font-style:italic">'+p.motivazione+'</div></td>'+
          '<td style="padding:9px 11px"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt">'+p.cat+'</span></td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:center;width:28px"><button onclick="rmRiga(this)" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px">&#10005;</button></td>'+
          '</tr>';
      }).join('');
      propostaHtml =
        '<div id="prop-sec" style="display:none">'+
        '<hr style="border:none;border-top:3px solid #E8001C;margin:32px 0 24px">'+
        '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #E8001C">Proposta Commerciale</div>'+
        '<div style="font-size:9pt;color:#aaa;margin-bottom:10px">Consulente: <strong contenteditable="true" style="color:#1a1a1a">Consulente Pagine Si!</strong> &middot; '+ogP+' &middot; Valida: '+scP+'</div>'+
        '<div style="background:#fff9e6;border:1px solid #ffe082;border-radius:7px;padding:9px 14px;margin-bottom:14px;font-size:9.5pt;color:#795548">Clicca sui testi per modificarli</div>'+
        '<table id="ptbl" style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt">'+
        '<thead><tr style="background:#111;color:white">'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Sigla</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Prodotto</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Area</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Anno 1</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Mensile</th>'+
        '<th style="width:28px"></th></tr></thead>'+
        '<tbody>'+rr+'</tbody>'+
        '<tfoot><tr><td colspan="6" style="padding:8px 11px;border-top:2px dashed #f0f0f0;background:#fafafa">'+
        '<button onclick="apriLP()" style="padding:5px 12px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer">+ Aggiungi dal listino</button>'+
        '</td></tr></tfoot></table>'+
        '<div style="background:#111;color:white;border-radius:8px;padding:16px 22px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px">'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Anno 1</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="pt1">&euro; '+t1.toLocaleString('it-IT')+'</div>'+
        '<div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Mensile</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="ptm">&euro; '+tM+'<span style="font-size:10pt;color:rgba(255,255,255,0.4)">/mese</span></div></div></div>'+
        '<div style="font-size:8.5pt;color:#bbb;text-align:center;margin-bottom:20px">Pagine Si! SpA &middot; paginesispa.it &middot; IVA esclusa</div>'+
        '<div id="lp-ov" onclick="if(event.target===this)chiudiLP()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">'+
        '<div style="background:#fff;border-radius:14px;width:660px;max-width:95vw;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'+
        '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:700">Aggiungi servizio</div><button onclick="chiudiLP()" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer">&#10005;</button></div>'+
        '<div id="lp-body" style="overflow-y:auto;padding:16px 18px;flex:1"></div>'+
        '<div style="padding:10px 18px;border-top:1px solid #eee;background:#f9f9f9;display:flex;justify-content:space-between;align-items:center">'+
        '<span style="font-size:10px;color:#aaa">Seleziona</span>'+
        '<button id="lp-ok" onclick="aggLP()" disabled style="padding:7px 16px;background:#E8001C;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;opacity:0.4">Aggiungi</button>'+
        '</div></div></div>'+
        '<script>var _LP='+lj+';var _LS=null;'+
        'function rmRiga(b){var tr=b.closest("tr");if(tr){tr.remove();updT();}}'+
        'function updT(){var a=0,m=0;document.querySelectorAll("#ptbl tbody tr").forEach(function(r){a+=parseFloat(r.dataset.a1||0);m+=parseFloat(r.dataset.mn||0);});var e1=document.getElementById("pt1"),em=document.getElementById("ptm");if(e1)e1.textContent=a.toLocaleString("it-IT");if(em)em.textContent=m;}'+
        'function apriLP(){var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM","Si2VN-PM"],"Directory":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Automation":["Si4BLD","Si4BEN"]};'+
        'var bd=document.getElementById("lp-body");bd.innerHTML="";'+
        'for(var c in cats){var w=document.createElement("div");w.style.marginBottom="14px";var lb=document.createElement("div");lb.style.cssText="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px";lb.textContent=c;w.appendChild(lb);var rw=document.createElement("div");rw.style.cssText="display:flex;flex-wrap:wrap;gap:4px";cats[c].forEach(function(s){var p=_LP[s];if(!p)return;var pr=p.mens?("\u20ac"+p.mens+"/mese"):(p.anno1?("\u20ac"+p.anno1+"/anno"):"");var btn=document.createElement("button");btn.id="lc-"+s;btn.dataset.s=s;btn.onclick=function(){selLP(this,this.dataset.s);};btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";var b=document.createElement("b");b.style.cssText="font-family:monospace;color:#E8001C";b.textContent=s;btn.appendChild(b);btn.appendChild(document.createTextNode(" "+p.nome+" "+pr));rw.appendChild(btn);});w.appendChild(rw);bd.appendChild(w);}'+
        'document.getElementById("lp-ov").style.display="flex";}'+
        'function selLP(el,s){document.querySelectorAll("[id^=lc-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_LS=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";var b=document.getElementById("lp-ok");if(b){b.disabled=false;b.style.opacity="1";}}'+
        'function aggLP(){if(!_LS)return;var p=_LP[_LS];if(!p)return;var tb=document.querySelector("#ptbl tbody");var tr=document.createElement("tr");tr.dataset.a1=p.anno1||0;tr.dataset.mn=p.mens||0;tr.style.borderBottom="1px solid #f0f0f0";function mkTd(st){var td=document.createElement("td");td.style.cssText=st;return td;}var t0=mkTd("padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600");t0.textContent=_LS;var t1b=mkTd("padding:9px 11px");var dn=document.createElement("div");dn.contentEditable="true";dn.style.cssText="font-weight:600;margin-bottom:2px";dn.textContent=p.nome;var dd=document.createElement("div");dd.contentEditable="true";dd.style.cssText="font-size:8.5pt;color:#777";dd.textContent=p.desc;t1b.appendChild(dn);t1b.appendChild(dd);var t2=mkTd("padding:9px 11px");var sp=document.createElement("span");sp.style.cssText="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt";sp.textContent=p.cat;t2.appendChild(sp);var t3=mkTd("padding:9px 11px;text-align:right;font-weight:600");t3.textContent=p.anno1?"\u20ac "+p.anno1.toLocaleString("it-IT"):"\u2014";var t4=mkTd("padding:9px 11px;text-align:right;font-weight:600");t4.textContent=p.mens?"\u20ac "+p.mens+"/mese":"\u2014";var t5=mkTd("padding:9px 11px;text-align:center;width:28px");var rb=document.createElement("button");rb.onclick=function(){rmRiga(this);};rb.style.cssText="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px";rb.innerHTML="&#10005;";t5.appendChild(rb);[t0,t1b,t2,t3,t4,t5].forEach(function(t){tr.appendChild(t);});tb.appendChild(tr);updT();chiudiLP();_LS=null;}'+
        'function chiudiLP(){document.getElementById("lp-ov").style.display="none";}<\/script>'+
        '</div>';
    } catch(propErr) { propostaHtml = ''; }
    var tastoP = propostaHtml ?
      '<div style="margin-top:32px;padding:20px 0;text-align:center" class="no-print">'+
      '<button id="btn-prop" onclick="mostraP()" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>'+
      '<div style="font-size:9pt;color:#aaa;margin-top:8px">La proposta appare qui sotto</div></div>' : '';

    var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.pg{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.hdr{background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}.t{font-size:13pt;font-weight:700;color:white}.s{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.d{font-size:8.5pt;color:rgba(255,255,255,0.4)}.lb{border-left:5px solid #E8001C;background:white;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}.n{font-size:12pt;font-weight:700;margin-bottom:4px}.info{font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap}.bd{padding:18px 26px 26px}.az{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee}.btn{padding:9px 18px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}.btn:disabled{opacity:0.5}.br{background:#E8001C;color:white}.bk{background:#111;color:white}.bg{background:#2e7d32;color:white}.bgy{background:#f0f0f0;color:#555}@media print{.az,.no-print{display:none}body{background:white}.pg{box-shadow:none;margin:0}}';

    var fullHtml = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - '+nome+'</title><style>'+css+'</style></head><body>' +
      '<div class="pg"><div class="hdr"><div><div class="t">Analisi Digitale Prevendita</div><div class="s">Lead Agent - Pagine Si!</div></div><div class="d">'+oggi+'</div></div>' +
      '<div class="lb"><div class="n">'+nome+'</div><div class="info"><span>'+(lead.indirizzo||'')+'</span>'+(web?'<span>Sito: <a href="'+web+'" target="_blank" style="color:#1565c0">'+web+'</a></span>':'<span style="color:#c62828">Nessun sito</span>')+'<span>Rating: '+(rating?rating+'/5 ('+nRating+' rec.)':'N/D')+'</span></div></div>' +
      '<div class="bd"><div class="az">' +
      '<button class="btn br" onclick="window.print()">Stampa / PDF</button>' +
      '<button class="btn bg" id="ba" onclick="apriAnt()">Anteprima Sito</button>' +
      '</div>' +
      body +
      tastoP +
      propostaHtml +
      '</div></div>' +
      '<script>' +
      'var B="https://leadagent-backend.onrender.com";' +
      'var L='+leadJson+';' +
      'var AD='+analisiDati+';' +
      'function richiediProp(){' +
      '  var btn=document.getElementById("btn-gen-prop");' +
      '  if(btn){btn.disabled=true;btn.textContent="Generazione in corso...";}' +
      '  var consulente=prompt("Nome del consulente:","") || "Consulente Pagine Si!";' +
      '  var cont=document.getElementById("prop-container");' +
      '  if(cont)cont.innerHTML="<div style=\"padding:32px;text-align:center;color:#aaa\">&#8987; Generazione proposta...</div>";' +
      '  fetch(B+"/proposta-inline",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:L,consulente:consulente,analisi:AD})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){if(d.html&&cont){cont.innerHTML=d.html;setTimeout(function(){cont.scrollIntoView({behavior:"smooth"});},200);if(btn){btn.textContent="Proposta generata";btn.style.background="#2e7d32";}}})' +
      '  .catch(function(e){if(cont)cont.innerHTML="";if(btn){btn.disabled=false;btn.textContent="Genera Proposta Commerciale";}});' +
      '}' +
      'function apriAnt(){' +
      '  var btn=document.getElementById("ba");if(btn){btn.disabled=true;btn.textContent="Generazione...";}' +
      '  fetch(B+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:L.nome,indirizzo:L.indirizzo,telefono:L.telefono,tipi:L.tipi,rating:L.rating,nRating:L.nRating,descrizione:L.descrizione,logoUrl:L.logoUrl})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){if(d.html){var w=window.open("","_blank");if(w){w.document.open();w.document.write(d.html);w.document.close();}}if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}})' +
      '  .catch(function(e){if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}});' +
      '}' +
      '</script></body></html>';

    res.send(fullHtml);
  } catch(err) {
    res.status(500).send('<html><body style="font-family:Arial;padding:2rem"><h2 style="color:#E8001C">Errore analisi</h2><p>'+err.message+'</p></body></html>');
  }
});



app.post('/analisi-loading', async function(req, res) {
  try {
    var lead = typeof req.body.lead === 'string' ? JSON.parse(req.body.lead) : req.body.lead;
    if (!lead) return res.status(400).send('<html><body>Lead mancante</body></html>');
    var leadJson = JSON.stringify(lead).replace(/</g,'\u003c').replace(/>/g,'\u003e');
    var nome = lead.nome || 'Attivita';

    var loadingHtml = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - '+nome+'</title>' +
      '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}' +
      '#loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f4f4f4}' +
      '.spinner{width:48px;height:48px;border:4px solid #eee;border-top-color:#E8001C;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:24px}' +
      '@keyframes spin{to{transform:rotate(360deg)}}' +
      '.bar-wrap{width:300px;height:4px;background:#e0e0e0;border-radius:2px;overflow:hidden;margin-top:20px}' +
      '.bar{height:4px;background:#E8001C;width:0;border-radius:2px;transition:width 40s linear}' +
      '#result{display:none}' +
      '</style></head><body>' +
      '<div id="loading"><div class="spinner"></div>' +
      '<div style="font-size:14pt;font-weight:700;color:#E8001C;margin-bottom:8px">Analisi in corso</div>' +
      '<div style="font-size:10pt;color:#777;margin-bottom:4px">Raccolta dati reali da Google e AI</div>' +
      '<div style="font-size:9pt;color:#aaa">20-40 secondi...</div>' +
      '<div class="bar-wrap"><div class="bar" id="bar"></div></div></div>' +
      '<div id="result"></div>' +
      '<script>' +
      'var L='+leadJson+';' +
      'var B="https://leadagent-backend.onrender.com";' +
      'setTimeout(function(){document.getElementById("bar").style.width="90%";},300);' +
      'fetch(B+"/analisi-compute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:L})})' +
      '.then(function(r){return r.json();})' +
      '.then(function(d){' +
      '  document.getElementById("loading").style.display="none";' +
      '  document.getElementById("result").style.display="block";' +
      '  document.getElementById("result").innerHTML=d.html;' +
      '  document.title="Analisi - "+L.nome;' +
      '})' +
      '.catch(function(e){' +
      '  document.getElementById("loading").innerHTML="<div style=\"color:#E8001C;font-size:14pt;font-weight:700\">Errore analisi</div><div style=\"margin-top:8px;color:#777\">"+e.message+"</div>";' +
      '});' +
      '</script></body></html>';

    res.send(loadingHtml);
  } catch(err) {
    res.status(500).send('<html><body>Errore: '+err.message+'</body></html>');
  }
});



app.post('/analisi-compute', async function(req, res) {
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

    // 1. Task recensioni
    var recTaskId = null;
    try {
      var payload = [{ depth: 50, sort_by: 'newest', location_code: 2380, language_code: 'it' }];
      if (lead.placeId) { payload[0].place_id = lead.placeId; } else { payload[0].keyword = nome + ' ' + citta; }
      var pr = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', { method:'POST', headers:{'Authorization':dfsAuth(),'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      var pd = await pr.json();
      recTaskId = pd.tasks && pd.tasks[0] && pd.tasks[0].id;
    } catch(e) {}

    // 2. Ricerche parallele
    var ris = await Promise.all([ cercaPosizioneGoogle(nome, web, categoria, citta), cercaSocial(nome, citta) ]);
    var seo = ris[0], social = ris[1], serpItems = (seo&&seo.items)||[];
    var keyword = (seo&&seo.keyword)||(categoria+' '+citta);
    var mapsData = await cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems);
    var competitor = mapsData.competitor, mapsPos = mapsData.posizione_maps_lead;

    // 3. Recensioni
    var recensioni = null;
    if (recTaskId) {
      for (var a=0; a<8; a++) {
        await new Promise(function(r){ setTimeout(r,2000); });
        try {
          var gr = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/'+recTaskId, { headers:{'Authorization':dfsAuth()} });
          var gd = await gr.json();
          var tk = gd.tasks&&gd.tasks[0];
          if (tk&&tk.status_code===20000&&tk.result&&tk.result[0]) {
            var res0=tk.result[0], its=res0.items||[];
            var risp=its.filter(function(r){return !!r.owner_answer;}).length;
            recensioni={ totale_recensioni:nRating||res0.reviews_count||its.length, campione:its.length, con_risposta:risp, perc_risposta:its.length>0?Math.round((risp/its.length)*100):0, positive:its.filter(function(r){return r.rating&&r.rating.value>=4;}).length, negative:its.filter(function(r){return r.rating&&r.rating.value<=2;}).length, testi:its.slice(0,20).map(function(r){return{rating:r.rating&&r.rating.value,testo:r.review_text||'',ha_risposta:!!r.owner_answer,time_ago:r.time_ago||''};}), ultima:its[0]?{rating:its[0].rating&&its[0].rating.value,testo:its[0].review_text||'',ha_risposta:!!its[0].owner_answer,time_ago:its[0].time_ago||''}:null };
            break;
          }
        } catch(e) {}
      }
    }

    // 4. Visibilita AI
    var ai = await calcolaAI(nome, citta, web, social, nRating, rating, seo);

    // 5. Claude
    var strategia = null;
    try {
      var recT = recensioni&&recensioni.testi?recensioni.testi.slice(0,8).map(function(r){return(r.rating||'?')+'/5: '+r.testo.slice(0,70);}).join(' | '):'nessuna';
      var datiStr = 'Attivita: '+nome+' ('+categoria+' '+citta+'). Sito: '+(web||'assente')+'. Rating: '+(rating||'N/D')+'/5 ('+nRating+' rec). Google: '+(seo&&seo.posizione?'#'+seo.posizione:'N/T')+'. Maps: '+(mapsPos?'#'+mapsPos:'N/T')+'. FB:'+(social.facebook?'si':'no')+' IG:'+(social.instagram?'si':'no')+'. Risp rec:'+(recensioni?recensioni.perc_risposta+'%':'N/D')+' pos:'+( recensioni?recensioni.positive:0)+' neg:'+(recensioni?recensioni.negative:0)+'. Rec: '+recT+'. Competitor: '+competitor.map(function(c){return c.nome+' Maps#'+c.posizione_maps+' '+(c.rating||'?')+'/5';}).join(', ');
      var prompt = 'Sei un digital marketing strategist per PMI italiane. Dati: '+datiStr+'. Scrivi max 300 parole con **Titolo** per: **Situazione Attuale** **Analisi Recensioni** **Obiettivi 90gg** **Obiettivi 6 mesi** **Strategia Social** **Priorita Intervento**';
      var aiR = await fetch('https://api.anthropic.com/v1/messages', { method:'POST', headers:{'Content-Type':'application/json','x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01'}, body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:600,messages:[{role:'user',content:prompt}]}) });
      var aiD = await aiR.json();
      if (aiD.content&&aiD.content[0]&&aiD.content[0].text) {
        strategia = aiD.content[0].text.split('**').map(function(t,i){return i%2===1?'<strong>'+t+'</strong>':t;}).join('').split('\n\n').join('</p><p style="margin-bottom:10px">').split('\n').join('<br>');
      }
    } catch(e) {}

    // 6. Proposta automatica
    var proposalHtml = '';
    try {
      var pMod = require('./proposal');
      var fatturato = pMod.stimaFatturato(lead);
      var analisiBase = pMod.analisiDigitale(lead);
      if (!seo||!seo.posizione||seo.posizione>30) analisiBase.bisogni = analisiBase.bisogni||{};
      var prodotti = pMod.costruisciPreventivo(lead, fatturato, analisiBase);
      var PRODOTTI = pMod.PRODOTTI;
      var oggi2 = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var scad = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var tot1 = prodotti.reduce(function(s,p){return s+(p.anno1||0);},0);
      var totM = prodotti.reduce(function(s,p){return s+(p.mens||0);},0);
      var righe = prodotti.map(function(p,i){
        return '<tr style="border-bottom:1px solid #f0f0f0">' +
          '<td style="padding:8px 10px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>' +
          '<td style="padding:8px 10px"><div style="font-weight:600;margin-bottom:2px" contenteditable="true">'+p.nome+'</div><div style="font-size:8.5pt;color:#777" contenteditable="true">'+p.desc+'</div></td>' +
          '<td style="padding:8px 10px"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt">'+p.cat+'</span></td>' +
          '<td style="padding:8px 10px;text-align:right;font-weight:600;white-space:nowrap">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>' +
          '<td style="padding:8px 10px;text-align:right;font-weight:600;white-space:nowrap">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>' +
          '</tr>';
      }).join('');
      proposalHtml = '<hr style="border:none;border-top:3px solid #E8001C;margin:32px 0 24px">' +
        '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:16px;padding-bottom:6px;border-bottom:2px solid #E8001C">Proposta Commerciale</div>' +
        '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px;font-size:9pt;color:#aaa">' +
        '<span>Data: '+oggi2+'</span><span>Valida fino al: '+scad+'</span>' +
        '<span>Consulente: <strong style="color:#1a1a1a" id="consulente-nome" contenteditable="true">Consulente Pagine Si!</strong></span></div>' +
        '<div style="background:#fff9e6;border:1px solid #ffe082;border-radius:7px;padding:9px 14px;margin-bottom:14px;font-size:9.5pt;color:#795548" class="no-print">Clicca sui testi per modificarli</div>' +
        '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt">' +
        '<thead><tr style="background:#111;color:white"><th style="padding:8px 10px;text-align:left;font-size:8.5pt">Sigla</th><th style="padding:8px 10px;text-align:left;font-size:8.5pt">Prodotto</th><th style="padding:8px 10px;text-align:left;font-size:8.5pt">Area</th><th style="padding:8px 10px;text-align:right;font-size:8.5pt">Anno 1</th><th style="padding:8px 10px;text-align:right;font-size:8.5pt">Mensile</th></tr></thead>' +
        '<tbody>'+righe+'</tbody></table>' +
        '<div style="background:#111;color:white;border-radius:8px;padding:16px 22px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:16px">' +
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Investimento Anno 1</div><div style="font-size:18pt;font-weight:800;color:#E8001C">&euro; '+tot1.toLocaleString('it-IT')+'</div><div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>' +
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Canone Mensile</div><div style="font-size:18pt;font-weight:800;color:#E8001C">&euro; '+totM+'<span style="font-size:11pt;color:rgba(255,255,255,0.4)">/mese</span></div></div>' +
        '</div>' +
        '<div style="font-size:8.5pt;color:#bbb;text-align:center">Pagine Si! SpA &middot; paginesispa.it &middot; Prezzi IVA esclusa</div>';
    } catch(e) {}

    // Build HTML
    var sec = 'font-size:10pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #E8001C';
    var box = 'background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:14px 18px;margin-bottom:8px';
    var oggi = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
    var body = '';

    var gPos=seo&&seo.posizione, gColor=gPos?(gPos<=10?'#2e7d32':gPos<=30?'#e65100':'#c62828'):'#c62828';
    var mColor=mapsPos?(mapsPos<=3?'#2e7d32':mapsPos<=7?'#e65100':'#c62828'):'#9e9e9e';
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Posizionamento - '+keyword+'</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div><div style="font-size:2.6rem;font-weight:800;color:'+gColor+'">'+(gPos?'#'+gPos:(seo&&seo.no_sito?'N/sito':'N/T'))+'</div><div style="font-size:8.5pt;color:'+gColor+';font-weight:600;margin-top:4px">'+(gPos?(gPos<=10?'Prima pagina':gPos<=30?'Pagine 2-3':'Oltre pag.3'):(seo&&seo.no_sito?'Senza sito':'Non trovato'))+'</div></div>';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div><div style="font-size:2.6rem;font-weight:800;color:'+mColor+'">'+(mapsPos?'#'+mapsPos:'N/T')+'</div><div style="font-size:8.5pt;color:'+mColor+';font-weight:600;margin-top:4px">'+(mapsPos?(mapsPos<=3?'Top 3':'Pos. '+mapsPos):'Non trovato')+'</div></div>';
    body += '</div></div>';

    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Presenza Digitale</div><div style="display:flex;gap:10px;flex-wrap:wrap">';
    [{label:'Sito Web',val:web?'Presente':'Assente',ok:!!web,link:web},{label:'Maps',val:nRating>0?nRating+' rec.':'Assente',ok:nRating>=20},{label:'Rating',val:rating?rating+'/5':'N/D',ok:rating>=4.0},{label:'Facebook',val:social.facebook?(social.facebook_follower||'Trovato'):'Assente',ok:!!social.facebook,link:social.facebook},{label:'Instagram',val:social.instagram?(social.instagram_follower||'Trovato'):'Assente',ok:!!social.instagram,link:social.instagram}].forEach(function(item){
      var bg=item.ok?'#e8f5e9':'#fce8e8',col=item.ok?'#2e7d32':'#c62828';
      body += '<div style="flex:1;min-width:90px;background:'+bg+';border-radius:8px;padding:10px;text-align:center"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:4px">'+item.label+'</div>'+(item.link?'<a href="'+item.link+'" target="_blank" style="font-size:9pt;font-weight:700;color:'+col+';text-decoration:none">'+item.val+'</a>':'<div style="font-size:9pt;font-weight:700;color:'+col+'">'+item.val+'</div>')+'</div>';
    });
    body += '</div></div>';

    if (recensioni) {
      var pColor=recensioni.perc_risposta>=70?'#2e7d32':recensioni.perc_risposta>=30?'#e65100':'#c62828';
      var pLabel=recensioni.perc_risposta>=70?'Buona gestione':recensioni.perc_risposta>=30?'Parziale':'Scarsa';
      var stars5=['&#9733;&#9733;&#9733;&#9733;&#9733;','&#9733;&#9733;&#9733;&#9733;&#9734;','&#9733;&#9733;&#9733;&#9734;&#9734;','&#9733;&#9733;&#9734;&#9734;&#9734;','&#9733;&#9734;&#9734;&#9734;&#9734;'];
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Gestione Recensioni</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">% Risposte</div><div style="font-size:2rem;font-weight:800;color:'+pColor+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+pColor+';font-weight:600">'+pLabel+'</div></div>';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Pos/Neg</div><div style="font-size:1.6rem;font-weight:800"><span style="color:#2e7d32">'+recensioni.positive+'</span> / <span style="color:#c62828">'+recensioni.negative+'</span></div><div style="font-size:8pt;color:#aaa">su '+recensioni.campione+' anal.</div></div>';
      body += '</div>';
      if (recensioni.ultima&&recensioni.ultima.testo) {
        var ur=recensioni.ultima,sC=ur.rating>=4?'#2e7d32':ur.rating>=3?'#e65100':'#c62828';
        body += '<div style="'+box+'"><div style="font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px">Ultima'+(ur.time_ago?' ('+ur.time_ago+')':'')+'</div>';
        if (ur.rating) body += '<div style="font-size:10pt;color:'+sC+';margin-bottom:5px">'+stars5[Math.max(0,5-Math.round(ur.rating))]+'</div>';
        body += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+ur.testo.slice(0,280).replace(/[<>]/g,'')+(ur.testo.length>280?'...':'')+'&quot;</div>';
        body += '<div style="font-size:8.5pt;margin-top:6px;font-weight:600;color:'+(ur.ha_risposta?'#2e7d32':'#c62828')+'">'+(ur.ha_risposta?'Proprietario ha risposto':'Nessuna risposta')+'</div></div>';
      }
      body += '</div>';
    }

    if (competitor&&competitor.length) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Competitor di Zona</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt"><thead><tr style="background:#111;color:white"><th style="padding:8px 10px;text-align:left">Attivita</th><th style="padding:8px 10px;text-align:center">Maps</th><th style="padding:8px 10px;text-align:center">Google</th><th style="padding:8px 10px;text-align:center">Rating</th><th style="padding:8px 10px;text-align:center">Rec.</th><th style="padding:8px 10px;text-align:center">% Risp.</th><th style="padding:8px 10px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,i){
        body += '<tr style="background:'+(i%2===0?'white':'#fafafa')+';border-bottom:1px solid #f0f0f0"><td style="padding:8px 10px;font-weight:600">'+c.nome+(c.sito_dom?'<br><span style="font-size:8pt;color:#1565c0">'+c.sito_dom+'</span>':'')+'</td><td style="padding:8px 10px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td><td style="padding:8px 10px;text-align:center">'+(c.posizione_serp?'<span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td><td style="padding:8px 10px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>/5':'N/D')+'</td><td style="padding:8px 10px;text-align:center">'+c.n_recensioni+'</td><td style="padding:8px 10px;text-align:center">'+(c.rec_comp?'<span style="font-weight:700;color:'+(c.rec_comp.perc>=70?'#2e7d32':c.rec_comp.perc>=30?'#e65100':'#c62828')+'">'+c.rec_comp.perc+'%</span>':'<span style="color:#aaa">N/D</span>')+'</td><td style="padding:8px 10px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td></tr>';
      });
      body += '</tbody></table></div></div>';
    }

    if (social.facebook||social.instagram) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) body += '<div style="flex:1;min-width:140px;border:1px solid #1877f2;border-radius:10px;overflow:hidden"><div style="background:#1877f2;padding:8px 14px"><span style="color:white;font-weight:700">Facebook</span></div><div style="padding:10px 14px">'+(social.facebook_follower?'<div style="font-size:1.2rem;font-weight:800;color:#1877f2;margin-bottom:5px">'+social.facebook_follower+'</div>':'')+'<a href="'+social.facebook+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri</a></div></div>';
      if (social.instagram) body += '<div style="flex:1;min-width:140px;border:1px solid #e1306c;border-radius:10px;overflow:hidden"><div style="background:#e1306c;padding:8px 14px"><span style="color:white;font-weight:700">Instagram</span></div><div style="padding:10px 14px">'+(social.instagram_follower?'<div style="font-size:1.2rem;font-weight:800;color:#e1306c;margin-bottom:5px">'+social.instagram_follower+'</div>':'')+'<a href="'+social.instagram+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri</a></div></div>';
      body += '</div></div>';
    }

    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div><div style="display:flex;gap:14px;flex-wrap:wrap">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:100px"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:10px">Le AI generative citano attivita presenti su fonti autorevoli. Piu fonti = piu visibilita per "'+categoria+' a '+citta+'".</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">';
    (ai.fonti||[]).forEach(function(f){ body += '<div style="display:flex;align-items:center;gap:5px;font-size:9pt"><span style="color:'+(f.ok?'#2e7d32':'#c62828')+';font-weight:700">'+(f.ok?'&#10003;':'&#10007;')+'</span><span style="color:'+(f.ok?'#2e7d32':'#888')+'">'+f.label+'</span></div>'; });
    body += '</div></div></div></div>';

    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div><div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7"><p style="margin-bottom:10px">'+strategia+'</p></div></div>';
    }

    body += proposalHtml;


    // Proposta generata lato server
    var propostaHtml = '';
    try {
      var pMod = require('./proposal');
      var fat = pMod.stimaFatturato(lead);
      var anBase = pMod.analisiDigitale(lead);
      anBase.bisogni = anBase.bisogni || {};
      if (!seo || !seo.posizione || seo.posizione > 30) anBase.bisogni.seo = true;
      if (!social.facebook && !social.instagram) anBase.bisogni.social = true;
      if (recensioni && recensioni.perc_risposta < 30) anBase.bisogni.reputazione = true;
      var prods = pMod.costruisciPreventivo(lead, fat, anBase);
      var PROD = pMod.PRODOTTI;
      var ogP = new Date().toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var scP = new Date(Date.now()+30*24*60*60*1000).toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
      var t1 = prods.reduce(function(s,p){return s+(p.anno1||0);},0);
      var tM = prods.reduce(function(s,p){return s+(p.mens||0);},0);
      var lj = JSON.stringify(PROD);
      var rr = prods.map(function(p,i){
        return '<tr data-a1="'+(p.anno1||0)+'" data-mn="'+(p.mens||0)+'" style="border-bottom:1px solid #f0f0f0">'+
          '<td style="padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600">'+p.sigla+'</td>'+
          '<td style="padding:9px 11px"><div contenteditable="true" style="font-weight:600;margin-bottom:2px">'+p.nome+'</div>'+
          '<div contenteditable="true" style="font-size:8.5pt;color:#777">'+p.desc+'</div>'+
          '<div contenteditable="true" style="font-size:8pt;color:#aaa;font-style:italic">'+p.motivazione+'</div></td>'+
          '<td style="padding:9px 11px"><span style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt">'+p.cat+'</span></td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.anno1?'&euro; '+p.anno1.toLocaleString('it-IT'):'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:right;font-weight:600">'+(p.mens?'&euro; '+p.mens+'/mese':'&mdash;')+'</td>'+
          '<td style="padding:9px 11px;text-align:center;width:28px"><button onclick="rmRiga(this)" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px">&#10005;</button></td>'+
          '</tr>';
      }).join('');
      propostaHtml =
        '<div id="prop-sec" style="display:none">'+
        '<hr style="border:none;border-top:3px solid #E8001C;margin:32px 0 24px">'+
        '<div style="font-size:10.5pt;font-weight:700;color:#E8001C;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #E8001C">Proposta Commerciale</div>'+
        '<div style="font-size:9pt;color:#aaa;margin-bottom:10px">Consulente: <strong contenteditable="true" style="color:#1a1a1a">Consulente Pagine Si!</strong> &middot; '+ogP+' &middot; Valida: '+scP+'</div>'+
        '<div style="background:#fff9e6;border:1px solid #ffe082;border-radius:7px;padding:9px 14px;margin-bottom:14px;font-size:9.5pt;color:#795548">Clicca sui testi per modificarli</div>'+
        '<table id="ptbl" style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:9.5pt">'+
        '<thead><tr style="background:#111;color:white">'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Sigla</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Prodotto</th>'+
        '<th style="padding:9px 11px;text-align:left;font-size:8.5pt">Area</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Anno 1</th>'+
        '<th style="padding:9px 11px;text-align:right;font-size:8.5pt">Mensile</th>'+
        '<th style="width:28px"></th></tr></thead>'+
        '<tbody>'+rr+'</tbody>'+
        '<tfoot><tr><td colspan="6" style="padding:8px 11px;border-top:2px dashed #f0f0f0;background:#fafafa">'+
        '<button onclick="apriLP()" style="padding:5px 12px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer">+ Aggiungi dal listino</button>'+
        '</td></tr></tfoot></table>'+
        '<div style="background:#111;color:white;border-radius:8px;padding:16px 22px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px">'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Anno 1</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="pt1">&euro; '+t1.toLocaleString('it-IT')+'</div>'+
        '<div style="font-size:8pt;color:rgba(255,255,255,0.3)">IVA esclusa</div></div>'+
        '<div style="text-align:center"><div style="font-size:8pt;color:rgba(255,255,255,0.5);text-transform:uppercase;margin-bottom:3px">Mensile</div>'+
        '<div style="font-size:18pt;font-weight:800;color:#E8001C" id="ptm">&euro; '+tM+'<span style="font-size:10pt;color:rgba(255,255,255,0.4)">/mese</span></div></div></div>'+
        '<div style="font-size:8.5pt;color:#bbb;text-align:center;margin-bottom:20px">Pagine Si! SpA &middot; paginesispa.it &middot; IVA esclusa</div>'+
        '<div id="lp-ov" onclick="if(event.target===this)chiudiLP()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center">'+
        '<div style="background:#fff;border-radius:14px;width:660px;max-width:95vw;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2)">'+
        '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between"><div style="font-size:13px;font-weight:700">Aggiungi servizio</div><button onclick="chiudiLP()" style="width:26px;height:26px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer">&#10005;</button></div>'+
        '<div id="lp-body" style="overflow-y:auto;padding:16px 18px;flex:1"></div>'+
        '<div style="padding:10px 18px;border-top:1px solid #eee;background:#f9f9f9;display:flex;justify-content:space-between;align-items:center">'+
        '<span style="font-size:10px;color:#aaa">Seleziona</span>'+
        '<button id="lp-ok" onclick="aggLP()" disabled style="padding:7px 16px;background:#E8001C;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;opacity:0.4">Aggiungi</button>'+
        '</div></div></div>'+
        '<script>var _LP='+lj+';var _LS=null;'+
        'function rmRiga(b){var tr=b.closest("tr");if(tr){tr.remove();updT();}}'+
        'function updT(){var a=0,m=0;document.querySelectorAll("#ptbl tbody tr").forEach(function(r){a+=parseFloat(r.dataset.a1||0);m+=parseFloat(r.dataset.mn||0);});var e1=document.getElementById("pt1"),em=document.getElementById("ptm");if(e1)e1.textContent=a.toLocaleString("it-IT");if(em)em.textContent=m;}'+
        'function apriLP(){var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM","Si2VN-PM"],"Directory":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Automation":["Si4BLD","Si4BEN"]};'+
        'var bd=document.getElementById("lp-body");bd.innerHTML="";'+
        'for(var c in cats){var w=document.createElement("div");w.style.marginBottom="14px";var lb=document.createElement("div");lb.style.cssText="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px";lb.textContent=c;w.appendChild(lb);var rw=document.createElement("div");rw.style.cssText="display:flex;flex-wrap:wrap;gap:4px";cats[c].forEach(function(s){var p=_LP[s];if(!p)return;var pr=p.mens?("\u20ac"+p.mens+"/mese"):(p.anno1?("\u20ac"+p.anno1+"/anno"):"");var btn=document.createElement("button");btn.id="lc-"+s;btn.dataset.s=s;btn.onclick=function(){selLP(this,this.dataset.s);};btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";var b=document.createElement("b");b.style.cssText="font-family:monospace;color:#E8001C";b.textContent=s;btn.appendChild(b);btn.appendChild(document.createTextNode(" "+p.nome+" "+pr));rw.appendChild(btn);});w.appendChild(rw);bd.appendChild(w);}'+
        'document.getElementById("lp-ov").style.display="flex";}'+
        'function selLP(el,s){document.querySelectorAll("[id^=lc-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_LS=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";var b=document.getElementById("lp-ok");if(b){b.disabled=false;b.style.opacity="1";}}'+
        'function aggLP(){if(!_LS)return;var p=_LP[_LS];if(!p)return;var tb=document.querySelector("#ptbl tbody");var tr=document.createElement("tr");tr.dataset.a1=p.anno1||0;tr.dataset.mn=p.mens||0;tr.style.borderBottom="1px solid #f0f0f0";function mkTd(st){var td=document.createElement("td");td.style.cssText=st;return td;}var t0=mkTd("padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600");t0.textContent=_LS;var t1b=mkTd("padding:9px 11px");var dn=document.createElement("div");dn.contentEditable="true";dn.style.cssText="font-weight:600;margin-bottom:2px";dn.textContent=p.nome;var dd=document.createElement("div");dd.contentEditable="true";dd.style.cssText="font-size:8.5pt;color:#777";dd.textContent=p.desc;t1b.appendChild(dn);t1b.appendChild(dd);var t2=mkTd("padding:9px 11px");var sp=document.createElement("span");sp.style.cssText="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt";sp.textContent=p.cat;t2.appendChild(sp);var t3=mkTd("padding:9px 11px;text-align:right;font-weight:600");t3.textContent=p.anno1?"\u20ac "+p.anno1.toLocaleString("it-IT"):"\u2014";var t4=mkTd("padding:9px 11px;text-align:right;font-weight:600");t4.textContent=p.mens?"\u20ac "+p.mens+"/mese":"\u2014";var t5=mkTd("padding:9px 11px;text-align:center;width:28px");var rb=document.createElement("button");rb.onclick=function(){rmRiga(this);};rb.style.cssText="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px";rb.innerHTML="&#10005;";t5.appendChild(rb);[t0,t1b,t2,t3,t4,t5].forEach(function(t){tr.appendChild(t);});tb.appendChild(tr);updT();chiudiLP();_LS=null;}'+
        'function chiudiLP(){document.getElementById("lp-ov").style.display="none";}<\/script>'+
        '</div>';
    } catch(propErr) { propostaHtml = ''; }
    var tastoP = propostaHtml ?
      '<div style="margin-top:32px;padding:20px 0;text-align:center" class="no-print">'+
      '<button id="btn-prop" onclick="mostraP()" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>'+
      '<div style="font-size:9pt;color:#aaa;margin-top:8px">La proposta appare qui sotto</div></div>' : '';

    var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.pg{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.hdr{background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}.t{font-size:13pt;font-weight:700;color:white}.s{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.d{font-size:8.5pt;color:rgba(255,255,255,0.4)}.lb{border-left:5px solid #E8001C;background:white;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C}.n{font-size:12pt;font-weight:700;margin-bottom:4px}.info{font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap}.bd{padding:18px 26px 26px}.az{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee}.btn{padding:9px 18px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:opacity 0.2s}.btn:hover{opacity:0.9}.br{background:#E8001C;color:white}.bg{background:#2e7d32;color:white}@media print{.az,.no-print{display:none!important}body{background:white}.pg{box-shadow:none;margin:0;border-radius:0}}';

    var fullHtml = '<div style="max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">' +
      '<div style="background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:13pt;font-weight:700;color:white">Analisi Digitale Prevendita</div><div style="font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px">Lead Agent - Pagine Si!</div></div><div style="font-size:8.5pt;color:rgba(255,255,255,0.4)">'+oggi+'</div></div>' +
      '<div style="border-left:5px solid #E8001C;background:white;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C"><div style="font-size:12pt;font-weight:700;margin-bottom:4px">'+nome+'</div><div style="font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap"><span>'+(lead.indirizzo||'')+'</span>'+(web?'<span>Sito: <a href="'+web+'" target="_blank" style="color:#1565c0">'+web+'</a></span>':'<span style="color:#c62828">Nessun sito</span>')+'<span>Rating: '+(rating?rating+'/5 ('+nRating+' rec.)':'N/D')+'</span></div></div>' +
      '<div style="padding:18px 26px 26px">' +
      '<div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee" class="no-print">' +
      '<button onclick="window.print()" style="padding:9px 18px;background:#E8001C;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer">Stampa / PDF</button>' +
      '<button id="ba" onclick="apriAnt()" style="padding:9px 18px;background:#2e7d32;color:white;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer">Anteprima Sito</button>' +
      '</div>' +
      body +
      tastoP +
      propostaHtml +
      '</div></div>' +
      '<script>' +
      'var B="https://leadagent-backend.onrender.com";' +
      'var L='+JSON.stringify({nome:nome,indirizzo:lead.indirizzo||'',web:web||null,telefono:lead.telefono||null,tipi:lead.tipi||[],rating:rating,nRating:nRating,descrizione:lead.descrizione||null,placeId:lead.placeId||null,categoria:categoria,citta:citta,logoUrl:lead.logoUrl||null})+';' +
      'function apriAnt(){' +
      '  var btn=document.getElementById("ba");if(btn){btn.disabled=true;btn.textContent="Generazione...";}' +
      '  var tab=window.open("","_blank");' +
      '  fetch(B+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:L.nome,indirizzo:L.indirizzo,telefono:L.telefono,tipi:L.tipi,rating:L.rating,nRating:L.nRating,descrizione:L.descrizione,logoUrl:L.logoUrl})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){if(d.html&&tab&&!tab.closed){tab.document.open();tab.document.write(d.html);tab.document.close();}if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}})' +
      '  .catch(function(e){if(tab&&!tab.closed)tab.close();if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}});' +
      '}' +
      '</script>';

    res.json({ html: fullHtml });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function(){ console.log('LeadAgent Backend running on port ' + PORT); });
