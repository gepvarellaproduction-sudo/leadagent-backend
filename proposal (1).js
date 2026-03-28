const express = require('express');
const router = express.Router();

// Listino completo prodotti Pagine Si! 2026
const PRODOTTI = {
  // SITI WEB
  'Si2A-PM':    { nome: 'Sì!2Site Atom', cat: 'Sito Web', desc: 'Sito CMS base — HP + gallery + contatti', anno1: 945, mens: 59 },
  'Si2RE-PM':   { nome: 'Sì!2Site Ready', cat: 'Sito Web', desc: 'Sito CMS completo con blog e gallery', anno1: 1545, mens: 93 },
  'Si2S-PM':    { nome: 'Sì!2Site Super', cat: 'Sito Web', desc: 'Sito CMS avanzato con catalogo prodotti', anno1: 2150, mens: 127 },
  'Sì2VN-PM':   { nome: 'Sì!2Site Vertical', cat: 'Sito Web', desc: 'Sito WordPress professionale fino 10 pagine', anno1: 2350, mens: 141 },
  // DIRECTORY
  'WDSAL':      { nome: 'Scheda Azienda Light', cat: 'Directory PagineSi.it', desc: 'Scheda base su PagineSi.it — 15 parole chiave', anno1: 280, mens: null },
  'WDSA':       { nome: 'Scheda Azienda', cat: 'Directory PagineSi.it', desc: 'Scheda completa — 45 kw + 2 schede attività', anno1: 400, mens: 38 },
  'WDSAV':      { nome: 'Scheda Azienda Video', cat: 'Directory PagineSi.it', desc: 'Scheda con video in header — 45 kw', anno1: 490, mens: null },
  // GOOGLE BUSINESS PROFILE
  'GBP':        { nome: 'Google Business Profile', cat: 'Google Maps', desc: 'Lavorazione e ottimizzazione scheda Google Maps', anno1: 211, mens: null },
  'GBPP':       { nome: 'GBP Plus', cat: 'Google Maps', desc: 'Scheda Google con SEO, prodotti e statistiche', anno1: 878, mens: null },
  'GBPAdv':     { nome: 'GBP Advanced', cat: 'Google Maps', desc: 'Scheda Google con mini-sito, post mensili e kit in-store', anno1: 3455, mens: null },
  // REPUTAZIONE
  'ISTQQ':      { nome: 'Instatrust QR Code', cat: 'Reputazione', desc: 'Gestione recensioni con QR Code e analisi AI', anno1: 600, mens: 58 },
  'ISTBS':      { nome: 'Instatrust Business Suite', cat: 'Reputazione', desc: 'Suite completa recensioni multipiattaforma + AI', anno1: 722, mens: 69 },
  'ISTPS':      { nome: 'Instatrust Premium Suite', cat: 'Reputazione', desc: 'Suite premium con kit in-store incluso', anno1: 833, mens: 80 },
  // SOCIAL MEDIA
  'SOC-SET':    { nome: 'Social Set Up FB+IG', cat: 'Social Media', desc: 'Apertura e ottimizzazione pagina Facebook e profilo Instagram', anno1: 399, mens: null },
  'SOC-BAS':    { nome: 'Social Basic FB+IG', cat: 'Social Media', desc: '1 post/mese per canale — gestione professionale', anno1: 1320, mens: 110 },
  'SOC-START':  { nome: 'Social Start FB+IG', cat: 'Social Media', desc: '2 post/mese per canale — report bimestrale', anno1: 2256, mens: 188 },
  'SOC-WEEK':   { nome: 'Social Week FB+IG', cat: 'Social Media', desc: '4 post/mese per canale — 1 modifica/mese + report', anno1: 3840, mens: 320 },
  'SOC-FULL':   { nome: 'Social Full FB+IG', cat: 'Social Media', desc: '8 post/mese per canale — 2 modifiche/mese + report mensile', anno1: 6540, mens: 545 },
  // SEO
  'SIN':        { nome: 'SEO In Site', cat: 'SEO', desc: 'Posizionamento SEO su sito Pagine Sì!', anno1: 1390, mens: 133 },
  'SMN':        { nome: 'SEO Main', cat: 'SEO', desc: 'SEO su sito esterno con URL parlante', anno1: 1390, mens: 133 },
  'BLS10P':     { nome: 'SEO Blog 10 articoli', cat: 'SEO', desc: '10 articoli redazionali Copy SEO con caricamento', anno1: 990, mens: null },
  // ADVERTISING
  'ADW-E':      { nome: 'Google Ads Entry', cat: 'Google Ads', desc: 'Campagna Google Ads — durata min 40 giorni', anno1: 450, mens: null },
  'ADW-S':      { nome: 'Google Ads Standard', cat: 'Google Ads', desc: 'Campagna Google Ads Standard — durata min 60 giorni', anno1: 850, mens: null },
  'SIADVLS':    { nome: 'SìAdv Locale Setup', cat: 'Google Ads', desc: 'Setup campagna SìAdvertising Locale', anno1: 200, mens: null },
  'SIADVLG':    { nome: 'SìAdv Locale Gestione', cat: 'Google Ads', desc: 'Gestione mensile campagna SìAdvertising Locale', anno1: null, mens: 250 },
  'Si4LMB':     { nome: 'Lead Gen Meta Base', cat: 'Social Ads', desc: 'Campagna Lead Generation FB+IG — ADV fino 1.000€/mese', anno1: 767, mens: null },
  'Si4LMM':     { nome: 'Lead Gen Meta Medium', cat: 'Social Ads', desc: 'Campagna Lead Generation FB+IG — ADV 1.000-2.000€/mese', anno1: 933, mens: null },
  // VIDEO
  'VS1':        { nome: 'Video Social 1 video', cat: 'Video', desc: 'Nr 1 video 15-30" da foto/video cliente', anno1: 290, mens: null },
  'VS4':        { nome: 'Video Social 4 video', cat: 'Video', desc: 'Nr 4 video 15-30" da foto/video cliente', anno1: 790, mens: null },
  'VST30':      { nome: 'Video Standard 30"', cat: 'Video', desc: 'Video 30" da foto/video con speaker', anno1: 690, mens: null },
  'VP':         { nome: 'Video Premium', cat: 'Video', desc: 'Nr 3 video: 120"+30"+6" con operatore e speaker', anno1: 1900, mens: null },
  // AI
  'AI-ADLSET':  { nome: 'Assistente Digitale Light', cat: 'AI', desc: 'Chatbot AI sul sito web — setup e fine tuning', anno1: 613, mens: null },
  'AI-ADLABB':  { nome: 'Assistente Digitale Light Abb.', cat: 'AI', desc: 'Hosting e aggiornamento continuo chatbot AI', anno1: 999, mens: 83 },
  'AI-ADISET':  { nome: 'Assistente Digitale Intelligente', cat: 'AI', desc: 'ADI avanzato con fine tuning su sito e social', anno1: 863, mens: null },
  // ECOMMERCE
  'EC-SMART':   { nome: 'Smart eCommerce', cat: 'eCommerce', desc: 'Realizzazione sito eCommerce Smart', anno1: 1647, mens: 111 },
  'EC-GLOB':    { nome: 'Global eCommerce', cat: 'eCommerce', desc: 'eCommerce Prestashop con catalogo fino 5GB', anno1: 2657, mens: 176 },
  // Si4Business
  'Si4BLD':     { nome: 'Sì!4Business Lead', cat: 'Marketing Automation', desc: 'Piattaforma email/SMS marketing con 15.000 mail/mese', anno1: 790, mens: 76 },
  'Si4BEN':     { nome: 'Sì!4Business Engage', cat: 'Marketing Automation', desc: 'Lead + SMS aggiuntivi + fidelity card + calendario', anno1: 990, mens: 95 },
};

