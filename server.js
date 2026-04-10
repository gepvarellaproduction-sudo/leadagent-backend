const express = require('express');
const cors = require('cors');
const app = express();
 
app.use(cors());
app.use(express.json({ limit: '2mb' }));
 
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
 
// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'LeadAgent Backend — Pagine Si!' }));
 
// ── /analyze ───────────────────────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  try {
    const { messages, maxTokens } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens || 1000,
        messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// ── /places ────────────────────────────────────────────────────────────────
app.post('/places', async (req, res) => {
  try {
    const { query, pageToken } = req.body;
    let url = `https://places.googleapis.com/v1/places:searchText`;
    const body = {
      textQuery: query,
      languageCode: 'it',
      regionCode: 'IT',
      maxResultCount: 20
    };
    if (pageToken) body.pageToken = pageToken;
 
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.editorialSummary,places.types,places.photos,nextPageToken'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });
    res.json({ places: data.places || [], nextPageToken: data.nextPageToken || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// ── /preview ───────────────────────────────────────────────────────────────
app.post('/preview', async (req, res) => {
  try {
    const { nome, indirizzo, telefono, tipi, descrizione, rating, nRating, logoUrl } = req.body;
    const prompt = `Crea un sito web aziendale professionale e moderno in HTML completo per questa attività italiana.
 
Nome: ${nome}
Indirizzo: ${indirizzo}
Telefono: ${telefono || 'da definire'}
Tipo attività: ${(tipi || []).join(', ')}
Descrizione: ${descrizione || 'attività locale italiana'}
Rating Google: ${rating || 'N/D'} (${nRating || 0} recensioni)
${logoUrl ? `Logo URL: ${logoUrl}` : ''}
 
Crea un sito COMPLETO con:
1. Header con nome, nav (Chi siamo, Servizi, Contatti)
2. Hero section impattante con headline e CTA
3. Sezione "Chi siamo" con testo credibile
4. Sezione servizi con 4-6 card
5. Testimonianze (3-4 clienti con nomi italiani)
6. Sezione contatti con indirizzo, telefono, orari tipici del settore
7. Footer con P.IVA inventata, "Sito realizzato da Pagine Sì!"
 
RISPONDI SOLO CON HTML COMPLETO. Inizia con <!DOCTYPE html>.`;
 
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
 
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
 
    let html = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    html = html.trim().replace(/^```html?\n?/, '').replace(/\n?```$/, '');
    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
 
// ── /seo-analyze ───────────────────────────────────────────────────────────
app.post('/seo-analyze', async (req, res) => {
  try {
    const { nome, indirizzo, web, rating, nRating, telefono, tipi } = req.body;
    if (!nome) return res.status(400).json({ error: 'Lead mancante' });
 
    const hasSito = !!web;
    const prompt = `Sei un esperto di digital marketing italiano. Analizza la presenza digitale di questa attività e rispondi SOLO con un oggetto JSON valido, senza testo aggiuntivo prima o dopo.
 
Attività: ${nome}
Indirizzo: ${indirizzo}
Sito web: ${web || 'NON PRESENTE'}
Rating Google: ${rating || 'N/D'} (${nRating || 0} recensioni)
Telefono: ${telefono ? 'presente' : 'assente'}
Tipo attività: ${(tipi || []).slice(0,3).join(', ') || 'attività locale'}
 
${hasSito ? 'Analizza la presenza digitale considerando le best practice SEO 2024 per il mercato italiano.' : 'Il sito web è assente — questo è già un problema critico che impatta tutto il resto.'}
 
Rispondi SOLO con questo JSON (nessun testo fuori):
{
  "seo_score": <numero 0-100>,
  "seo_livello": "<ottimo|buono|scarso|critico>",
  "seo_items": [
    {"label": "Sito web", "stato": "<ok|warning|error>", "valore": "<descrizione breve>"},
    {"label": "Visibilità Google Maps", "stato": "<ok|warning|error>", "valore": "<stima visibilità locale>"},
    {"label": "Recensioni", "stato": "<ok|warning|error>", "valore": "<${nRating} recensioni — valutazione>"},
    {"label": "Rating", "stato": "<ok|warning|error>", "valore": "<${rating || 'non disponibile'}>"},
    {"label": "SEO locale", "stato": "<ok|warning|error>", "valore": "<ottimizzazione parole chiave locali>"},
    {"label": "Presenza mobile", "stato": "<ok|warning|error>", "valore": "<stima ottimizzazione mobile>"}
  ],
  "social_score": <numero 0-100>,
  "social_livello": "<ottimo|buono|scarso|critico>",
  "social_items": [
    {"label": "Facebook/Instagram", "stato": "<ok|warning|error>", "valore": "<stima presenza per questo settore>"},
    {"label": "Contenuti video", "stato": "<ok|warning|error>", "valore": "<stima produzione video>"},
    {"label": "Engagement stimato", "stato": "<ok|warning|error>", "valore": "<stima basata sul settore>"},
    {"label": "Google Business Posts", "stato": "<ok|warning|error>", "valore": "<stima aggiornamenti profilo>"}
  ],
  "opportunita": ["<opportunità specifica 1>", "<opportunità specifica 2>", "<opportunità specifica 3>"],
  "servizi_urgenti": ["<servizio Pagine Sì! consigliato 1>", "<servizio 2>"]
}`;
 
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
 
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
 
    const raw = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const j1 = raw.indexOf('{'), j2 = raw.lastIndexOf('}');
    if (j1 === -1) return res.status(500).json({ error: 'Analisi non valida' });
    const analisi = JSON.parse(raw.slice(j1, j2 + 1));
 
    res.json({ analisi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// ── /proposal ─────────────────────────────────────────────────────────────
app.post('/proposal', async (req, res) => {
  try {
    const { lead, consulente, sigleExtra, analisiDigitale } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });
 
    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    const scadenza = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
 
    // ── LISTINO ──────────────────────────────────────────────────────────
    const LISTINO = {
      'Si2A-PM':   { n: 'Sì!2Site Atom',                  cat: 'Sito Web',             anno1: 708,   mens: 59   },
      'Si2RE-PM':  { n: 'Sì!2Site Ready',                 cat: 'Sito Web',             anno1: 1116,  mens: 93   },
      'Si2S-PM':   { n: 'Sì!2Site Super',                 cat: 'Sito Web',             anno1: 1524,  mens: 127  },
      'Sì2VN-PM':  { n: 'Sì!2Site Vertical',              cat: 'Sito Web',             anno1: 1692,  mens: 141  },
      'WDSAL':     { n: 'Scheda Light PagineSi.it',        cat: 'Directory',            anno1: 280,   mens: null },
      'WDSA':      { n: 'Scheda Azienda PagineSi.it',      cat: 'Directory',            anno1: 456,   mens: 38   },
      'WDSAV':     { n: 'Scheda Azienda + Video',          cat: 'Directory',            anno1: 490,   mens: null },
      'GBP':       { n: 'Google Business Profile',         cat: 'Google Maps',          anno1: 211,   mens: null },
      'GBPP':      { n: 'GBP Plus',                        cat: 'Google Maps',          anno1: 878,   mens: null },
      'GBPAdv':    { n: 'GBP Advanced',                    cat: 'Google Maps',          anno1: 3455,  mens: null },
      'ISTQQ':     { n: 'Instatrust QR Code',              cat: 'Reputazione',          anno1: 696,   mens: 58   },
      'ISTBS':     { n: 'Instatrust Business',             cat: 'Reputazione',          anno1: 828,   mens: 69   },
      'ISTPS':     { n: 'Instatrust Premium',              cat: 'Reputazione',          anno1: 960,   mens: 80   },
      'SOC-SET':   { n: 'Social Set Up FB+IG',             cat: 'Social Media',         anno1: 399,   mens: null },
      'SOC-BAS':   { n: 'Social Basic',                    cat: 'Social Media',         anno1: 1320,  mens: 110  },
      'SOC-START': { n: 'Social Start',                    cat: 'Social Media',         anno1: 2256,  mens: 188  },
      'SOC-WEEK':  { n: 'Social Week',                     cat: 'Social Media',         anno1: 3840,  mens: 320  },
      'SOC-FULL':  { n: 'Social Full',                     cat: 'Social Media',         anno1: 6540,  mens: 545  },
      'SIN':       { n: 'SEO In Site',                     cat: 'SEO',                  anno1: 1596,  mens: 133  },
      'SMN':       { n: 'SEO Main',                        cat: 'SEO',                  anno1: 1596,  mens: 133  },
      'BLS10P':    { n: 'Blog 10 articoli',                cat: 'SEO',                  anno1: 990,   mens: null },
      'ADW-E':     { n: 'Google Ads Entry',                cat: 'Google Ads',           anno1: 450,   mens: null },
      'ADW-S':     { n: 'Google Ads Standard',             cat: 'Google Ads',           anno1: 850,   mens: null },
      'SIADVLS':   { n: 'SìAdv Locale Setup',              cat: 'Google Ads',           anno1: 200,   mens: null },
      'SIADVLG':   { n: 'SìAdv Locale Gestione',          cat: 'Google Ads',           anno1: 3000,  mens: 250  },
      'Si4LMB':    { n: 'Lead Gen Meta Base',              cat: 'Google Ads',           anno1: 767,   mens: null },
      'Si4LMM':    { n: 'Lead Gen Meta Medium',            cat: 'Google Ads',           anno1: 933,   mens: null },
      'VS1':       { n: 'Video Social 1',                  cat: 'Video',                anno1: 290,   mens: null },
      'VS4':       { n: 'Video Social 4',                  cat: 'Video',                anno1: 790,   mens: null },
      'VST30':     { n: 'Video Standard 30"',              cat: 'Video',                anno1: 690,   mens: null },
      'VP':        { n: 'Video Premium',                   cat: 'Video',                anno1: 1900,  mens: null },
      'AI-ADLSET': { n: 'Assistente Digitale Light Setup', cat: 'AI',                   anno1: 613,   mens: null },
      'AI-ADLABB': { n: 'Assistente Digitale Light Abb.',  cat: 'AI',                   anno1: 996,   mens: 83   },
      'AI-ADISET': { n: 'Assistente Digitale Intell.',     cat: 'AI',                   anno1: 863,   mens: null },
      'EC-SMART':  { n: 'Smart eCommerce',                 cat: 'eCommerce',            anno1: 1332,  mens: 111  },
      'EC-GLOB':   { n: 'Global eCommerce',                cat: 'eCommerce',            anno1: 2112,  mens: 176  },
      'Si4BLD':    { n: 'Sì!4Business Lead',               cat: 'Marketing Auto.',      anno1: 912,   mens: 76   },
      'Si4BEN':    { n: 'Sì!4Business Engage',             cat: 'Marketing Auto.',      anno1: 1140,  mens: 95   },
    };
 
    // ── SELEZIONE AUTOMATICA PRODOTTI ────────────────────────────────────
    function selezionaProdotti(lead, extra) {
      const hasSito = lead.web && lead.web !== 'N/D';
      const pocheRec = (lead.nRating || 0) < 20;
      const ratingBasso = lead.rating && lead.rating < 3.5;
      const sigle = new Set(extra || []);
 
      if (!hasSito) sigle.add('Si2RE-PM');
      if (!hasSito || pocheRec) sigle.add('WDSA');
      if (pocheRec || ratingBasso) sigle.add('ISTBS');
      if (pocheRec) sigle.add('GBP');
      if (!hasSito) sigle.add('SOC-SET');
      else if (pocheRec) sigle.add('SOC-BAS');
      if (hasSito && !pocheRec) sigle.add('SIN');
 
      return [...sigle].filter(s => LISTINO[s]).map(s => ({ s, ...LISTINO[s] }));
    }
 
    const prodotti = selezionaProdotti(lead, sigleExtra || []);
    let totAnno1 = prodotti.reduce((a, p) => a + (p.anno1 || 0), 0);
    let totMens = prodotti.reduce((a, p) => a + (p.mens || 0), 0);
 
    // ── SEZIONE ANALISI DIGITALE (se presente) ────────────────────────
    let analisiSection = '';
    if (analisiDigitale) {
      const a = analisiDigitale;
      const seoColor = a.seo_score >= 60 ? '#2e7d32' : a.seo_score >= 35 ? '#f57f17' : '#c62828';
      const socColor = a.social_score >= 60 ? '#2e7d32' : a.social_score >= 35 ? '#f57f17' : '#c62828';
 
      const seoItemsHtml = (a.seo_items || []).map(item => {
        const icon = item.stato === 'ok' ? '✅' : item.stato === 'warning' ? '⚠️' : '❌';
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;font-size:11px;font-weight:600;color:#333;">${icon} ${item.label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;font-size:11px;color:#666;">${item.valore}</td>
        </tr>`;
      }).join('');
 
      const socialItemsHtml = (a.social_items || []).map(item => {
        const icon = item.stato === 'ok' ? '✅' : item.stato === 'warning' ? '⚠️' : '❌';
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;font-size:11px;font-weight:600;color:#333;">${icon} ${item.label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;font-size:11px;color:#666;">${item.valore}</td>
        </tr>`;
      }).join('');
 
      const oppsHtml = (a.opportunita || []).map(opp =>
        `<div style="display:flex;gap:8px;align-items:flex-start;background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:11px;color:#5d4037;">
          <span>💡</span><span>${opp}</span>
        </div>`
      ).join('');
 
      analisiSection = `
      <!-- ANALISI DIGITALE -->
      <div style="margin-bottom:28px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <span>📊 Analisi presenza digitale prevendita</span>
          <span style="flex:1;height:1px;background:#f0f0f0;display:inline-block;"></span>
        </div>
 
        <!-- Score box -->
        <div style="display:flex;gap:16px;margin-bottom:18px;">
          <div style="flex:1;background:#f9f9f9;border-radius:10px;padding:16px 20px;border:1px solid #eee;text-align:center;">
            <div style="font-size:2rem;font-weight:800;color:${seoColor};letter-spacing:-0.04em;">${a.seo_score}<span style="font-size:1rem;font-weight:400;color:#aaa;">/100</span></div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin-top:4px;">SEO Score</div>
            <div style="font-size:11px;color:${seoColor};font-weight:600;margin-top:2px;">${a.seo_livello ? a.seo_livello.toUpperCase() : ''}</div>
          </div>
          <div style="flex:1;background:#f9f9f9;border-radius:10px;padding:16px 20px;border:1px solid #eee;text-align:center;">
            <div style="font-size:2rem;font-weight:800;color:${socColor};letter-spacing:-0.04em;">${a.social_score}<span style="font-size:1rem;font-weight:400;color:#aaa;">/100</span></div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin-top:4px;">Social Score</div>
            <div style="font-size:11px;color:${socColor};font-weight:600;margin-top:2px;">${a.social_livello ? a.social_livello.toUpperCase() : ''}</div>
          </div>
        </div>
 
        <!-- SEO Items -->
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;">🔍 SEO e presenza online</div>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            ${seoItemsHtml}
          </table>
        </div>
 
        <!-- Social Items -->
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;">📱 Social Media</div>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            ${socialItemsHtml}
          </table>
        </div>
 
        <!-- Opportunità -->
        ${oppsHtml ? `<div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;margin-bottom:8px;">💡 Opportunità identificate</div>
          ${oppsHtml}
        </div>` : ''}
      </div>`;
    }
 
    // ── RIGHE PRODOTTI ────────────────────────────────────────────────────
    const righeHTML = prodotti.map(p => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-size:11px;font-family:monospace;font-weight:700;color:#E8001C;">${p.s}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-size:12px;color:#333;font-weight:500;">${p.n}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-size:11px;color:#888;">${p.cat}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-size:12px;font-weight:600;text-align:right;color:#333;">€ ${(p.anno1 || 0).toLocaleString('it-IT')}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f5f5f5;font-size:11px;text-align:right;color:#888;">${p.mens ? '€ ' + p.mens + '/mese' : '—'}</td>
      </tr>`).join('');
 
    // ── SEGNALI LEAD ─────────────────────────────────────────────────────
    const segnaliHTML = [];
    if (!lead.web || lead.web === 'N/D') segnaliHTML.push('<span style="display:inline-block;background:#fff0f2;color:#E8001C;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:2px;">❌ Nessun sito web</span>');
    if ((lead.nRating || 0) < 20) segnaliHTML.push(`<span style="display:inline-block;background:#fff8e1;color:#f57f17;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:2px;">⚠️ ${lead.nRating || 0} recensioni</span>`);
    if (lead.rating && lead.rating < 3.5) segnaliHTML.push(`<span style="display:inline-block;background:#fff0f2;color:#E8001C;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:2px;">⚠️ Rating ${lead.rating}/5</span>`);
    if (lead.rating && lead.rating >= 4.0) segnaliHTML.push(`<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin:2px;">✅ Rating ${lead.rating}/5</span>`);
 
    // ── HTML PROPOSTA ─────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta — ${lead.nome}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f4f4f4;color:#1a1a1a;font-size:11pt}
.page{max-width:860px;margin:0 auto;background:white;box-shadow:0 4px 40px rgba(0,0,0,0.12)}
.cover{background:#111;color:white;padding:52px 52px 40px;position:relative;overflow:hidden}
.cover-bg1{position:absolute;top:-60px;right:-60px;width:260px;height:260px;background:#E8001C;border-radius:50%;opacity:0.1}
.cover-bg2{position:absolute;bottom:-30px;left:120px;width:100px;height:100px;background:#E8001C;border-radius:50%;opacity:0.06}
.logo-row{display:flex;align-items:center;gap:12px;margin-bottom:40px}
.logo-sq{width:40px;height:40px;background:#E8001C;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:white;letter-spacing:-1px}
.logo-name{font-size:15px;font-weight:700;color:white}
.logo-sub{font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.06em;text-transform:uppercase}
.cover h1{font-size:2.2rem;font-weight:800;letter-spacing:-0.04em;line-height:1.1;margin-bottom:0.5rem}
.cover h1 em{font-style:normal;color:#E8001C}
.cover-sub{font-size:0.9rem;color:rgba(255,255,255,0.4);font-weight:300}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #f0f0f0}
.meta-item{padding:16px 20px;border-right:1px solid #f0f0f0}
.meta-item:last-child{border-right:none}
.meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#aaa;margin-bottom:4px}
.meta-value{font-size:13px;font-weight:600;color:#1a1a1a}
.body{padding:32px 48px 40px}
.section-title{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#aaa;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.section-title::after{content:'';flex:1;height:1px;background:#f0f0f0}
.az-card{background:#f9f9f9;border-radius:10px;padding:18px 20px;margin-bottom:24px}
.az-nome{font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
.az-addr{font-size:12px;color:#888;margin-bottom:12px}
.az-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.az-row{display:flex;gap:8px;font-size:11px}
.az-lbl{color:#aaa;min-width:70px}
.az-val{color:#333;font-weight:500}
.pitch{background:#fff8e1;border-left:3px solid #E8001C;padding:10px 14px;border-radius:0 6px 6px 0;font-size:12px;color:#5d4037;margin-bottom:24px}
.table-wrap{margin-bottom:24px;border-radius:8px;overflow:hidden;border:1px solid #eee}
.totale{background:#E8001C;color:white;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.tot-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7}
.tot-amount{font-size:1.6rem;font-weight:800;letter-spacing:-0.04em}
.tot-mens{text-align:right}
.edit-note{background:#f0f7ff;border:1px solid #bee3f8;border-radius:8px;padding:10px 14px;font-size:11px;color:#2b6cb0;margin-bottom:20px}
.foot{margin-top:28px;padding-top:16px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#bbb}
.foot strong{color:#E8001C}
@media print{body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{box-shadow:none;max-width:100%}.edit-note{display:none}}
</style>
</head>
<body>
<div class="page">
 
  <div class="cover">
    <div class="cover-bg1"></div>
    <div class="cover-bg2"></div>
    <div class="logo-row">
      <div class="logo-sq">P!</div>
      <div>
        <div class="logo-name">Pagine Sì!</div>
        <div class="logo-sub">Human Digital Company</div>
      </div>
    </div>
    <h1>Proposta Digitale<br><em>Personalizzata</em></h1>
    <div class="cover-sub">Comunicazione e Marketing Digitale su misura</div>
  </div>
 
  <div class="meta">
    <div class="meta-item"><div class="meta-label">Preparata per</div><div class="meta-value">${lead.nome}</div></div>
    <div class="meta-item"><div class="meta-label">Data</div><div class="meta-value">${oggi}</div></div>
    <div class="meta-item"><div class="meta-label">Consulente</div><div class="meta-value">${consulente || 'Consulente Pagine Sì!'}</div></div>
    <div class="meta-item"><div class="meta-label">Valida fino al</div><div class="meta-value">${scadenza}</div></div>
  </div>
 
  <div class="body">
 
    <div class="edit-note">
      ✏️ <strong>Proposta modificabile</strong> — Clicca sui valori per modificarli · <strong>Cmd+P → Salva come PDF</strong> per esportare
    </div>
 
    <!-- AZIENDA -->
    <div class="section-title">Azienda</div>
    <div class="az-card">
      <div class="az-nome">${lead.nome}</div>
      <div class="az-addr">📍 ${lead.indirizzo}</div>
      <div class="az-grid">
        <div class="az-row"><span class="az-lbl">Telefono</span><span class="az-val">${lead.telefono !== 'N/D' ? lead.telefono : '—'}</span></div>
        <div class="az-row"><span class="az-lbl">Sito web</span><span class="az-val">${lead.web !== 'N/D' ? lead.web : 'Non presente'}</span></div>
        <div class="az-row"><span class="az-lbl">Rating Google</span><span class="az-val">${lead.rating ? `${lead.rating}/5 (${lead.nRating} rec.)` : '—'}</span></div>
        <div class="az-row"><span class="az-lbl">Stato</span><span class="az-val">${lead.status || 'Attivo'}</span></div>
      </div>
      ${segnaliHTML.length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px;">${segnaliHTML.join('')}</div>` : ''}
    </div>
 
    <!-- DIAGNOSI -->
    <div class="section-title">Diagnosi digitale</div>
    <div class="pitch">${lead.pitch || 'Opportunità di crescita digitale identificata.'}</div>
 
    ${analisiSection}
 
    <!-- PROPOSTA -->
    <div class="section-title">Soluzione proposta</div>
    <div class="table-wrap">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f9f9f9;">
            <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">Sigla</th>
            <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">Soluzione</th>
            <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">Categoria</th>
            <th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">Anno 1</th>
            <th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;">Mensile</th>
          </tr>
        </thead>
        <tbody>${righeHTML}</tbody>
      </table>
    </div>
 
    <div class="totale">
      <div>
        <div class="tot-label">Investimento totale</div>
        <div class="tot-amount">€ ${totAnno1.toLocaleString('it-IT')}</div>
        <div style="font-size:10px;opacity:0.6;margin-top:2px;">Anno 1 · IVA esclusa</div>
      </div>
      ${totMens ? `<div class="tot-mens"><div class="tot-label">Canone mensile</div><div class="tot-amount">€ ${totMens.toLocaleString('it-IT')}/mese</div></div>` : ''}
    </div>
 
    <div class="foot">
      <div><strong>Pagine Sì! SpA</strong> · P.zza San Giovanni Decollato 1, 05100 Terni · paginesispa.it</div>
      <div>Prezzi IVA esclusa · Proposta valida 30 giorni · ${oggi}</div>
    </div>
 
  </div>
</div>
</body>
</html>`;
 
    res.json({ html, totale: totAnno1, prodotti });
 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LeadAgent Backend running on port ${PORT}`));
