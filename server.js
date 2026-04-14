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
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: req.body.messages })
    });
    res.json(await resp.json());
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/preview', async function(req, res) {
  try {
    var n = req.body.nome, ind = req.body.indirizzo, tel = req.body.telefono;
    var tipi = req.body.tipi, rat = req.body.rating, nRat = req.body.nRating, logo = req.body.logoUrl;
    var logoS = logo ? 'Logo: ' + logo : 'Crea logo testuale con iniziali.';
    var tipiS = (tipi||[]).slice(0,3).join(', ') || 'attivita locale';
    var prompt = 'Genera SOLO codice HTML completo per sito web di: "' + n + '", ' + tipiS + ', ' + ind + ', tel: ' + (tel||'da inserire') + '. ' + logoS + (rat ? ' Rating: '+rat+'/5 ('+nRat+' rec).' : '') + ' DESIGN professionale Google Fonts, Unsplash, responsive. Struttura: header Pagine Si!, hero, storia, 6 servizi, 4 recensioni, contatti, footer. Inizia con <!DOCTYPE html>.';
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] })
    });
    var data = await resp.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    var html = (data.content||[]).filter(function(b){ return b.type==='text'; }).map(function(b){ return b.text; }).join('');
    html = html.trim().replace(/^```html?\n?/, '').replace(/\n?```$/, '');
    res.json({ html: html });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

//  HELPERS 

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
  function estraiF(s, t) {
    var m = (s+' '+t).match(/(\d+[.,]?\d*\s*[KkMm]?)\s*(follower|followers|seguaci|Mi piace)/i);
    return m ? m[0].trim() : null;
  }
  function trovaSu(items, tipo) {
    for (var i = 0; i < items.length; i++) {
      var url = (items[i].url||'').toLowerCase(), dom = (items[i].domain||'').toLowerCase();
      if (!dom.includes(tipo+'.com')) continue;
      var path = url.replace(new RegExp('https?://(www\\.)?'+tipo+'\\.com/?'), '');
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
      body: JSON.stringify({ textQuery: categoria + ' ' + citta, languageCode: 'it', maxResultCount: 20 })
    });
    var data = await resp.json();
    if (!data.places) return out;
    // Posizione Maps del lead - matching preciso
    for (var i = 0; i < data.places.length; i++) {
      var n = ((data.places[i].displayName && data.places[i].displayName.text)||'').toLowerCase().trim();
      var siteC = (data.places[i].websiteUri||'').toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0];
      var nomeMatch = n === nomeNorm || (nomeNorm.length > 4 && n.includes(nomeNorm)) || (nomeNorm.length > 4 && nomeNorm.includes(n) && n.length > 4);
      var siteMatch = webNorm && siteC && siteC.length > 3 && (siteC === webNorm || siteC.includes(webNorm) || webNorm.includes(siteC));
      if (nomeMatch || siteMatch) { out.posizione_maps_lead = i + 1; break; }
    }
    // Competitor: prime 3 escluso il lead
    var count = 0;
    for (var ci = 0; ci < data.places.length && count < 3; ci++) {
      var cp = data.places[ci];
      var cn = ((cp.displayName && cp.displayName.text)||'').toLowerCase().trim();
      var csC = (cp.websiteUri||'').toLowerCase().replace(/^https?:\/\/(www\.)?/,'').split('/')[0];
      var isLead = (nomeNorm.length > 4 && cn.includes(nomeNorm)) || (nomeNorm.length > 4 && nomeNorm.includes(cn) && cn.length > 4) || (webNorm && csC && csC.includes(webNorm));
      if (!cn || isLead) continue;
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
          var rr = await fetch('https://places.googleapis.com/v1/places/'+cp.id, { headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'reviews' } });
          var rd = await rr.json();
          if (rd.reviews && rd.reviews.length) {
            var risp = rd.reviews.filter(function(r){ return !!(r.reviewReply && r.reviewReply.text); }).length;
            recComp = { campione: rd.reviews.length, risposte: risp, perc: Math.round((risp/rd.reviews.length)*100) };
          }
        } catch(e) {}
      }
      out.competitor.push({ nome: (cp.displayName && cp.displayName.text)||'N/D', posizione_maps: ci+1, posizione_serp: posizioneSerp, rating: cp.rating ? cp.rating.toFixed(1) : null, n_recensioni: cp.userRatingCount||0, ha_sito: !!sito, sito_dom: sitoDom, rec_comp: recComp });
      count++;
    }
  } catch(e) {}
  return out;
}