// Fasce di fatturato per tipo di attività
const FATTURATO_PER_SETTORE = {
  ristorante: { min: 150000, max: 600000, label: 'Ristorazione' },
  bar: { min: 80000, max: 250000, label: 'Bar/Caffetteria' },
  pizzeria: { min: 120000, max: 400000, label: 'Pizzeria' },
  hotel: { min: 300000, max: 3000000, label: 'Hospitality' },
  b_b: { min: 50000, max: 200000, label: 'B&B/Affittacamere' },
  parrucchiere: { min: 50000, max: 150000, label: 'Parrucchiere/Salone' },
  estetista: { min: 40000, max: 120000, label: 'Centro Estetico' },
  dentista: { min: 200000, max: 800000, label: 'Studio Dentistico' },
  medico: { min: 100000, max: 500000, label: 'Studio Medico' },
  avvocato: { min: 80000, max: 400000, label: 'Studio Legale' },
  commercialista: { min: 100000, max: 500000, label: 'Studio Commercialista' },
  palestra: { min: 100000, max: 600000, label: 'Palestra/Fitness' },
  negozio: { min: 100000, max: 500000, label: 'Negozio al Dettaglio' },
  farmacia: { min: 500000, max: 2000000, label: 'Farmacia' },
  agenzia_immobiliare: { min: 150000, max: 800000, label: 'Agenzia Immobiliare' },
  agenzia_viaggio: { min: 200000, max: 1000000, label: 'Agenzia Viaggi' },
  officina: { min: 100000, max: 400000, label: 'Officina/Carrozzeria' },
  supermercato: { min: 500000, max: 5000000, label: 'Supermercato' },
  default: { min: 100000, max: 400000, label: 'Attività Locale' }
};

