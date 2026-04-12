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

// Visibilita AI score
function calcolaAI(web, social, nRating, rating, seo) {
  var score = 0, det = [];
  if (nRating >= 100) { score += 25; det.push('Google Maps: ottimo ('+nRating+' recensioni)'); }
  else if (nRating >= 30) { score += 15; det.push('Google Maps: buono ('+nRating+' recensioni)'); }
  else if (nRating > 0) { score += 8; det.push('Google Maps: debole ('+nRating+' recensioni)'); }
  else { det.push('Google Maps: assente'); }
  if (rating >= 4.5) score += 15; else if (rating >= 4.0) score += 10; else if (rating >= 3.5) score += 5;
  if (web) {
    if (seo && seo.posizione && seo.posizione <= 10) { score += 20; det.push('Sito: prima pagina Google'); }
    else if (seo && seo.posizione && seo.posizione <= 30) { score += 12; det.push('Sito: pagine 2-3 Google'); }
    else { score += 6; det.push('Sito: presente ma non indicizzato'); }
  } else { det.push('Sito web: assente'); }
  if (social.facebook && social.instagram) { score += 20; det.push('Social: FB + IG presenti'); }
  else if (social.facebook || social.instagram) { score += 10; det.push('Social: un profilo presente'); }
  else { det.push('Social: assenti'); }
  if (score >= 40) score += 5;
  score = Math.min(score, 100);
  return { score: score, livello: score>=70?'ALTA':score>=40?'MEDIA':'BASSA', colore: score>=70?'#2e7d32':score>=40?'#e65100':'#c62828', dettagli: det };
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
      for (var attempt = 0; attempt < 8; attempt++) {
        await new Promise(function(r){ setTimeout(r, 2000); });
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

    // 4. Analisi Claude
    var strategia = null;
    try {
      var recTesti = recensioni && recensioni.testi ? recensioni.testi.map(function(r){ return (r.rating||'?')+'/5: '+r.testo.slice(0,80); }).join(' | ') : 'nessuna';
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
        'Competitor: '+competitor.map(function(c){ return c.nome+' Maps#'+c.posizione_maps+(c.posizione_serp?'/Google#'+c.posizione_serp:'')+' '+c.rating+'/5'; }).join(', ')
      ].join('\n');
      var prompt = 'Sei un senior digital marketing strategist italiano per PMI locali. Analizza questi dati reali.\n\nDATI:\n'+datiStr+'\n\nPRODUCI (max 400 parole, **Titolo** per titoli in grassetto):\n**Situazione Attuale** - 2-3 gap critici con numeri reali\n**Analisi Recensioni** - punti forza, punti deboli, criticita dalle recensioni\n**Obiettivi a 90 Giorni** - 3 obiettivi con numeri specifici\n**Obiettivi a 6 Mesi** - 3 proiezioni concrete\n**Strategia Social** - uso Reels per questa categoria (3x reach vs post, +25-40% visite con 3+ reels/settimana)\n**Priorita Intervento** - i 3 servizi Pagine Si! piu urgenti';
      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
      });
      var aiData = await aiResp.json();
      if (aiData.content && aiData.content[0] && aiData.content[0].text) {
        strategia = aiData.content[0].text
          .split('**').map(function(t,i){ return i%2===1 ? '<strong>'+t+'</strong>' : t; }).join('')
          .split('\n\n').join('</p><p style="margin-bottom:10px">')
          .split('\n').join('<br>');
      }
    } catch(e) {}

    var ai = calcolaAI(web, social, nRating, rating, seo);
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
    body += '<div style="margin-bottom:24px"><div style="'+sec+'">Visibilita su AI (Gemini, ChatGPT)</div><div style="display:flex;gap:14px;flex-wrap:wrap">';
    body += '<div style="'+box+';flex-shrink:0;text-align:center;min-width:110px"><div style="font-size:3rem;font-weight:800;color:'+ai.colore+'">'+ai.score+'</div><div style="font-size:8.5pt;color:'+ai.colore+';font-weight:700;margin-top:4px">'+ai.livello+'</div><div style="font-size:8pt;color:#aaa;margin-top:3px">su 100</div></div>';
    body += '<div style="flex:1;'+box+'"><div style="font-size:9pt;color:#555;margin-bottom:8px">Le AI generative citano le attivita presenti su fonti autorevoli. Piu fonti = piu probabilita di essere citati per "'+categoria+' a '+citta+'".</div>';
    body += '<div style="display:flex;flex-direction:column;gap:4px">';
    ai.dettagli.forEach(function(d){
      var isP=d.indexOf('ottimo')>-1||d.indexOf('buono')>-1||d.indexOf('prima')>-1||d.indexOf('presenti')>-1||d.indexOf('unico')>-1;
      body += '<div style="font-size:9pt;color:'+(isP?'#2e7d32':'#c62828')+'">'+(isP?'+ ':'- ')+d+'</div>';
    });
    body += '</div></div></div></div>';

    // ANALISI STRATEGICA
    if (strategia) {
      body += '<div style="margin-bottom:24px"><div style="'+sec+'">Analisi Strategica e Obiettivi</div><div style="border:1.5px solid #E8001C;border-radius:8px;padding:18px 20px;font-size:9.5pt;color:#1a1a1a;line-height:1.7"><p style="margin-bottom:10px">'+strategia+'</p></div></div>';
    }

    // Dati lead per JS interno
    var leadJson = JSON.stringify({ nome:nome, indirizzo:lead.indirizzo||'', web:web||null, telefono:lead.telefono||null, tipi:lead.tipi||[], rating:rating, nRating:nRating, descrizione:lead.descrizione||null, fotoRefs:lead.fotoRefs||[], placeId:lead.placeId||null, categoria:categoria, citta:citta, logoUrl:lead.logoUrl||null });

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
      '</div></div>' +
      '<script>var B="https://leadagent-backend.onrender.com";var L='+leadJson+';' +
      'function toggleCP(){var p=document.getElementById("cp");p.style.display=p.style.display==="block"?"none":"block";if(p.style.display==="block")document.getElementById("ci").focus();}' +
      'function genProp(){' +
      '  var c=document.getElementById("ci").value.trim()||"Consulente Pagine Si!";' +
      '  document.getElementById("cp").style.display="none";' +
      '  var btn=document.getElementById("bp");btn.disabled=true;btn.textContent="Generazione...";' +
      '  fetch(B+"/proposal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead:L,consulente:c})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){if(d.html){var b=new Blob([d.html],{type:"text/html;charset=utf-8"});var u=URL.createObjectURL(b);var a=document.createElement("a");a.href=u;a.target="_blank";a.rel="noreferrer";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},60000);}btn.disabled=false;btn.textContent="Genera Proposta";})' +
      '  .catch(function(e){console.error(e);btn.disabled=false;btn.textContent="Genera Proposta";});' +
      '}' +
      'function apriAnt(){' +
      '  var btn=document.getElementById("ba");btn.disabled=true;btn.textContent="Generazione...";' +
      '  fetch(B+"/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome:L.nome,indirizzo:L.indirizzo,telefono:L.telefono,tipi:L.tipi,rating:L.rating,nRating:L.nRating,descrizione:L.descrizione,logoUrl:L.logoUrl})})' +
      '  .then(function(r){return r.json();})' +
      '  .then(function(d){if(d.html){var b=new Blob([d.html],{type:"text/html;charset=utf-8"});var u=URL.createObjectURL(b);var a=document.createElement("a");a.href=u;a.target="_blank";a.rel="noreferrer";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},60000);}btn.disabled=false;btn.textContent="Anteprima Sito";})' +
      '  .catch(function(e){console.error(e);btn.disabled=false;btn.textContent="Anteprima Sito";});' +
      '}' +
      '</script></body></html>';

    res.json({ html: html });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const { router: proposalRouter } = require('./proposal');
app.use('/proposal', proposalRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, function(){ console.log('LeadAgent Backend running on port ' + PORT); });