async function calcolaAI(web, social, nRating, rating, seo, nome, citta) {
  var score = 0, det = [];
  // Google Maps
  if (nRating >= 100) { score += 20; det.push({ ok: true, label: 'Google Maps ('+nRating+' rec.)' }); }
  else if (nRating >= 30) { score += 12; det.push({ ok: true, label: 'Google Maps ('+nRating+' rec.)' }); }
  else if (nRating > 0) { score += 5; det.push({ ok: false, label: 'Google Maps (poche rec.)' }); }
  else { det.push({ ok: false, label: 'Google Maps: assente' }); }
  // Rating bonus
  if (rating >= 4.5) score += 10; else if (rating >= 4.0) score += 6; else if (rating >= 3.5) score += 3;
  // Sito web
  if (web) {
    if (seo && seo.posizione && seo.posizione <= 10) { score += 18; det.push({ ok: true, label: 'Sito web (pag. 1 Google)' }); }
    else if (seo && seo.posizione && seo.posizione <= 30) { score += 10; det.push({ ok: true, label: 'Sito web (pag. 2-3 Google)' }); }
    else { score += 5; det.push({ ok: false, label: 'Sito web (non indicizzato)' }); }
  } else { det.push({ ok: false, label: 'Sito web: assente' }); }
  // Social
  if (social.facebook && social.instagram) { score += 15; det.push({ ok: true, label: 'Facebook + Instagram' }); }
  else if (social.facebook) { score += 8; det.push({ ok: true, label: 'Facebook presente' }); det.push({ ok: false, label: 'Instagram: assente' }); }
  else if (social.instagram) { score += 8; det.push({ ok: true, label: 'Instagram presente' }); det.push({ ok: false, label: 'Facebook: assente' }); }
  else { det.push({ ok: false, label: 'Social: assenti' }); }
  // Cerca TripAdvisor e Pagine Gialle
  try {
    var q = await dfsSearch(nome + ' ' + citta + ' tripadvisor OR paginegialle', 10);
    var hasTa = q.some(function(i){ return (i.domain||'').includes('tripadvisor'); });
    var hasPg = q.some(function(i){ return (i.domain||'').includes('paginegialle'); });
    if (hasTa) { score += 8; det.push({ ok: true, label: 'TripAdvisor' }); }
    else { det.push({ ok: false, label: 'TripAdvisor: non trovato' }); }
    if (hasPg) { score += 5; det.push({ ok: true, label: 'Pagine Gialle' }); }
    else { det.push({ ok: false, label: 'Pagine Gialle: non trovato' }); }
    // Stampa locale
    var q2 = await dfsSearch(nome + ' ' + citta + ' -facebook -instagram -tripadvisor', 10);
    var hasNews = q2.some(function(i){ var d=(i.domain||'').toLowerCase(); return !['facebook','instagram','google','maps','pagine','tripadvisor','yelp'].some(function(x){return d.includes(x);}); });
    if (hasNews) { score += 4; det.push({ ok: true, label: 'Stampa locale online' }); }
    else { det.push({ ok: false, label: 'Stampa locale: non trovato' }); }
  } catch(e) {}
  score = Math.min(score, 100);
  return { score: score, livello: score>=70?'ALTA':score>=40?'MEDIA':'BASSA', colore: score>=70?'#2e7d32':score>=40?'#e65100':'#c62828', dettagli: det };
}