// Moltiplicatore geografico
function moltiplicatoreGeo(indirizzo) {
  const addr = (indirizzo || '').toLowerCase();
  if (/milano|roma|torino|napoli|bologna|firenze/.test(addr)) return 1.8;
  if (/palermo|bari|catania|venezia|genova|verona/.test(addr)) return 1.2;
  if (/sicilia|calabria|sardegna|basilicata/.test(addr)) return 0.85;
  return 1.0;
}

// Rileva settore dai tipi Google Places
function rilevaSettore(tipi) {
  const t = (tipi || []).join(' ').toLowerCase();
  if (/restaurant|ristorante/.test(t)) return 'ristorante';
  if (/bar|cafe|coffee/.test(t)) return 'bar';
  if (/pizza/.test(t)) return 'pizzeria';
  if (/hotel|lodging/.test(t)) return 'hotel';
  if (/hair_care|parrucch/.test(t)) return 'parrucchiere';
  if (/beauty|estetica/.test(t)) return 'estetista';
  if (/dentist/.test(t)) return 'dentista';
  if (/doctor|medical/.test(t)) return 'medico';
  if (/lawyer|avvocato/.test(t)) return 'avvocato';
  if (/gym|fitness|palestra/.test(t)) return 'palestra';
  if (/store|shop|negozio/.test(t)) return 'negozio';
  if (/pharmacy|farmacia/.test(t)) return 'farmacia';
  if (/real_estate/.test(t)) return 'agenzia_immobiliare';
  if (/travel_agency/.test(t)) return 'agenzia_viaggio';
  if (/car_repair/.test(t)) return 'officina';
  return 'default';
}

// Stima fatturato
function stimaFatturato(lead) {
  const settore = rilevaSettore(lead.tipi);
  const fascia = FATTURATO_PER_SETTORE[settore] || FATTURATO_PER_SETTORE.default;
  const geo = moltiplicatoreGeo(lead.indirizzo);

  // Modifica in base alle recensioni (proxy volume clienti)
  let recMultiplier = 1.0;
  if (lead.nRating >= 500) recMultiplier = 1.5;
  else if (lead.nRating >= 200) recMultiplier = 1.3;
  else if (lead.nRating >= 100) recMultiplier = 1.1;
  else if (lead.nRating >= 50) recMultiplier = 1.0;
  else if (lead.nRating < 20) recMultiplier = 0.8;

  const fatMin = Math.round(fascia.min * geo * recMultiplier / 1000) * 1000;
  const fatMax = Math.round(fascia.max * geo * recMultiplier / 1000) * 1000;
  const fatMid = Math.round((fatMin + fatMax) / 2 / 1000) * 1000;

  // Budget digitale sostenibile: 1.5-2.5% del fatturato
  const budgetMensile = Math.round(fatMid * 0.018 / 12 / 10) * 10;

  return {
    settore,
    label: fascia.label,
    min: fatMin,
    max: fatMax,
    mid: fatMid,
    budgetMensileMax: Math.min(budgetMensile, 800), // cap a 800€/mese per PMI
    geo
  };
}

// Analisi digitale completa del lead
function analisiDigitale(lead) {
  const hasSito = lead.web && lead.web !== 'N/D';
  const pocheRec = (lead.nRating || 0) < 20;
  const ratingBasso = lead.rating && lead.rating < 3.5;
  const ratingMedio = lead.rating && lead.rating >= 3.5 && lead.rating < 4.0;

  return {
    hasSito,
    pocheRec,
    ratingBasso,
    ratingMedio,
    nRating: lead.nRating || 0,
    rating: lead.rating || null,
    // Segnali di bisogno
    bisogni: {
      sito: !hasSito,
      reputazione: ratingBasso || pocheRec,
      social: true, // sempre opportunità
      seo: hasSito, // SEO ha senso se ha già sito
      adv: (lead.nRating || 0) >= 20 || hasSito, // ADV ha senso se c'è già una base
      video: true, // sempre opportunità
      directory: true, // sempre
      gbp: pocheRec || !hasSito,
      ai: hasSito && (lead.nRating || 0) >= 30,
    }
  };
}

// Costruisce il preventivo bilanciato
function costruisciPreventivo(lead, fatturato, analisi) {
  const budget = fatturato.budgetMensileMax;
  const prodottiScelti = [];
  let totaleMens = 0;

  const aggiungi = (sigla, motivazione, priorita) => {
    const p = PRODOTTI[sigla];
    if (!p) return;
    const mens = p.mens || 0;
    if (totaleMens + mens <= budget * 1.2) { // 20% flessibilità
      prodottiScelti.push({ sigla, ...p, motivazione, priorita });
      totaleMens += mens;
    }
  };

  // PRIORITÀ 1 — Sito web (se manca)
  if (analisi.bisogni.sito) {
    if (budget < 150) aggiungi('Si2A-PM', 'Nessuna presenza web — sito base urgente', 1);
    else if (budget < 250) aggiungi('Si2RE-PM', 'Nessuna presenza web — sito completo con blog', 1);
    else aggiungi('Si2S-PM', 'Nessuna presenza web — sito avanzato con catalogo', 1);
  }

  // PRIORITÀ 1 — Directory (sempre, basso costo, alto valore)
  if (budget < 200) aggiungi('WDSAL', 'Visibilità immediata su PagineSi.it', 1);
  else aggiungi('WDSA', 'Visibilità su PagineSi.it con 45 parole chiave', 1);

  // PRIORITÀ 2 — Reputazione (se necessario)
  if (analisi.bisogni.reputazione) {
    if (analisi.ratingBasso) aggiungi('ISTBS', `Rating ${lead.rating}/5 — gestione recensioni urgente`, 2);
    else aggiungi('ISTQQ', `Solo ${lead.nRating} recensioni — accelerare la raccolta`, 2);
  }

  // PRIORITÀ 2 — Google Business Profile
  if (analisi.bisogni.gbp) {
    if (budget >= 400) aggiungi('GBPP', 'Ottimizzazione scheda Google con SEO locale', 2);
    else aggiungi('GBP', 'Ottimizzazione scheda Google Maps', 2);
  }

  // PRIORITÀ 3 — Social Media (sempre proposto, calibrato sul budget)
  if (analisi.bisogni.social) {
    if (budget < 200) aggiungi('SOC-BAS', 'Presenza social professionale — 1 post/mese FB+IG', 3);
    else if (budget < 400) aggiungi('SOC-START', 'Gestione social — 2 post/mese FB+IG con report', 3);
    else if (budget < 600) aggiungi('SOC-WEEK', 'Gestione social — 4 post/mese FB+IG con report', 3);
    else aggiungi('SOC-FULL', 'Gestione social completa — 8 post/mese FB+IG', 3);
  }

  // PRIORITÀ 3 — SEO
  if (analisi.bisogni.seo && totaleMens < budget * 0.8) {
    aggiungi(analisi.hasSito ? 'SMN' : 'SIN', 'Posizionamento sui motori di ricerca per parole chiave locali', 3);
  }

  // PRIORITÀ 4 — Video (se budget lo permette)
  if (totaleMens < budget * 0.7 && budget >= 300) {
    aggiungi('VS4', 'Contenuti video per social e web — 4 video professionali', 4);
  }

  // PRIORITÀ 4 — Advertising (se c'è margine)
  if (analisi.bisogni.adv && totaleMens < budget * 0.8 && budget >= 350) {
    aggiungi('SIADVLS', 'Setup campagna Google Ads locale', 4);
    aggiungi('SIADVLG', 'Gestione mensile campagna Google Ads', 4);
  }

  // PRIORITÀ 5 — AI (se c'è sito e budget)
  if (analisi.bisogni.ai && totaleMens < budget * 0.7 && budget >= 500) {
    aggiungi('AI-ADLSET', 'Chatbot AI sul sito per rispondere ai clienti H24', 5);
  }

  // Ordina per priorità
  prodottiScelti.sort((a, b) => a.priorita - b.priorita);

  return prodottiScelti;
}