//  ENDPOINT /analisi 
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

    // 1. Avvia recensioni DataForSEO (async, depth 50, newest)
    var recTaskId = null;
    try {
      var payload = [{ depth: 50, sort_by: 'newest', location_code: 2380, language_code: 'it' }];
      if (lead.placeId) { payload[0].place_id = lead.placeId; } else { payload[0].keyword = nome + ' ' + citta; }
      var pr = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_post', {
        method: 'POST', headers: { 'Authorization': dfsAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var pd = await pr.json();
      recTaskId = pd.tasks && pd.tasks[0] && pd.tasks[0].id;
    } catch(e) {}

    // 2. Ricerche parallele + polling recensioni tutto in parallelo
    var ris = await Promise.all([ cercaPosizioneGoogle(nome, web, categoria, citta), cercaSocial(nome, citta) ]);
    var seo = ris[0], social = ris[1];
    var serpItems = (seo && seo.items) || [];
    var keyword = (seo && seo.keyword) || (categoria + ' ' + citta);

    // 3. Competitor Maps + raccolta recensioni in parallelo
    // Le due chiamate girano insieme - competitor prende ~8-12s, recensioni prende ~10-15s
    async function raccogliRecensioni() {
      if (!recTaskId) return null;
      for (var a = 0; a < 6; a++) {
        await new Promise(function(r){ setTimeout(r, 2500); });
        try {
          var gr = await fetch('https://api.dataforseo.com/v3/business_data/google/reviews/task_get/'+recTaskId, { headers: { 'Authorization': dfsAuth() } });
          var gd = await gr.json();
          var tk = gd.tasks && gd.tasks[0];
          if (tk && tk.status_code === 20000 && tk.result && tk.result[0]) {
            var r0 = tk.result[0], its = r0.items || [];
            var risp = its.filter(function(r){ return !!r.owner_answer; }).length;
            return {
              totale_recensioni: nRating || r0.reviews_count || its.length,
              campione: its.length, con_risposta: risp,
              perc_risposta: its.length > 0 ? Math.round((risp/its.length)*100) : 0,
              positive: its.filter(function(r){ return r.rating && r.rating.value >= 4; }).length,
              negative: its.filter(function(r){ return r.rating && r.rating.value <= 2; }).length,
              testi: its.slice(0,20).map(function(r){ return { rating: r.rating&&r.rating.value, testo: r.review_text||'', ha_risposta: !!r.owner_answer, time_ago: r.time_ago||'' }; }),
              ultima: its[0] ? { rating: its[0].rating&&its[0].rating.value, testo: its[0].review_text||'', ha_risposta: !!its[0].owner_answer, time_ago: its[0].time_ago||'' } : null
            };
          }
        } catch(e) {}
      }
      return null;
    }

    var parallelRes = await Promise.all([ cercaCompetitor(categoria, citta, nomeNorm, webNorm, serpItems), raccogliRecensioni() ]);
    var mapsData = parallelRes[0];
    var recensioni = parallelRes[1];
    var competitor = mapsData.competitor, mapsPos = mapsData.posizione_maps_lead;

    // Analisi strategica Claude - generata qui, non in background
    var strategia = '';
    try {
      var recTesti = recensioni&&recensioni.testi ? recensioni.testi.slice(0,10).map(function(r){return (r.rating||'?')+'/5: '+r.testo.slice(0,80);}).join(' // ') : 'nessuna';
      var datiStr = [
        'Attivita: '+nome+' ('+categoria+' a '+citta+')',
        'Sito: '+(web||'assente'),
        'Rating: '+(rating||'N/D')+'/5 con '+nRating+' recensioni',
        'Posizione Google: '+(seo&&seo.posizione?'#'+seo.posizione:'non trovato'),
        'Posizione Maps: '+(mapsPos?'#'+mapsPos:'non trovato'),
        'Facebook: '+(social.facebook?'presente':'assente'),
        'Instagram: '+(social.instagram?'presente':'assente'),
        'Recensioni: '+(recensioni?recensioni.perc_risposta+'% risposte su '+recensioni.campione+', '+recensioni.positive+' pos, '+recensioni.negative+' neg':'N/D'),
        'Ultime: '+recTesti,
        'Competitor: '+competitor.map(function(c){return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' '+(c.rating||'N/D')+'/5';}).join(', ')
      ].join('\n');
      var prompt = 'Sei un senior digital marketing strategist italiano per PMI locali.\n\nREGOLE FONDAMENTALI:\n- NON usare tabelle markdown (no | pipe |)\n- NON usare # titoli markdown\n- NON usare simboli speciali come | - --- ===\n- USA solo **Titolo** per i titoli in grassetto\n- Scrivi in paragrafi chiari e leggibili\n- Sii concreto SOLO con numeri presenti nei dati forniti\n- NON inventare follower, engagement o metriche social se non presenti nei dati\n- Per i social: descrivi solo presenza/assenza e suggerisci strategie concrete senza inventare numeri\n\nDATI REALI:\n'+datiStr+'\n\nPRODUCI questa analisi strutturata:\n\n**Situazione Attuale**\nDescrivi i 3 gap critici piu urgenti usando SOLO i numeri presenti nei dati. Per ogni gap: problema, impatto, confronto competitor.\n\n**Analisi Recensioni**\nAnalizza i testi reali delle recensioni fornite. Cita frasi specifiche. Identifica pattern positivi e negativi concreti.\n\n**Obiettivi a 90 Giorni**\n3 obiettivi SMART con numeri basati sui dati reali forniti.\n\n**Obiettivi a 6 Mesi**\n3 proiezioni concrete con stima impatto sul business.\n\n**Strategia Social Media**\nSuggerisci strategie Reels concrete per questa categoria specifica. Non inventare dati su follower attuali.\n\n**Priorita di Intervento**\nI 3 servizi Pagine Si! piu urgenti con motivazione basata sui gap reali identificati.';
      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        strategia = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
      }
    } catch(e) {}

    var ai = await calcolaAI(web, social, nRating, rating, seo, nome, citta);
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
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Organico</div><div style="font-size:2.6rem;font-weight:800;color:'+gColor+'">'+gLabel+'</div><div style="font-size:8.5pt;color:'+gColor+';font-weight:600;margin-top:4px">'+(gPos?(gPos<=10?'Prima pagina':gPos<=30?'Pagine 2-3':'Oltre pag.3'):(seo&&seo.no_sito?'Senza sito':'Non trovato'))+'</div>'+(seo&&seo.url?'<div style="font-size:8pt;margin-top:5px"><a href="'+seo.url+'" target="_blank" style="color:#1565c0">'+seo.url.replace(/^https?:\/\/(www\.)?/,'').slice(0,35)+'</a></div>':'')+'</div>';
    body += '<div style="flex:1;min-width:120px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:6px">Google Maps</div><div style="font-size:2.6rem;font-weight:800;color:'+mColor+'">'+(mapsPos?'#'+mapsPos:'N/T')+'</div><div style="font-size:8.5pt;color:'+mColor+';font-weight:600;margin-top:4px">'+(mapsPos?(mapsPos<=3?'Top 3':'Posizione '+mapsPos):'Non in lista')+'</div></div>';
    body += '</div></div>';

    // PRESENZA DIGITALE
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Presenza Digitale</div><div style="display:flex;gap:10px;flex-wrap:wrap">';
    [{label:'Sito Web',val:web?'Presente':'Assente',ok:!!web,link:web},{label:'Maps',val:nRating>0?nRating+' rec.':'Assente',ok:nRating>=20},{label:'Rating',val:rating?rating+'/5':'N/D',ok:rating>=4.0},{label:'Facebook',val:social.facebook?(social.facebook_follower||'Trovato'):'Assente',ok:!!social.facebook,link:social.facebook},{label:'Instagram',val:social.instagram?(social.instagram_follower||'Trovato'):'Assente',ok:!!social.instagram,link:social.instagram}].forEach(function(item){
      var bg=item.ok?'#e8f5e9':'#fce8e8', col=item.ok?'#2e7d32':'#c62828';
      body += '<div style="flex:1;min-width:90px;background:'+bg+';border-radius:8px;padding:10px;text-align:center"><div style="font-size:8pt;color:#777;text-transform:uppercase;margin-bottom:4px">'+item.label+'</div>'+(item.link?'<a href="'+item.link+'" target="_blank" style="font-size:9pt;font-weight:700;color:'+col+';text-decoration:none">'+item.val+'</a>':'<div style="font-size:9pt;font-weight:700;color:'+col+'">'+item.val+'</div>')+'</div>';
    });
    body += '</div></div>';

    // RECENSIONI
    if (recensioni) {
      var pC=recensioni.perc_risposta>=70?'#2e7d32':recensioni.perc_risposta>=30?'#e65100':'#c62828';
      var pL=recensioni.perc_risposta>=70?'Buona gestione':recensioni.perc_risposta>=30?'Gestione parziale':'Scarsa gestione';
      var st5=['&#9733;&#9733;&#9733;&#9733;&#9733;','&#9733;&#9733;&#9733;&#9733;&#9734;','&#9733;&#9733;&#9733;&#9734;&#9734;','&#9733;&#9733;&#9734;&#9734;&#9734;','&#9733;&#9734;&#9734;&#9734;&#9734;'];
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Gestione Recensioni</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Totale</div><div style="font-size:2rem;font-weight:800">'+recensioni.totale_recensioni+'</div></div>';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">% Risposte</div><div style="font-size:2rem;font-weight:800;color:'+pC+'">'+recensioni.perc_risposta+'%</div><div style="font-size:8pt;color:'+pC+';font-weight:600">'+pL+'</div></div>';
      body += '<div style="flex:1;min-width:90px;'+box+';text-align:center"><div style="font-size:8.5pt;color:#777;text-transform:uppercase;margin-bottom:5px">Pos/Neg</div><div style="font-size:1.6rem;font-weight:800"><span style="color:#2e7d32">'+recensioni.positive+'</span> / <span style="color:#c62828">'+recensioni.negative+'</span></div><div style="font-size:8pt;color:#aaa">su '+recensioni.campione+' analizzate</div></div>';
      body += '</div>';
      if (recensioni.ultima && recensioni.ultima.testo) {
        var ur=recensioni.ultima, sC=ur.rating>=4?'#2e7d32':ur.rating>=3?'#e65100':'#c62828';
        body += '<div style="'+box+'"><div style="font-size:8.5pt;color:#aaa;text-transform:uppercase;margin-bottom:6px">Ultima recensione'+(ur.time_ago?' ('+ur.time_ago+')':'')+'</div>';
        if (ur.rating) body += '<div style="font-size:10pt;color:'+sC+';margin-bottom:5px">'+st5[Math.max(0,5-Math.round(ur.rating))]+'</div>';
        body += '<div style="font-size:9.5pt;color:#555;line-height:1.5;font-style:italic">&quot;'+ur.testo.slice(0,280).replace(/[<>]/g,'')+(ur.testo.length>280?'...':'')+'&quot;</div>';
        body += '<div style="font-size:8.5pt;margin-top:6px;font-weight:600;color:'+(ur.ha_risposta?'#2e7d32':'#c62828')+'">'+(ur.ha_risposta?'Il proprietario ha risposto':'Nessuna risposta del proprietario')+'</div></div>';
      }
      body += '</div>';
    }

    // COMPETITOR
    if (competitor && competitor.length) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Competitor di Zona</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:9.5pt"><thead><tr style="background:#111;color:white"><th style="padding:8px 10px;text-align:left">Attivita</th><th style="padding:8px 10px;text-align:center">Maps</th><th style="padding:8px 10px;text-align:center">Google</th><th style="padding:8px 10px;text-align:center">Rating</th><th style="padding:8px 10px;text-align:center">Rec.</th><th style="padding:8px 10px;text-align:center">% Risp.</th><th style="padding:8px 10px;text-align:center">Sito</th></tr></thead><tbody>';
      competitor.forEach(function(c,i){
        body += '<tr style="background:'+(i%2===0?'white':'#fafafa')+';border-bottom:1px solid #f0f0f0">';
        body += '<td style="padding:8px 10px;font-weight:600">'+c.nome.replace(/[<>]/g,'')+(c.sito_dom?'<br><span style="font-size:8pt;color:#1565c0">'+c.sito_dom+'</span>':'')+'</td>';
        body += '<td style="padding:8px 10px;text-align:center"><span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_maps+'</span></td>';
        body += '<td style="padding:8px 10px;text-align:center">'+(c.posizione_serp?'<span style="background:#e8f5e9;color:#2e7d32;padding:2px 7px;border-radius:4px;font-weight:700">#'+c.posizione_serp+'</span>':'<span style="color:#aaa">N/T</span>')+'</td>';
        body += '<td style="padding:8px 10px;text-align:center">'+(c.rating?'<strong>'+c.rating+'</strong>/5':'N/D')+'</td>';
        body += '<td style="padding:8px 10px;text-align:center">'+c.n_recensioni+'</td>';
        body += '<td style="padding:8px 10px;text-align:center">'+(c.rec_comp?'<span style="font-weight:700;color:'+(c.rec_comp.perc>=70?'#2e7d32':c.rec_comp.perc>=30?'#e65100':'#c62828')+'">'+c.rec_comp.perc+'%</span>':'<span style="color:#aaa">N/D</span>')+'</td>';
        body += '<td style="padding:8px 10px;text-align:center">'+(c.ha_sito?'<span style="color:#2e7d32;font-weight:700">Si</span>':'<span style="color:#c62828;font-weight:700">No</span>')+'</td></tr>';
      });
      // Gap analysis
      var cConSito = competitor.filter(function(c){ return c.ha_sito; }).length;
      var cSerp = competitor.filter(function(c){ return c.posizione_serp; }).length;
      body += '</tbody></table></div>';
      body += '<div style="margin-top:10px;padding:10px 14px;background:#fff8e1;border:1px solid #ffe082;border-radius:8px"><div style="font-size:9pt;font-weight:700;color:#795548;margin-bottom:6px">Gap Analysis</div>';
      if (!web && cConSito>0) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:3px">! Sito: '+cConSito+'/'+competitor.length+' competitor ce l\'hanno, tu no</div>';
      if (cSerp>0 && !(seo&&seo.posizione&&seo.posizione<=30)) body += '<div style="font-size:9pt;color:#6d4c00;margin-bottom:3px">! SERP: '+cSerp+' competitor in Google, tu non sei trovato</div>';
      body += '</div></div>';
    }

    // SOCIAL
    if (social.facebook || social.instagram) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="display:flex;gap:12px;flex-wrap:wrap">';
      if (social.facebook) body += '<div style="flex:1;min-width:140px;border:1px solid #1877f2;border-radius:10px;overflow:hidden"><div style="background:#1877f2;padding:8px 14px"><span style="color:white;font-weight:700">Facebook</span></div><div style="padding:10px 14px">'+(social.facebook_follower?'<div style="font-size:1.2rem;font-weight:800;color:#1877f2;margin-bottom:5px">'+social.facebook_follower+'</div>':'')+'<a href="'+social.facebook+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#1877f2;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      if (social.instagram) body += '<div style="flex:1;min-width:140px;border:1px solid #e1306c;border-radius:10px;overflow:hidden"><div style="background:#e1306c;padding:8px 14px"><span style="color:white;font-weight:700">Instagram</span></div><div style="padding:10px 14px">'+(social.instagram_follower?'<div style="font-size:1.2rem;font-weight:800;color:#e1306c;margin-bottom:5px">'+social.instagram_follower+'</div>':'')+'<a href="'+social.instagram+'" target="_blank" style="display:inline-block;padding:5px 12px;background:#e1306c;color:white;border-radius:6px;font-size:9pt;font-weight:600;text-decoration:none">Apri profilo</a></div></div>';
      body += '</div></div>';
    } else {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Profili Social</div><div style="'+box+';border-left:4px solid #c62828"><div style="color:#c62828;font-weight:600;margin-bottom:4px">Nessun profilo social trovato</div></div></div>';
    }

    // VISIBILITA AI
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div><div style="display:flex;gap:14px;flex-wrap:wrap">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:100px"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:8px">Le AI generative (Gemini, ChatGPT) citano le attivita presenti su fonti che scansionano: Google Maps, sito web, social, stampa locale. Piu fonti presenti = piu probabilita di essere citati per "'+categoria+' a '+citta+'".</div><div style="display:flex;flex-direction:column;gap:4px">';
    ai.dettagli.forEach(function(d){ body += '<div style="font-size:9pt;color:'+(d.ok?'#2e7d32':'#c62828')+'">'+(d.ok?'&#10003; ':'&#10007; ')+d.label+'</div>'; });
    body += '</div></div></div></div>';

    // ANALISI STRATEGICA - skeleton caricato in background
    // Tasto proposta PRIMA dell'analisi strategica - cos il codice non si mescola mai
    var htmlTasto =
      '<div style="margin-top:24px;padding:20px 0;text-align:center" class="no-print" id="zona-proposta">'+
      '<button id="btn-prop" style="padding:14px 32px;background:#E8001C;color:white;border:none;border-radius:10px;font-size:12pt;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(232,0,28,0.3)">Genera Proposta Commerciale</button>'+
      '<div style="font-size:9pt;color:#aaa;margin-top:8px">Generata leggendo l\'analisi appena prodotta</div>'+
      '<div id="prop-cont" style="margin-top:16px"></div>'+
      '</div>';

    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div><div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7"><p style="margin-bottom:10px">'+strategia+'</p></div></div>';
    }

    // Tasto proposta - genera al click leggendo i dati analisi
    var tastoP =

      '<div id="prop-cont" style="margin-top:0"></div>';

    // Payload per analisi strategica (caricata dopo dal JS della pagina)
    var sp = JSON.stringify({
      nome:nome, categoria:categoria, citta:citta, web:web||null, rating:rating, nRating:nRating,
      pos_google: seo&&seo.posizione?('#'+seo.posizione):'non trovato',
      pos_maps: mapsPos?('#'+mapsPos):'non trovato',
      keyword: keyword,
      facebook: social.facebook?'presente':'assente',
      instagram: social.instagram?'presente':'assente',
      recensioni_perc: recensioni?recensioni.perc_risposta:null,
      recensioni_campione: recensioni?recensioni.campione:0,
      recensioni_pos: recensioni?recensioni.positive:0,
      recensioni_neg: recensioni?recensioni.negative:0,
      recensioni_testi: recensioni&&recensioni.testi?recensioni.testi.slice(0,10).map(function(r){return (r.rating||'?')+'/5: '+r.testo.slice(0,80);}).join(' | '):'nessuna',
      competitor: competitor.map(function(c){return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' '+(c.rating||'N/D')+'/5';}).join(', ')
    });

    var leadJson = JSON.stringify({ nome:nome, indirizzo:lead.indirizzo||'', web:web||null, telefono:lead.telefono||null, tipi:lead.tipi||[], rating:rating, nRating:nRating, descrizione:lead.descrizione||null, placeId:lead.placeId||null, categoria:categoria, citta:citta, logoUrl:lead.logoUrl||null });
    var lp = JSON.stringify(require('./proposal').PRODOTTI);

    var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f4f4f4;color:#1a1a1a}.pg{max-width:900px;margin:24px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}.hdr{background:#111;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}.t{font-size:13pt;font-weight:700;color:white}.s{font-size:9pt;color:rgba(255,255,255,0.5);margin-top:2px}.d{font-size:8.5pt;color:rgba(255,255,255,0.4)}.bd{padding:18px 26px 26px}.az{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;padding:14px 16px;background:#f9f9f9;border-radius:8px;border:1px solid #eee}.btn{padding:9px 18px;border:none;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer}.br{background:#E8001C;color:white}.bg{background:#2e7d32;color:white}.bgy{background:#f0f0f0;color:#555}@media print{.az,.no-print{display:none}body{background:white}.pg{box-shadow:none;border-radius:0;margin:0}#zona-proposta>div:first-child{display:none}button{display:none!important}}';

    var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analisi - '+nome.replace(/[<>]/g,'')+'</title><style>'+css+'</style></head><body>'+
      '<div class="pg"><div class="hdr"><div><div class="t">Analisi Digitale Prevendita</div><div class="s">Lead Agent - Pagine Si!</div></div><div class="d">'+oggi+'</div></div>'+
      '<div style="border-left:5px solid #E8001C;padding:13px 22px;margin:18px 26px 0;border-radius:0 8px 8px 0;border:1px solid #eee;border-left:5px solid #E8001C">'+
      '<div style="font-size:12pt;font-weight:700;margin-bottom:4px">'+nome.replace(/[<>]/g,'')+'</div>'+
      '<div style="font-size:9pt;color:#777;display:flex;gap:14px;flex-wrap:wrap">'+
      '<span>'+(lead.indirizzo||'').replace(/[<>]/g,'')+'</span>'+
      (web?'<span>Sito: <a href="'+web+'" target="_blank" style="color:#1565c0">'+web+'</a></span>':'<span style="color:#c62828">Nessun sito</span>')+
      (lead.telefono&&lead.telefono!=='N/D'?'<span>Tel: <a href="tel:'+lead.telefono+'" style="color:#1565c0">'+lead.telefono+'</a></span>':'')+
      '<span>Rating: '+(rating?rating+'/5 ('+nRating+' rec.)':'N/D')+'</span>'+
      '<span>'+categoria+' '+citta+'</span></div></div>'+
      '<div class="bd"><div class="az">'+
      '<button class="btn br" onclick="window.print()">Stampa / PDF</button>'+
      '<button class="btn bg" id="ba" onclick="apriAnt()">Anteprima Sito</button>'+
      '<button class="btn bgy" onclick="window.close()">Chiudi</button>'+
      '</div>'+
      body+
      htmlTasto+
      '</div></div>'+
      '<script>'+
      'var B="https://leadagent-backend.onrender.com";'+
      'var L='+leadJson+';'+
      'var SP='+sp+';'+
      'var _LP='+lp+';var _S=null;'+
      // Carica analisi strategica in background
      // Mostra proposta
      // Rimuovi riga proposta
      'function rmR(btn){var tr=btn.closest("tr");if(tr){tr.remove();updT();}}'+
      'function updT(){var a=0,m=0;document.querySelectorAll("#ptbl tbody tr").forEach(function(r){a+=parseFloat(r.dataset.a1||0);m+=parseFloat(r.dataset.mn||0);});var t=document.getElementById("pt1");var u=document.getElementById("ptm");if(t)t.textContent=a.toLocaleString("it-IT");if(u)u.textContent=m;}'+
      // Listino
      'function apriLP(){'+
      '  var cats={"Sito Web":["Si2A-PM","Si2RE-PM","Si2S-PM","Si2VN-PM"],"Directory":["WDSAL","WDSA"],"Google Maps":["GBP","GBPP","GBPAdv"],"Reputazione":["ISTQQ","ISTBS","ISTPS"],"Social":["SOC-SET","SOC-BAS","SOC-START","SOC-WEEK","SOC-FULL"],"SEO":["SIN","SMN","BLS10P"],"Google Ads":["ADW-E","ADW-S","SIADVLS","SIADVLG"],"Video":["VS1","VS4","VST30","VP"],"AI":["AI-ADLSET","AI-ADLABB"],"eCommerce":["EC-SMART","EC-GLOB"],"Automation":["Si4BLD","Si4BEN"]};'+
      '  var bd=document.getElementById("lp-body");bd.innerHTML="";'+
      '  for(var c in cats){var w=document.createElement("div");w.style.marginBottom="14px";var l=document.createElement("div");l.style.cssText="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;margin-bottom:6px";l.textContent=c;w.appendChild(l);var rw=document.createElement("div");rw.style.cssText="display:flex;flex-wrap:wrap;gap:4px";cats[c].forEach(function(s){var p=_LP[s];if(!p)return;var pr=p.mens?("\u20ac"+p.mens+"/mese"):(p.anno1?("\u20ac"+p.anno1+"/anno"):"");var btn=document.createElement("button");btn.id="lc-"+s;btn.dataset.s=s;btn.onclick=function(){selLP(this,this.dataset.s);};btn.style.cssText="padding:3px 9px;border-radius:12px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10px;color:#555;margin:2px";var b=document.createElement("b");b.style.cssText="font-family:monospace;color:#E8001C";b.textContent=s;btn.appendChild(b);btn.appendChild(document.createTextNode(" "+p.nome+" "+pr));rw.appendChild(btn);});w.appendChild(rw);bd.appendChild(w);}'+
      '  document.getElementById("lp-ov").style.display="flex";'+
      '}'+
      'function selLP(el,s){document.querySelectorAll("[id^=lc-]").forEach(function(e){e.style.background="#fff";e.style.borderColor="#e0e0e0";e.style.color="#555";});_S=s;el.style.background="#E8001C";el.style.borderColor="#E8001C";el.style.color="#fff";var b=document.getElementById("lp-ok");if(b){b.disabled=false;b.style.opacity="1";}}'+
      'function aggLP(){if(!_S)return;var p=_LP[_S];if(!p)return;var tb=document.querySelector("#ptbl tbody");var tr=document.createElement("tr");tr.dataset.a1=p.anno1||0;tr.dataset.mn=p.mens||0;tr.style.borderBottom="1px solid #f0f0f0";function mkTd(st){var td=document.createElement("td");td.style.cssText=st;return td;}var t0=mkTd("padding:9px 11px;font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600");t0.textContent=_S;var t1=mkTd("padding:9px 11px");var dn=document.createElement("div");dn.contentEditable="true";dn.style.cssText="font-weight:600;margin-bottom:2px";dn.textContent=p.nome;var dd=document.createElement("div");dd.contentEditable="true";dd.style.cssText="font-size:8.5pt;color:#777";dd.textContent=p.desc;t1.appendChild(dn);t1.appendChild(dd);var t2=mkTd("padding:9px 11px");var sp=document.createElement("span");sp.style.cssText="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:8.5pt";sp.textContent=p.cat;t2.appendChild(sp);var t3=mkTd("padding:9px 11px;text-align:right;font-weight:600");t3.textContent=p.anno1?"\u20ac "+p.anno1.toLocaleString("it-IT"):"\u2014";var t4=mkTd("padding:9px 11px;text-align:right;font-weight:600");t4.textContent=p.mens?"\u20ac "+p.mens+"/mese":"\u2014";var t5=mkTd("padding:9px 11px;text-align:center;width:28px");var rb=document.createElement("button");rb.onclick=function(){rmR(this);};rb.style.cssText="background:none;border:none;cursor:pointer;color:#ccc;font-size:13px";rb.innerHTML="\u2715";t5.appendChild(rb);[t0,t1,t2,t3,t4,t5].forEach(function(t){tr.appendChild(t);});tb.appendChild(tr);updT();chiudiLP();_S=null;}'+
      'function chiudiLP(){document.getElementById("lp-ov").style.display="none";}'+
      // Anteprima sito
      'function apriAnt(){'+
      '  var btn=document.getElementById("ba");if(btn){btn.disabled=true;btn.textContent="Generazione...";}'+
      '  var tab=window.open("","_blank");'+
      '  fetch(B+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:L.nome,indirizzo:L.indirizzo,telefono:L.telefono,tipi:L.tipi,rating:L.rating,nRating:L.nRating,descrizione:L.descrizione,logoUrl:L.logoUrl})})'+
      '  .then(function(r){return r.json();})'+
      '  .then(function(d){if(d.html&&tab&&!tab.closed){tab.document.open();tab.document.write(d.html);tab.document.close();}if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}})'+
      '  .catch(function(e){if(tab&&!tab.closed)tab.close();if(btn){btn.disabled=false;btn.textContent="Anteprima Sito";}});'+
      '}'+
      'function genProposta(){'+
      '  var me=document.getElementById("btn-prop");'+
      '  me.disabled=true;me.textContent="Generazione...";'+
      '  var cont=document.getElementById("prop-cont");'+
      '  var ldiv=document.createElement("div");'+
      '  ldiv.style.cssText="padding:24px;text-align:center;color:#aaa";'+
      '  ldiv.innerHTML="&#8987; Generazione proposta...";'+
      '  cont.innerHTML="";cont.appendChild(ldiv);'+
      '  var ar={ha_sito:!!(L.web&&L.web!=="N/D"),pos_google:SP.pos_google,pos_maps:SP.pos_maps,rec_perc:SP.recensioni_perc,rec_neg:SP.recensioni_neg,social_ok:(SP.facebook!=="assente"||SP.instagram!=="assente")};'+
      '  fetch(B+"/proposal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:L,consulente:"Consulente Pagine Si!",analisiReale:ar})})'+
      '  .then(function(r){return r.json();})'+
      '  .then(function(d){'+
      '    me.disabled=false;me.textContent="Genera Proposta Commerciale";'+
      '    if(d.html&&cont){'+
      '      cont.innerHTML="";'+
      '      var ifr=document.createElement("iframe");'+
      '      ifr.setAttribute("sandbox","allow-scripts allow-same-origin allow-modals");'+
      '      ifr.style.cssText="width:100%;border:2px solid #E8001C;border-radius:12px;margin-top:16px;min-height:600px";'+
      '      ifr.srcdoc=d.html;'+
      '      ifr.onload=function(){'+
      '        try{ifr.style.height=(ifr.contentDocument.body.scrollHeight+40)+"px";}catch(e){}'+
      '      };'+
      '      cont.appendChild(ifr);'+
      '      var btnStampa=document.createElement("button");'+
      '      btnStampa.textContent="Stampa / Esporta PDF (Analisi + Proposta)";'+
      '      btnStampa.style.cssText="margin-top:12px;padding:10px 24px;background:#111;color:white;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer";'+
      '      btnStampa.onclick=function(){'+
      '        try{ifr.contentWindow.print();}catch(e){window.print();}'+
      '      };'+
      '      cont.appendChild(btnStampa);'+
      '      setTimeout(function(){cont.scrollIntoView({behavior:"smooth"});},200);'+
      '    }'+
      '  })'+
      '  .catch(function(){me.disabled=false;me.textContent="Genera Proposta Commerciale";});}'+
      'document.getElementById("btn-prop").onclick=genProposta;'+
      '</script></body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Analisi strategica Claude - endpoint separato