// Genera HTML proposta
function generaHTML(lead, prodotti, fatturato, consulente) {
  const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const scadenza = new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const totAnno1 = prodotti.reduce((s, p) => s + (p.anno1 || 0), 0);
  const totMens = prodotti.reduce((s, p) => s + (p.mens || 0), 0);

  const categorieUsate = [...new Set(prodotti.map(p => p.cat))];

  const righe = prodotti.map((p, i) => `
    <tr>
      <td class="td-sigla">${p.sigla}</td>
      <td class="td-prod">
        <div class="p-nome">${p.nome}</div>
        <div class="p-desc">${p.desc}</div>
        <div class="p-mot">💡 ${p.motivazione}</div>
      </td>
      <td><span class="badge">${p.cat}</span></td>
      <td class="td-num">${p.anno1 ? '€ ' + p.anno1.toLocaleString('it-IT') : '—'}</td>
      <td class="td-num">${p.mens ? '€ ' + p.mens + '/mese' : '—'}</td>
    </tr>`).join('');

  const segnaliHTML = [];
  if (!lead.web || lead.web === 'N/D') segnaliHTML.push('<span class="tag bad">❌ Nessun sito web</span>');
  if ((lead.nRating || 0) < 20) segnaliHTML.push(`<span class="tag warn">⚠️ ${lead.nRating || 0} recensioni</span>`);
  if (lead.rating && lead.rating < 3.5) segnaliHTML.push(`<span class="tag bad">⚠️ Rating ${lead.rating}/5</span>`);
  if (lead.rating && lead.rating >= 4.0) segnaliHTML.push(`<span class="tag ok">✅ Rating ${lead.rating}/5</span>`);

  const catIcone = {
    'Sito Web': '🌐', 'Directory PagineSi.it': '📋', 'Google Maps': '📍',
    'Reputazione': '⭐', 'Social Media': '📱', 'SEO': '🔍',
    'Google Ads': '📢', 'Social Ads': '🎯', 'Video': '🎬',
    'AI': '🤖', 'eCommerce': '🛒', 'Marketing Automation': '⚙️'
  };

  const areeHTML = categorieUsate.map(cat => {
    const icona = catIcone[cat] || '•';
    return `<span class="area-tag">${icona} ${cat}</span>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta — ${lead.nome}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f4f4f4;color:#1a1a1a;font-size:11pt}

.page{max-width:900px;margin:0 auto;background:white;box-shadow:0 4px 40px rgba(0,0,0,0.12)}

/* COVER */
.cover{background:#111;color:white;padding:56px 52px 44px;position:relative;overflow:hidden}
.cover-bg1{position:absolute;top:-60px;right:-60px;width:280px;height:280px;background:#E8001C;border-radius:50%;opacity:0.12}
.cover-bg2{position:absolute;bottom:-30px;left:140px;width:120px;height:120px;background:#E8001C;border-radius:50%;opacity:0.07}
.logo-row{display:flex;align-items:center;gap:12px;margin-bottom:44px}
.logo-sq{width:42px;height:42px;background:#E8001C;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:white;letter-spacing:-1px}
.logo-txt{line-height:1.15}
.logo-txt b{display:block;font-size:15px;font-weight:700;color:white}
.logo-txt small{font-size:9.5pt;font-weight:300;color:rgba(255,255,255,0.45);letter-spacing:0.08em;text-transform:uppercase}
.cover h1{font-size:30pt;font-weight:800;letter-spacing:-0.04em;line-height:1.05;margin-bottom:10px}
.cover h1 em{font-style:normal;color:#E8001C}
.cover-sub{font-size:12pt;color:rgba(255,255,255,0.5);font-weight:300}

/* META */
.meta{background:#f9f9f9;border-bottom:1px solid #eee;padding:14px 52px;display:flex;gap:36px;flex-wrap:wrap}
.meta-i{display:flex;flex-direction:column;gap:2px}
.meta-l{font-size:8.5pt;color:#aaa;text-transform:uppercase;letter-spacing:0.07em;font-weight:500}
.meta-v{font-size:10.5pt;font-weight:600;color:#1a1a1a}

/* BODY */
.body{padding:40px 52px}

/* AZIENDA */
.az-card{border:1.5px solid #e8e8e8;border-left:5px solid #E8001C;border-radius:10px;padding:22px 26px;margin-bottom:28px}
.az-nome{font-size:16pt;font-weight:700;margin-bottom:3px}
.az-addr{font-size:10pt;color:#777;margin-bottom:14px}
.az-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:14px}
.az-row{display:flex;gap:8px;align-items:center;font-size:10pt}
.az-lbl{color:#aaa;font-size:9pt;min-width:68px}
.az-val{font-weight:500}
.tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px;padding-top:14px;border-top:1px solid #f0f0f0}
.tag{padding:4px 11px;border-radius:20px;font-size:9pt;font-weight:500}
.tag.bad{background:#fce8e8;color:#b71c1c}
.tag.warn{background:#fff3e0;color:#e65100}
.tag.ok{background:#e8f5e9;color:#2e7d32}

/* FATTURATO */
.fat-box{background:linear-gradient(135deg,#f8f8f8,#f0f0f0);border:1px solid #e0e0e0;border-radius:10px;padding:20px 26px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
.fat-item{text-align:center}
.fat-lbl{font-size:8.5pt;color:#aaa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px}
.fat-val{font-size:15pt;font-weight:700;color:#1a1a1a}
.fat-val span{color:#E8001C}
.fat-note{font-size:8.5pt;color:#bbb;margin-top:2px}

/* AREE */
.aree{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:26px}
.area-tag{padding:5px 14px;background:#fff0f2;color:#E8001C;border:1px solid #ffd0d5;border-radius:20px;font-size:9.5pt;font-weight:500}

/* SEZIONE */
.sec-title{font-size:10.5pt;font-weight:700;color:#E8001C;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #E8001C}

/* TABLE */
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:10pt}
thead tr{background:#111;color:white}
thead th{padding:10px 13px;text-align:left;font-size:8.5pt;font-weight:500;letter-spacing:0.04em}
tbody tr:nth-child(even){background:#fafafa}
tbody tr:hover{background:#fff5f5}
td{padding:11px 13px;border-bottom:1px solid #f0f0f0;vertical-align:top}
.td-sigla{font-family:monospace;font-size:8.5pt;color:#E8001C;font-weight:600;white-space:nowrap}
.p-nome{font-weight:600;margin-bottom:2px}
.p-desc{font-size:9pt;color:#777;margin-bottom:3px}
.p-mot{font-size:8.5pt;color:#aaa;font-style:italic}
.badge{display:inline-block;background:#f5f5f5;color:#555;font-size:8.5pt;padding:2px 9px;border-radius:4px;white-space:nowrap}
.td-num{font-weight:600;white-space:nowrap;text-align:right}

/* TOTALE */
.tot-box{background:#111;color:white;border-radius:10px;padding:22px 26px;margin-bottom:26px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:16px;align-items:center}
.tot-item{text-align:center}
.tot-lbl{font-size:8.5pt;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px}
.tot-val{font-size:20pt;font-weight:800}
.tot-val span{color:#E8001C}
.tot-note{font-size:8.5pt;color:rgba(255,255,255,0.3);margin-top:2px}
.tot-div{width:1px;background:rgba(255,255,255,0.1);height:50px}

/* PITCH */
.pitch{background:#fff8f8;border:1px solid #ffd0d5;border-left:4px solid #E8001C;border-radius:8px;padding:18px 22px;margin-bottom:26px}
.pitch h3{font-size:10.5pt;font-weight:700;color:#E8001C;margin-bottom:8px}
.pitch p{font-size:10pt;color:#555;line-height:1.7}

/* MODIFICABILE */
.edit-note{background:#fff9e6;border:1px solid #ffe082;border-radius:8px;padding:12px 18px;margin-bottom:26px;font-size:9.5pt;color:#795548;display:flex;align-items:center;gap:8px}

/* FOOTER */
.foot{margin-top:32px;padding-top:18px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:#bbb;flex-wrap:wrap;gap:12px}
.foot strong{color:#E8001C}

/* PRINT */
@media print{
  body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}
  .page{box-shadow:none;max-width:100%}
  .edit-note{display:none}
  .no-print{display:none}
}

/* EDITABLE */
.editable{outline:none;border-bottom:1px dashed #ccc;min-width:40px;display:inline-block}
.editable:focus{border-bottom:1px solid #E8001C;background:#fff9f9}
tr.removable td:first-child::before{content:'✕ ';opacity:0;transition:opacity 0.2s}
tr.removable:hover td:first-child::before{opacity:0.3;cursor:pointer}
</style>
</head>
<body>
<div class="page">

<div class="cover">
  <div class="cover-bg1"></div>
  <div class="cover-bg2"></div>
  <div class="logo-row">
    <div class="logo-sq">P!</div>
    <div class="logo-txt"><b>Pagine Sì!</b><small>Human Digital Company</small></div>
  </div>
  <h1>Proposta Digitale<br><em>Personalizzata</em></h1>
  <p class="cover-sub">Comunicazione e Marketing Digitale su misura</p>
</div>

<div class="meta">
  <div class="meta-i"><span class="meta-l">Preparata per</span><span class="meta-v">${lead.nome}</span></div>
  <div class="meta-i"><span class="meta-l">Data</span><span class="meta-v">${oggi}</span></div>
  <div class="meta-i"><span class="meta-l">Consulente</span><span class="meta-v">${consulente}</span></div>
  <div class="meta-i"><span class="meta-l">Valida fino al</span><span class="meta-v">${scadenza}</span></div>
</div>

<div class="body">

  <div class="edit-note no-print">
    ✏️ <strong>Proposta modificabile</strong> — Clicca sui testi per modificarli · Clicca ✕ su una riga per rimuoverla · Usa <strong>Cmd+P → Salva come PDF</strong> per esportare
  </div>

  <div class="az-card">
    <div class="az-nome" contenteditable="true" class="editable">${lead.nome}</div>
    <div class="az-addr">📍 ${lead.indirizzo}</div>
    <div class="az-grid">
      <div class="az-row"><span class="az-lbl">Telefono</span><span class="az-val">${lead.telefono !== 'N/D' ? lead.telefono : '—'}</span></div>
      <div class="az-row"><span class="az-lbl">Sito web</span><span class="az-val">${lead.web !== 'N/D' ? lead.web : 'Non presente'}</span></div>
      <div class="az-row"><span class="az-lbl">Rating Google</span><span class="az-val">${lead.rating ? lead.rating + '/5' : 'N/D'}</span></div>
      <div class="az-row"><span class="az-lbl">Recensioni</span><span class="az-val">${lead.nRating || 0} su Google Maps</span></div>
    </div>
    <div class="tags">${segnaliHTML.join('')}</div>
  </div>

  <div class="fat-box">
    <div class="fat-item">
      <div class="fat-lbl">Settore rilevato</div>
      <div class="fat-val">${fatturato.label}</div>
    </div>
    <div class="fat-item">
      <div class="fat-lbl">Fatturato stimato</div>
      <div class="fat-val">€ <span>${fatturato.min.toLocaleString('it-IT')}</span> – <span>${fatturato.max.toLocaleString('it-IT')}</span></div>
      <div class="fat-note">Stima basata su settore, zona e volume clienti</div>
    </div>
    <div class="fat-item">
      <div class="fat-lbl">Budget digitale consigliato</div>
      <div class="fat-val">€ <span>${fatturato.budgetMensileMax}</span>/mese</div>
      <div class="fat-note">~1.8% fatturato stimato</div>
    </div>
  </div>

  <div class="sec-title">Aree di intervento identificate</div>
  <div class="aree">${areeHTML}</div>

  <div class="sec-title">Soluzione proposta</div>

  <table id="tabella-prodotti">
    <thead>
      <tr>
        <th>Sigla</th>
        <th>Prodotto e motivazione</th>
        <th>Area</th>
        <th style="text-align:right">Anno 1</th>
        <th style="text-align:right">Mensile</th>
        <th class="no-print" style="width:30px"></th>
      </tr>
    </thead>
    <tbody>
      ${prodotti.map((p, i) => `
      <tr class="removable" id="row-${i}">
        <td class="td-sigla">${p.sigla}</td>
        <td class="td-prod">
          <div class="p-nome" contenteditable="true">${p.nome}</div>
          <div class="p-desc">${p.desc}</div>
          <div class="p-mot" contenteditable="true">💡 ${p.motivazione}</div>
        </td>
        <td><span class="badge">${p.cat}</span></td>
        <td class="td-num" id="anno1-${i}">${p.anno1 ? '€ ' + p.anno1.toLocaleString('it-IT') : '—'}</td>
        <td class="td-num" id="mens-${i}">${p.mens ? '€ ' + p.mens + '/mese' : '—'}</td>
        <td class="no-print" style="text-align:center">
          <button onclick="rimuoviRiga(${i})" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:4px 6px" title="Rimuovi">✕</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="tot-box">
    <div class="tot-item">
      <div class="tot-lbl">Investimento anno 1</div>
      <div class="tot-val">€ <span id="tot-anno1">${totAnno1.toLocaleString('it-IT')}</span></div>
      <div class="tot-note">IVA esclusa</div>
    </div>
    <div class="tot-div"></div>
    <div class="tot-item">
      <div class="tot-lbl">Canone mensile</div>
      <div class="tot-val">€ <span id="tot-mens">${totMens}</span><span style="font-size:13pt;color:rgba(255,255,255,0.4)">/mese</span></div>
      <div class="tot-note">Con contratto pluriennale</div>
    </div>
    <div class="tot-div"></div>
    <div class="tot-item">
      <div class="tot-lbl">Soluzioni incluse</div>
      <div class="tot-val"><span id="tot-num">${prodotti.length}</span></div>
      <div class="tot-note">aree coperte: ${categorieUsate.length}</div>
    </div>
  </div>

  <div class="pitch">
    <h3>🎯 Note per il consulente</h3>
    <p contenteditable="true">
      ${!lead.web || lead.web === 'N/D' ? `<strong>${lead.nome}</strong> non ha presenza web — punto di ingresso ideale con il sito come anchor del pacchetto.` : `<strong>${lead.nome}</strong> ha già un sito ma presenta margini di crescita su social, reputazione e visibilità locale.`}
      ${lead.rating && lead.rating < 3.5 ? ` Rating ${lead.rating}/5: proponi Instatrust come priorità assoluta per invertire la tendenza.` : ''}
      ${(lead.nRating || 0) < 10 ? ` Con solo ${lead.nRating || 0} recensioni è praticamente invisibile su Google Maps — la scheda GBP è l'argomento più forte.` : ''}
      Il budget proposto di €${fatturato.budgetMensileMax}/mese è sostenibile per un'attività del settore ${fatturato.label} nella zona di riferimento.
    </p>
  </div>

  <div class="foot">
    <div><strong>Pagine Sì! SpA</strong> · P.zza San Giovanni Decollato 1, 05100 Terni · paginesispa.it</div>
    <div style="text-align:right">Prezzi al netto di IVA · Proposta valida 30 giorni</div>
  </div>

</div>
</div>

<script>
const prodottiData = ${JSON.stringify(prodotti)};

function rimuoviRiga(idx) {
  const row = document.getElementById('row-' + idx);
  if (row) {
    row.remove();
    ricalcolaTotali();
  }
}

function ricalcolaTotali() {
  let anno1 = 0, mens = 0, num = 0;
  prodottiData.forEach((p, i) => {
    const row = document.getElementById('row-' + i);
    if (row) {
      anno1 += p.anno1 || 0;
      mens += p.mens || 0;
      num++;
    }
  });
  document.getElementById('tot-anno1').textContent = anno1.toLocaleString('it-IT');
  document.getElementById('tot-mens').textContent = mens;
  document.getElementById('tot-num').textContent = num;
}
</script>
</body>
</html>`;
}

// Endpoint
router.post('/', async (req, res) => {
  try {
    const { lead, consulente } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    const fatturato = stimaFatturato(lead);
    const analisi = analisiDigitale(lead);
    const prodotti = costruisciPreventivo(lead, fatturato, analisi);
    const html = generaHTML(lead, prodotti, fatturato, consulente || 'Consulente Pagine Sì!');

    res.json({ html, prodotti, fatturato });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