app.post('/analisi-strategica', async function(req, res) {
  try {
    var d = req.body;
    var dati = [
      'Attivita: '+d.nome+' ('+d.categoria+' a '+d.citta+')',
      'Sito: '+(d.web||'assente'),
      'Rating: '+(d.rating||'N/D')+'/5 con '+(d.nRating||0)+' recensioni',
      'Posizione Google "'+d.keyword+'": '+d.pos_google,
      'Posizione Maps: '+d.pos_maps,
      'Facebook: '+d.facebook,
      'Instagram: '+d.instagram,
      'Gestione recensioni: '+(d.recensioni_perc!==null?d.recensioni_perc+'% risposte su '+d.recensioni_campione+' analizzate, '+d.recensioni_pos+' pos, '+d.recensioni_neg+' neg':'N/D'),
      'Ultime recensioni: '+(d.recensioni_testi||'nessuna'),
      'Competitor: '+(d.competitor||'N/D')
    ].join('\n');
    var prompt = 'Sei un senior digital marketing strategist italiano per PMI locali. Analizza questi dati reali e produci una analisi strategica completa.\n\nDATI REALI:\n'+dati+'\n\nPRODUCI (usa **Titolo** in grassetto per ogni sezione, sii specifico con numeri reali):\n\n**Situazione Attuale**\nDescrivi i 3-4 gap critici piu urgenti usando numeri reali. Cita posizioni esatte, percentuali, confronti competitor.\n\n**Analisi Recensioni**\nPunti di forza, punti deboli ricorrenti e criticita operative dalle recensioni. Sii specifico.\n\n**Obiettivi a 90 Giorni**\n4 obiettivi SMART con numeri precisi basati sui dati reali.\n\n**Obiettivi a 6 Mesi**\n4 proiezioni concrete con stima impatto.\n\n**Strategia Social Media**\nStrateia dettagliata Reels per questa categoria specifica. 5 idee di contenuto concrete.\n\n**Priorita di Intervento**\nI 3 servizi Pagine Si! piu urgenti con motivazione basata sui dati.';
    var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
    });
    var aiData = await aiResp.json();
    if (aiData.content && aiData.content[0] && aiData.content[0].text) {
      var testo = aiData.content[0].text
        .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
        .split('\n\n').join('</p><p style="margin-bottom:10px">')
        .split('\n').join('<br>');
      return res.json({ testo: testo });
    }
    res.json({ testo: '' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function(){ console.log('LeadAgent Backend running on port ' + PORT); });
