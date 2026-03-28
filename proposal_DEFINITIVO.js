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
    <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBpZD0iTGF5ZXJfMSIgeD0iMHB4IiB5PSIwcHgiIHZpZXdCb3g9IjAgMCAxMjAwIDQwMCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTIwMCA0MDA7IiB4bWw6c3BhY2U9InByZXNlcnZlIj48c3R5bGUgdHlwZT0idGV4dC9jc3MiPgkuc3Qwe2ZpbGw6I0ZGRkZGRjt9CS5zdDF7ZmlsbDp1cmwoI1NWR0lEXzFfKTt9CS5zdDJ7ZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTEzMzE1OTAwMzAyMzgxNTIzMjIwMDAwMDAyOTYwMTM2MjM2ODY4NTIxMzYxXyk7fQkuc3Qze2ZpbGw6dXJsKCNTVkdJRF8wMDAwMDE4MTA0NjQzMDY2MTczNjk2ODAzMDAwMDAwOTY4MjgxNDU1MjM4MDMyNDI4NV8pO30JLnN0NHtmaWxsOnVybCgjU1ZHSURfMDAwMDAxMDgzMTA4NDI2NzQ0Mjk3NTUwODAwMDAwMTM2MzUzMjc5NzUxODMyNTY5ODZfKTt9CS5zdDV7ZmlsbDp1cmwoI1NWR0lEXzAwMDAwMTMzNDk3NzA5MzM3OTM2MTQ4NTkwMDAwMDE2MTg4MzY4ODkzODg4NTYxODM0Xyk7fTwvc3R5bGU+PGc+CTxnPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTE3Ny4zLDI2Ni42Yy0xNi4yLDAtMjkuMi01LjctMzguNC0xNi41bDAuNSw1NS45YzAsMS4zLTEsMi40LTIuMywyLjRoLTM1LjJjLTEuMywwLTIuNC0xLTIuNC0yLjRsMC44LTk2LjYgICBsLTAuOC03Ny41YzAtMS4zLDEtMi40LDIuNC0yLjRoMzVjMS4zLDAsMi40LDEsMi40LDIuNGwtMC44LDEzLjNjOS40LTExLjUsMjIuNy0xOC4zLDM5LjctMTguM2MzOC4xLDAsNTguMiwzMC4zLDU4LjIsNjkuNSAgIEMyMzYuMywyMzUuMywyMTMuOSwyNjYuNiwxNzcuMywyNjYuNnogTTE2Ni4zLDI0MC4yYzE5LjgsMCwzMC0xNC40LDMwLTQxLjhjMC0yOS44LTEwLjItNDQuOS0yOS4yLTQ0LjlzLTI5LjIsMTQuNC0yOS41LDQyLjMgICBDMTM3LjQsMjI0LjMsMTQ3LjUsMjQwLjIsMTY2LjMsMjQwLjJ6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMzQyLjMsMjY0Yy0xLjMsMC0yLjMtMS0yLjMtMi40bDAuNS0xMy4zYy05LjQsMTEuNS0yMi43LDE4LjMtMzkuNywxOC4zYy0zOC4xLDAtNTguMi0zMC4zLTU4LjItNjkuNSAgIGMwLTM4LjksMjIuNS03MC4yLDU5LTcwLjJjMTYuNywwLDI5LjgsNiwzOC45LDE3bC0wLjgtMTJjMC0xLjMsMS0yLjQsMi40LTIuNGgzNWMxLjMsMCwyLjQsMSwyLjQsMi40bC0wLjgsNjVsMC44LDY0LjggICBjMCwxLjMtMSwyLjQtMi40LDIuNEgzNDIuM3ogTTMxMS44LDI0MC41YzE5LjEsMCwyOS4yLTE0LjQsMjkuNS00Mi44YzAuMy0yOC43LTkuOS00NC40LTI4LjctNDQuNmMtMTkuOC0wLjUtMzAsMTQuNC0zMCw0MiAgIEMyODIuNSwyMjUuMywyOTMsMjQwLjgsMzExLjgsMjQwLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDU4LDMxNi4yYy0zNS4yLDAuNS02Mi4xLTEzLjgtNjQuMi00My4zYzAtMS4zLDEtMi40LDIuNC0yLjRoMzMuN2MxLjYsMCwyLjYsMSwyLjksMi40ICAgYzEuOCwxMSwxMC43LDE3LjUsMjYuNiwxNy41YzE3LDAsMjguNy05LjQsMjguNy0zMC41di0xNS40Yy04LjksMTEuNy0yMS45LDE4LjgtMzguNiwxOC44Yy0zOS45LDAtNjAuOC0yOS41LTYwLjgtNjcuNCAgIGMwLTM3LjYsMjIuNS02OC4xLDU5LTY4LjFjMTYuNywwLDI5LjgsNS43LDM4LjksMTYuNWwtMC44LTEyLjNjMC0xLjMsMS0yLjQsMi40LTIuNGgzNC41YzEuMywwLDIuNCwxLDIuNCwyLjRsLTAuNSw2Ni44bDAuMyw2MS42ICAgQzUyNC42LDI5NC4zLDUwMi40LDMxNi4yLDQ1OCwzMTYuMnogTTQ1Ny43LDIzNy42YzE5LjEsMCwyOS4yLTEzLjYsMjkuNS00MC43YzAuMy0yNy45LTkuOS00My4zLTI4LjctNDMuNiAgIGMtMTkuOC0wLjUtMzAsMTQuMS0zMCw0MUM0MjguNSwyMjMuMyw0MzguOSwyMzcuOSw0NTcuNywyMzcuNnoiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik01NDAuNSwxMTYuNWMtMS4zLDAtMi40LTEtMi40LTIuM1Y4My42YzAtMS4zLDEtMi40LDIuNC0yLjRoMzVjMS4zLDAsMi40LDEsMi40LDIuNHYzMC41ICAgYzAsMS4zLTEsMi4zLTIuNCwyLjNINTQwLjV6IE01NDAuNSwyNjRjLTEuMywwLTIuNC0xLTIuNC0yLjRsMC44LTY0LjhsLTAuOC02NWMwLTEuMywxLTIuNCwyLjQtMi40aDM1LjJjMS4zLDAsMi40LDEsMi40LDIuNCAgIGwtMC44LDY1bDAuOCw2NC44YzAsMS4zLTEsMi40LTIuNCwyLjRINTQwLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNTkzLjUsMjY0Yy0xLjMsMC0yLjQtMS0yLjQtMi40bDAuOC02Mi4xbC0wLjMtNjcuNmMwLTEuMywxLTIuNCwyLjQtMi40aDMzLjJjMS4zLDAsMi40LDEsMi40LDIuNGwtMC44LDE0LjYgICBjOS4xLTExLjcsMjQuNS0yMC4xLDQzLjMtMjAuMWMyOC41LDAsNDYuNywxOS4zLDQ2LjcsNTIuMnYyOC4ybDAuOCw1NC44YzAsMS4zLTEsMi40LTIuNCwyLjRoLTM1Yy0xLjMsMC0yLjQtMS0yLjQtMi40bDAuNS01NC44ICAgdi0yNy43YzAtMTQuNi04LjYtMjQtMjAuNC0yNGMtMTQuMSwwLTI5LjIsMTMuMS0yOS4yLDQxLjh2OS45bDAuNSw1NC44YzAsMS4zLTEsMi40LTIuNCwyLjRINTkzLjV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNODU5LDIxOC42YzEuMywwLDIuNCwxLDIuMSwyLjRjLTMuNCwyNC41LTI2LjksNDYuNS02NC41LDQ2LjVjLTQ0LjksMC02OS4yLTI5LjUtNjkuMi03MC4yICAgYzAtNDIuOCwyNS42LTcxLDY4LjQtNzFjNDQuMSwwLDY4LjcsMjkuMiw2OS41LDc2LjJjMCwxLjMtMSwyLjQtMi4zLDIuNGgtOTYuMWMxLjYsMjUuMywxMS41LDM2LjYsMzAuMywzNi42ICAgYzEzLjEsMCwyMi41LTYsMjYuMS0yMC40YzAuMy0xLjMsMS42LTIuNCwyLjktMi40SDg1OXogTTc5Ni4xLDE1MmMtMTUuNywwLTI1LjEsOS40LTI4LjIsMjcuOUg4MjMgICBDODIxLjQsMTY1LjYsODEzLjMsMTUyLDc5Ni4xLDE1MnoiPjwvcGF0aD4JCTxnPgkJCTxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMV8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iODMzLjU3ODgiIHkxPSIxMjEuNDMxNiIgeDI9IjExMTYuNTg0NCIgeTI9IjM0MC4zOTUiPgkJCQk8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGOTAwNEQiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjI0MiIgc3R5bGU9InN0b3AtY29sb3I6I0Y1MDA0QyI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNTA3OSIgc3R5bGU9InN0b3AtY29sb3I6I0U3MDA0OCI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNzg0MSIgc3R5bGU9InN0b3AtY29sb3I6I0QxMDA0MiI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuOTk5NyIgc3R5bGU9InN0b3AtY29sb3I6I0JCMDAzQiI+PC9zdG9wPgkJCTwvbGluZWFyR3JhZGllbnQ+CQkJPHBhdGggY2xhc3M9InN0MSIgZD0iTTkwOC45LDE2Ni4zYzAtMTEuNSw4LjEtMTYuMiwyMC45LTE2LjJjMTUuOSwwLDIzLjIsNy4xLDI1LjMsMTguNWMwLjMsMS4zLDEuMywyLjMsMi42LDIuM2gzMS45ICAgIGMxLjMsMCwyLjQtMSwyLjEtMi4zYy0yLjMtMjguMi0yNi4xLTQyLjMtNjEuNC00Mi4zYy0zNi4zLDAtNTguNywxNC45LTU4LjcsNDIuOGMwLDU2LjQsODgsMzEuNiw4OCw1Ny4yICAgIGMwLDEwLjQtOC40LDE2LjQtMjMuOCwxNi40Yy0xOC4zLDAtMjguMi02LjUtMjkuMi0yMS43YzAtMS4zLTEtMi4zLTIuMy0yLjNoLTMzLjRjLTEuMywwLTIuNCwxLTIuNCwyLjNjMS4zLDMwLDI2LjQsNDYsNjUuNSw0NiAgICBjMzYuMywwLDYyLjktMTUuOSw2Mi45LTQ0LjFDOTk2LjksMTY1LjgsOTA4LjksMTkxLjksOTA4LjksMTY2LjN6Ij48L3BhdGg+CQkJCQkJCTxsaW5lYXJHcmFkaWVudCBpZD0iU1ZHSURfMDAwMDAxMjcwMjM5NzI1MzgyNDc5MDM0MTAwMDAwMDg3Mjc4NzMxMDAwMjM5NjIyNDhfIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeDE9IjkxMy42MzI2IiB5MT0iMTcuOTYzOCIgeDI9IjExOTYuNjM4MiIgeTI9IjIzNi45MjcyIj4JCQkJPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojRjkwMDREIj48L3N0b3A+CQkJCTxzdG9wIG9mZnNldD0iMC4yNDIiIHN0eWxlPSJzdG9wLWNvbG9yOiNGNTAwNEMiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjUwNzkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNzAwNDgiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjc4NDEiIHN0eWxlPSJzdG9wLWNvbG9yOiNEMTAwNDIiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjk5OTciIHN0eWxlPSJzdG9wLWNvbG9yOiNCQjAwM0IiPjwvc3RvcD4JCQk8L2xpbmVhckdyYWRpZW50PgkJCTxwYXRoIHN0eWxlPSJmaWxsOnVybCgjU1ZHSURfMDAwMDAxMjcwMjM5NzI1MzgyNDc5MDM0MTAwMDAwMDg3Mjc4NzMxMDAwMjM5NjIyNDhfKTsiIGQ9Ik0xMDU0LjEsMTAwLjJsLTU3LjUtMjQuOCAgICBjLTEtMC41LTIuMiwwLTIuNiwxLjJMOTg2LjUsOTljLTAuNSwxLjIsMC4yLDIuNCwxLjQsMi42bDU4LjksMTUuOWMxLjIsMC4yLDIuNi0wLjUsMi45LTEuNGw1LjUtMTMgICAgQzEwNTUuNSwxMDIuMSwxMDU1LjEsMTAwLjcsMTA1NC4xLDEwMC4yeiI+PC9wYXRoPgkJCQkJCQk8bGluZWFyR3JhZGllbnQgaWQ9IlNWR0lEXzAwMDAwMTY3MzY5OTAxODUyNjQ3OTE5OTkwMDAwMDA0MzkzMDgzMjg3NTM1NjE5NDY4XyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI4NjkuNTY5OCIgeTE9Ijc0LjkxNCIgeDI9IjExNTIuNTc1NCIgeTI9IjI5My44NzczIj4JCQkJPHN0b3Agb2Zmc2V0PSIwIiBzdHlsZT0ic3RvcC1jb2xvcjojRjkwMDREIj48L3N0b3A+CQkJCTxzdG9wIG9mZnNldD0iMC4yNDIiIHN0eWxlPSJzdG9wLWNvbG9yOiNGNTAwNEMiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjUwNzkiIHN0eWxlPSJzdG9wLWNvbG9yOiNFNzAwNDgiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjc4NDEiIHN0eWxlPSJzdG9wLWNvbG9yOiNEMTAwNDIiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjk5OTciIHN0eWxlPSJzdG9wLWNvbG9yOiNCQjAwM0IiPjwvc3RvcD4JCQk8L2xpbmVhckdyYWRpZW50PgkJCTxwYXRoIHN0eWxlPSJmaWxsOnVybCgjU1ZHSURfMDAwMDAxNjczNjk5MDE4NTI2NDc5MTk5OTAwMDAwMDQzOTMwODMyODc1MzU2MTk0NjhfKTsiIGQ9Ik0xMDQ0LjcsMTI5LjVoLTM1LjIgICAgYy0xLjMsMC0yLjMsMS0yLjMsMi4zbDAuOCw2NWwtMC44LDY0LjhjMCwxLjMsMSwyLjMsMi4zLDIuM2gzNS4yYzEuMywwLDIuNC0xLDIuNC0yLjNsLTAuOC02NC44bDAuOC02NSAgICBDMTA0NywxMzAuNiwxMDQ2LDEyOS41LDEwNDQuNywxMjkuNXoiPjwvcGF0aD4JCQkJCQkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8wMDAwMDA2MDczMTE3MjAwNDI2MTgyNTExMDAwMDAwNDE3OTE1NzQwNzY3ODg0MTcyOV8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iODY1Ljk3NTciIHkxPSI3OS41NTkzIiB4Mj0iMTE0OC45ODEyIiB5Mj0iMjk4LjUyMjciPgkJCQk8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGOTAwNEQiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjI0MiIgc3R5bGU9InN0b3AtY29sb3I6I0Y1MDA0QyI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNTA3OSIgc3R5bGU9InN0b3AtY29sb3I6I0U3MDA0OCI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNzg0MSIgc3R5bGU9InN0b3AtY29sb3I6I0QxMDA0MiI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuOTk5NyIgc3R5bGU9InN0b3AtY29sb3I6I0JCMDAzQiI+PC9zdG9wPgkJCTwvbGluZWFyR3JhZGllbnQ+CQkJPHBhdGggc3R5bGU9ImZpbGw6dXJsKCNTVkdJRF8wMDAwMDA2MDczMTE3MjAwNDI2MTgyNTExMDAwMDAwNDE3OTE1NzQwNzY3ODg0MTcyOV8pOyIgZD0iTTEwOTcuMSwyMjYuNGgtMzQuMiAgICBjLTEuMywwLTIuNCwxLTIuNCwyLjN2MzIuOWMwLDEuMywxLDIuMywyLjQsMi4zaDM0LjJjMS4zLDAsMi40LTEsMi40LTIuM3YtMzIuOUMxMDk5LjUsMjI3LjQsMTA5OC41LDIyNi40LDEwOTcuMSwyMjYuNHoiPjwvcGF0aD4JCQkJCQkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8wMDAwMDAzNDc4NTE1MjQ4MTQzMTk0NzcxMDAwMDAxODMxMjQxMjI2MjA2Mzc0NjcwNl8iIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4MT0iOTEzLjkzMTUiIHkxPSIxNy41Nzc0IiB4Mj0iMTE5Ni45MzcxIiB5Mj0iMjM2LjU0MDgiPgkJCQk8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNGOTAwNEQiPjwvc3RvcD4JCQkJPHN0b3Agb2Zmc2V0PSIwLjI0MiIgc3R5bGU9InN0b3AtY29sb3I6I0Y1MDA0QyI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNTA3OSIgc3R5bGU9InN0b3AtY29sb3I6I0U3MDA0OCI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuNzg0MSIgc3R5bGU9InN0b3AtY29sb3I6I0QxMDA0MiI+PC9zdG9wPgkJCQk8c3RvcCBvZmZzZXQ9IjAuOTk5NyIgc3R5bGU9InN0b3AtY29sb3I6I0JCMDAzQiI+PC9zdG9wPgkJCTwvbGluZWFyR3JhZGllbnQ+CQkJPHBhdGggc3R5bGU9ImZpbGw6dXJsKCNTVkdJRF8wMDAwMDAzNDc4NTE1MjQ4MTQzMTk0NzcxMDAwMDAxODMxMjQxMjI2MjA2Mzc0NjcwNl8pOyIgZD0iTTEwOTcuMSw4MS4yaC0zNC4yICAgIGMtMS4zLDAtMi40LDEtMi40LDIuNHYxMjUuMWMwLDEuMywxLDIuMywyLjQsMi4zaDM0LjJjMS4zLDAsMi40LTEsMi40LTIuM1Y4My42QzEwOTkuNSw4Mi4zLDEwOTguNSw4MS4yLDEwOTcuMSw4MS4yeiI+PC9wYXRoPgkJPC9nPgk8L2c+CTxnPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTU1NSwzMjUuM2MtMC4xLDAtMC4zLTAuMS0wLjMtMC4zbDAuMS0xMS41aC0xMi4zbDAuMSwxMS41YzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtNGMtMC4xLDAtMC4zLTAuMS0wLjMtMC4zICAgbDAuMS0xMi4zbC0wLjEtMTIuNWMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoNGMwLjEsMCwwLjMsMC4xLDAuMywwLjNsLTAuMSw5LjhoMTIuMmwtMC4xLTkuOGMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoNCAgIGMwLjEsMCwwLjMsMC4xLDAuMywwLjNsLTAuMSwxMi41bDAuMSwxMi4zYzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g1NTV6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNTc4LjYsMzI1LjhjLTYuNSwwLTkuOS0zLjYtOS45LTEwdi03LjRsLTAuMS04LjJjMC0wLjEsMC4xLTAuMywwLjMtMC4zaDRjMC4xLDAsMC4zLDAuMSwwLjMsMC4zbC0wLjEsOC4xICAgdjcuNGMwLDQsMS42LDYuMyw1LjQsNi4zYzQsMCw1LjctMi40LDUuNy02LjN2LTcuM2wtMC4xLTguMmMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoMy42YzAuMSwwLDAuMywwLjEsMC4zLDAuM2wtMC4xLDguMnY3LjQgICBDNTg4LjMsMzIyLjIsNTg1LjEsMzI1LjgsNTc4LjYsMzI1Ljh6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNjAxLjgsMzE0LjNsMCwxMC43YzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g1OThjLTAuMSwwLTAuMy0wLjEtMC4zLTAuM2wwLjEtMTIuM2wtMC4xLTEyLjUgICBjMC0wLjEsMC4xLTAuMywwLjMtMC4zaDUuNGMwLjIsMCwwLjMsMC4xLDAuNCwwLjNsNy40LDE5LjVsNy4xLTE5LjVjMC4xLTAuMiwwLjItMC4zLDAuNC0wLjNoNWMwLjEsMCwwLjMsMC4xLDAuMywwLjNsLTAuMSwxMi41ICAgbDAuMSwxMi4zYzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtMy45Yy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC0xMC43bDAuMS02LjFsMC0yLjFsLTcsMTguOWMtMC4xLDAuMi0wLjIsMC4zLTAuNCwwLjNoLTIuOSAgIGMtMC4yLDAtMC4zLTAuMS0wLjQtMC4zbC03LjUtMTkuNWwwLjEsMi43TDYwMS44LDMxNC4zeiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTY1MS41LDMyNS4zYy0wLjIsMC0wLjMtMC4xLTAuNC0wLjNsLTIuMi02LjdoLTEwbC0yLjIsNi43YzAsMC4yLTAuMiwwLjMtMC40LDAuM2gtMy45ICAgYy0wLjEsMC0wLjMtMC4xLTAuMi0wLjNsOC43LTI0LjhjMC4xLTAuMiwwLjItMC4zLDAuNC0wLjNoNS4zYzAuMiwwLDAuMywwLjEsMC40LDAuM2w4LjYsMjQuOGMwLjEsMC4xLDAsMC4zLTAuMiwwLjNINjUxLjV6ICAgIE02NDcuNywzMTQuN2wtMy44LTExLjZsLTMuOCwxMS42SDY0Ny43eiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTY2OC4xLDMxMy43bDAsMTEuM2MwLDAuMS0wLjEsMC4zLTAuMywwLjNoLTMuNmMtMC4xLDAtMC4zLTAuMS0wLjMtMC4zbDAuMS0xMi41bC0wLjEtMTIuMyAgIGMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoNC43YzAuMiwwLDAuNCwwLjEsMC40LDAuM2wxMS43LDE5LjVsMC0xLjNsLTAuMS02LjF2LTEyLjFjMC0wLjEsMC4xLTAuMywwLjMtMC4zaDMuNiAgIGMwLjEsMCwwLjMsMC4xLDAuMywwLjNsLTAuMSwxMi4zbDAuMSwxMi41YzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtNC45Yy0wLjIsMC0wLjQtMC4xLTAuNC0wLjNsLTExLjYtMTkuMmwwLjEsMS44TDY2OC4xLDMxMy43eiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTcwOC44LDMyNS4zYy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC4xLTEyLjVsLTAuMS0xMi4zYzAtMC4xLDAuMS0wLjMsMC4zLTAuM2g4LjVjNy4zLDAsMTMuMSw0LjEsMTMuMSwxMi44ICAgYzAsOC44LTYuMSwxMi42LTEzLDEyLjZINzA4Ljh6IE03MTMsMzIxLjhoNC42YzQuMywwLDguMi0yLjYsOC4yLTkuMWMwLTYuMy0zLjctOS4zLTguMy05LjNINzEzYzAsMC0wLjEsNS42LTAuMSw5ICAgQzcxMi45LDMxNS44LDcxMywzMjEuOCw3MTMsMzIxLjh6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNzM5LjksMzI1LjNjLTAuMSwwLTAuMy0wLjEtMC4zLTAuM2wwLjEtMTIuNWwtMC4xLTEyLjNjMC0wLjEsMC4xLTAuMywwLjMtMC4zaDMuOWMwLjEsMCwwLjMsMC4xLDAuMywwLjMgICBsLTAuMSwxMi4zbDAuMSwxMi41YzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g3MzkuOXoiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik03NjUuNCwzMjUuOGMtNy4yLDAtMTIuMS01LjMtMTIuMS0xMy4yYzAtOCw1LTEzLjIsMTItMTMuMmM2LDAsOS45LDMsMTEuMiw4LjRjMCwwLjEtMC4xLDAuMy0wLjIsMC4zaC00ICAgYy0wLjIsMC0wLjMtMC4xLTAuNC0wLjNjLTAuOC0zLjItMy4xLTQuOC02LjYtNC44Yy00LjcsMC03LjQsMy43LTcuNCw5LjdjMCw1LjksMi44LDkuNiw3LjYsOS42YzQuMiwwLDYuNy0yLjYsNi45LTdoLTcgICBjLTAuMSwwLTAuMy0wLjEtMC4zLTAuM3YtMi45YzAtMC4xLDAuMS0wLjMsMC4zLTAuM2gxMS40YzAuMSwwLDAuMywwLjEsMC4zLDAuM0M3NzcuMSwzMjEuMiw3NzMsMzI1LjgsNzY1LjQsMzI1Ljh6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNzg2LjQsMzI1LjNjLTAuMSwwLTAuMy0wLjEtMC4zLTAuM2wwLjEtMTIuNWwtMC4xLTEyLjNjMC0wLjEsMC4xLTAuMywwLjMtMC4zaDMuOWMwLjEsMCwwLjMsMC4xLDAuMywwLjMgICBsLTAuMSwxMi4zbDAuMSwxMi41YzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g3ODYuNHoiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04MDcsMzI1LjNjLTAuMSwwLTAuMy0wLjEtMC4zLTAuM2wwLjItMTIuNGwtMC4xLTkuMmgtNy4xYy0wLjEsMC0wLjMtMC4xLTAuMy0wLjN2LTIuOSAgIGMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoMTguN2MwLjEsMCwwLjMsMC4xLDAuMywwLjN2Mi45YzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtNy4xbC0wLjEsOS4ybDAuMiwxMi40YzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g4MDd6ICAgIj48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNODQyLjEsMzI1LjNjLTAuMiwwLTAuMy0wLjEtMC40LTAuM2wtMi4yLTYuN2gtMTBsLTIuMiw2LjdjMCwwLjItMC4yLDAuMy0wLjQsMC4zSDgyMyAgIGMtMC4xLDAtMC4zLTAuMS0wLjItMC4zbDguNy0yNC44YzAuMS0wLjIsMC4yLTAuMywwLjQtMC4zaDUuM2MwLjIsMCwwLjMsMC4xLDAuNCwwLjNsOC42LDI0LjhjMC4xLDAuMSwwLDAuMy0wLjIsMC4zSDg0Mi4xeiAgICBNODM4LjIsMzE0LjdsLTMuOC0xMS42bC0zLjgsMTEuNkg4MzguMnoiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04NTQuNywzMjUuM2MtMC4xLDAtMC4zLTAuMS0wLjMtMC4zbDAuMS0xMi43bC0wLjEtMTIuMWMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoNGMwLjEsMCwwLjMsMC4xLDAuMywwLjMgICBsLTAuMSwxMS45bDAuMSw5LjdoMTAuOGMwLjEsMCwwLjMsMC4xLDAuMywwLjN2Mi45YzAsMC4xLTAuMSwwLjMtMC4zLDAuM0g4NTQuN3oiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik05MDIuOSwzMjUuOGMtNy42LDAtMTIuMi01LjItMTIuMi0xMy4yYzAtOCw0LjctMTMuMiwxMi4yLTEzLjJjNS4zLDAsOS43LDIuMywxMSw5YzAsMC4xLTAuMSwwLjMtMC4zLDAuMyAgIGgtMy44Yy0wLjEsMC0wLjMtMC4xLTAuNC0wLjNjLTAuNy0zLjYtMy4yLTUuNC02LjctNS40Yy00LjksMC03LjUsMy43LTcuNSw5LjZjMCw2LjIsMi44LDkuNiw3LjUsOS42YzMuOSwwLDYuMi0yLjEsNi44LTYgICBjMC0wLjIsMC4yLTAuMywwLjMtMC4zaDMuOWMwLjEsMCwwLjMsMC4xLDAuMywwLjNDOTEyLjksMzIzLDkwOC44LDMyNS44LDkwMi45LDMyNS44eiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTkzNC44LDMyNS44Yy03LjUsMC0xMi41LTUuMy0xMi41LTEzLjJjMC04LjEsNC45LTEzLjIsMTIuNS0xMy4yYzcuNSwwLDEyLjUsNS4xLDEyLjUsMTMuMyAgIEM5NDcuMywzMjAuNSw5NDIuMywzMjUuOCw5MzQuOCwzMjUuOHogTTkzNC44LDMyMi4yYzUsMCw3LjktMy42LDcuOS05LjVzLTIuOS05LjctNy45LTkuN2MtNSwwLTcuOSwzLjYtNy45LDkuNyAgIEM5MjcsMzE4LjYsOTI5LjksMzIyLjIsOTM0LjgsMzIyLjJ6Ij48L3BhdGg+CQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNOTYwLjMsMzE0LjNsMCwxMC43YzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtMy41Yy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC4xLTEyLjNsLTAuMS0xMi41ICAgYzAtMC4xLDAuMS0wLjMsMC4zLTAuM2g1LjRjMC4yLDAsMC4zLDAuMSwwLjQsMC4zbDcuNCwxOS41bDcuMS0xOS41YzAuMS0wLjIsMC4yLTAuMywwLjQtMC4zaDVjMC4xLDAsMC4zLDAuMSwwLjMsMC4zbC0wLjEsMTIuNSAgIGwwLjEsMTIuM2MwLDAuMS0wLjEsMC4zLTAuMywwLjNoLTMuOWMtMC4xLDAtMC4zLTAuMS0wLjMtMC4zbDAtMTAuN2wwLjEtNi4xbDAtMi4xbC03LDE4LjljLTAuMSwwLjItMC4yLDAuMy0wLjQsMC4zSDk2OCAgIGMtMC4yLDAtMC4zLTAuMS0wLjQtMC4zbC03LjUtMTkuNWwwLjEsMi43TDk2MC4zLDMxNC4zeiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTEwMDEuNCwzMTYuMWgtNC44bDAuMSw4LjljMCwwLjEtMC4xLDAuMy0wLjMsMC4zaC00Yy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC4xLTEyLjVsLTAuMS0xMi4zICAgYzAtMC4xLDAuMS0wLjMsMC4zLTAuM2g5YzUuOCwwLDkuMywyLjcsOS4zLDhTMTAwNy4xLDMxNi4xLDEwMDEuNCwzMTYuMXogTTk5Ni42LDMxMi42djAuMWg1LjFjMi43LDAsNC43LTEuMyw0LjctNC43ICAgYzAtMy4yLTEuNy00LjYtNC45LTQuNmgtNC45TDk5Ni42LDMxMi42eiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTEwMzQuMiwzMjUuM2MtMC4yLDAtMC4zLTAuMS0wLjQtMC4zbC0yLjItNi43aC0xMGwtMi4yLDYuN2MwLDAuMi0wLjIsMC4zLTAuNCwwLjNoLTMuOSAgIGMtMC4xLDAtMC4zLTAuMS0wLjItMC4zbDguNy0yNC44YzAuMS0wLjIsMC4yLTAuMywwLjQtMC4zaDUuM2MwLjIsMCwwLjMsMC4xLDAuNCwwLjNsOC42LDI0LjhjMC4xLDAuMSwwLDAuMy0wLjIsMC4zSDEwMzQuMnogICAgTTEwMzAuMywzMTQuN2wtMy44LTExLjZsLTMuOCwxMS42SDEwMzAuM3oiPjwvcGF0aD4JCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMDUwLjcsMzEzLjdsMCwxMS4zYzAsMC4xLTAuMSwwLjMtMC4zLDAuM2gtMy42Yy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC4xLTEyLjVsLTAuMS0xMi4zICAgYzAtMC4xLDAuMS0wLjMsMC4zLTAuM2g0LjdjMC4yLDAsMC40LDAuMSwwLjQsMC4zbDExLjcsMTkuNWwwLTEuM2wtMC4xLTYuMXYtMTIuMWMwLTAuMSwwLjEtMC4zLDAuMy0wLjNoMy42ICAgYzAuMSwwLDAuMywwLjEsMC4zLDAuM2wtMC4xLDEyLjNsMC4xLDEyLjVjMCwwLjEtMC4xLDAuMy0wLjMsMC4zaC00LjljLTAuMiwwLTAuNC0wLjEtMC40LTAuM2wtMTEuNi0xOS4ybDAuMSwxLjhMMTA1MC43LDMxMy43eiI+PC9wYXRoPgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTEwODguNywzMjVjMCwwLjEtMC4xLDAuMy0wLjMsMC4zaC00Yy0wLjEsMC0wLjMtMC4xLTAuMy0wLjNsMC4xLTguM2wtOC40LTE2LjZjLTAuMS0wLjEsMC0wLjMsMC4xLTAuM2g0LjUgICBjMC4yLDAsMC4zLDAuMSwwLjQsMC4zbDUuOCwxMi41bDUuOC0xMi41YzAuMS0wLjEsMC4yLTAuMywwLjQtMC4zaDQuMWMwLjEsMCwwLjIsMC4xLDAuMSwwLjNsLTguNSwxNi42TDEwODguNywzMjV6Ij48L3BhdGg+CTwvZz48L2c+PC9zdmc+" alt="Pagine Sì!" style="height:44px;width:auto;" />
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
    ✏️ <strong>Proposta modificabile</strong> — Clicca sui testi per modificarli · Clicca ✕ su una riga per rimuoverla
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
      <tr class="removable" id="row-${i}" data-anno1="${p.anno1||0}" data-mens="${p.mens||0}">
        <td class="td-sigla">${p.sigla}</td>
        <td class="td-prod">
          <div class="p-nome" contenteditable="true">${p.nome}</div>
          <div class="p-desc" contenteditable="true">${p.desc}</div>
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
    <tfoot class="no-print">
      <tr>
        <td colspan="6" style="padding:10px 14px;border-top:2px dashed #f0f0f0;background:#fafafa;">
          <button onclick="apriPannello()" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:#fff;border:1.5px dashed #E8001C;color:#E8001C;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">
            ＋ Aggiungi servizio dal listino
          </button>
        </td>
      </tr>
    </tfoot>
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

  <div class="no-print" style="display:flex;gap:10px;margin:20px 0;flex-wrap:wrap;">
    <button onclick="esportaPDF()" style="display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:#E8001C;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
      📄 Esporta PDF sintetico
    </button>
    <button onclick="window.print()" style="display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:#fff;color:#555;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
      🖨 Stampa proposta completa
    </button>
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
const LISTINO_COMPLETO = ${JSON.stringify(PRODOTTI)};

// ── RIMUOVI / RICALCOLA ────────────────────────────────────────────────
function rimuoviRiga(idx) {
  const row = document.getElementById('row-' + idx);
  if (row) { row.remove(); ricalcolaTotali(); }
}

function ricalcolaTotali() {
  let anno1 = 0, mens = 0, num = 0;
  // Conta righe presenti (originali + aggiunte)
  document.querySelectorAll('#tabella-prodotti tbody tr').forEach(tr => {
    const a1 = parseFloat(tr.dataset.anno1 || 0);
    const mn = parseFloat(tr.dataset.mens || 0);
    anno1 += a1;
    mens += mn;
    num++;
  });
  document.getElementById('tot-anno1').textContent = anno1.toLocaleString('it-IT');
  document.getElementById('tot-mens').textContent = mens;
  document.getElementById('tot-num').textContent = num;
}

// ── PANNELLO AGGIUNGI SERVIZIO ─────────────────────────────────────────
function apriPannello() {
  // Costruisco il pannello con tutto il listino
  const cats = {
    'Sito Web': ['Si2A-PM','Si2RE-PM','Si2S-PM','Sì2VN-PM'],
    'Directory PagineSi.it': ['WDSAL','WDSA','WDSAV'],
    'Google Maps': ['GBP','GBPP','GBPAdv'],
    'Reputazione': ['ISTQQ','ISTBS','ISTPS'],
    'Social Media': ['SOC-SET','SOC-BAS','SOC-START','SOC-WEEK','SOC-FULL'],
    'SEO': ['SIN','SMN','BLS10P'],
    'Google Ads': ['ADW-E','ADW-S','SIADVLS','SIADVLG','Si4LMB','Si4LMM'],
    'Video': ['VS1','VS4','VST30','VP'],
    'AI': ['AI-ADLSET','AI-ADLABB','AI-ADISET'],
    'eCommerce': ['EC-SMART','EC-GLOB'],
    'Marketing Automation': ['Si4BLD','Si4BEN'],
  };

  let html = '';
  for (const [cat, sigle] of Object.entries(cats)) {
    html += '<div style="margin-bottom:16px">';
    html += '<div style="font-size:9px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:7px">' + cat + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
    sigle.forEach(s => {
      const p = LISTINO_COMPLETO[s];
      if (!p) return;
      const prezzo = p.mens ? '€'+p.mens+'/mese' : (p.anno1 ? '€'+p.anno1+'/anno' : '');
      html += '<button onclick="selezionaSigla(\\''+s+'\\')" style="padding:4px 10px;border-radius:14px;border:1.5px solid #e0e0e0;background:#fff;cursor:pointer;font-size:10.5px;color:#555;display:flex;gap:4px;align-items:center" id="chip-'+s+'">'
        + '<span style="font-family:monospace;font-weight:700;font-size:10px;color:#E8001C">'+s+'</span>'
        + '<span>'+p.nome+'</span>'
        + '<span style="opacity:0.5;font-size:9.5px">'+prezzo+'</span>'
        + '</button>';
    });
    html += '</div></div>';
  }

  document.getElementById('pannello-body').innerHTML = html;
  var ov=document.getElementById('pannello-overlay'); ov.style.display='block'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.display='flex';
}

function chiudiPannello() {
  document.getElementById('pannello-overlay').style.display = 'none';
}

let _siglaSelezionata = null;

function selezionaSigla(s) {
  // Deseleziona tutti
  document.querySelectorAll('[id^="chip-"]').forEach(el => {
    el.style.background = '#fff';
    el.style.borderColor = '#e0e0e0';
    el.style.color = '#555';
  });
  _siglaSelezionata = s;
  const chip = document.getElementById('chip-' + s);
  if (chip) {
    chip.style.background = '#E8001C';
    chip.style.borderColor = '#E8001C';
    chip.style.color = '#fff';
  }
  document.getElementById('btn-aggiungi-ok').disabled = false;
}

function aggiungiServizio() {
  if (!_siglaSelezionata) return;
  const s = _siglaSelezionata;
  const p = LISTINO_COMPLETO[s];
  if (!p) return;

  const tbody = document.querySelector('#tabella-prodotti tbody');
  const idx = 'extra-' + Date.now();
  const tr = document.createElement('tr');
  tr.id = 'row-' + idx;
  tr.dataset.anno1 = p.anno1 || 0;
  tr.dataset.mens = p.mens || 0;
  tr.innerHTML =
    '<td class="td-sigla">' + s + '</td>' +
    '<td class="td-prod">' +
      '<div class="p-nome" contenteditable="true">' + p.nome + '</div>' +
      '<div class="p-desc">' + p.desc + '</div>' +
      '<div class="p-mot" contenteditable="true">💡 Aggiunto manualmente</div>' +
    '</td>' +
    '<td><span class="badge">' + p.cat + '</span></td>' +
    '<td class="td-num">' + (p.anno1 ? '€ ' + p.anno1.toLocaleString('it-IT') : '—') + '</td>' +
    '<td class="td-num">' + (p.mens ? '€ ' + p.mens + '/mese' : '—') + '</td>' +
    '<td class="no-print" style="text-align:center">' +
      '<button onclick="rimuoviRigaExtra(\\'row-' + idx + '\\')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:4px 6px">✕</button>' +
    '</td>';
  tbody.appendChild(tr);
  ricalcolaTotali();
  chiudiPannello();
  _siglaSelezionata = null;
}

function rimuoviRigaExtra(id) {
  const row = document.getElementById(id);
  if (row) { row.remove(); ricalcolaTotali(); }
}

function esportaPDF() {
  var nomeAz = document.querySelector('.az-nome') ? document.querySelector('.az-nome').textContent.trim() : 'Cliente';
  var indirizzo = document.querySelector('.az-addr') ? document.querySelector('.az-addr').textContent.trim() : '';
  var oggi = new Date().toLocaleDateString('it-IT', {day:'2-digit', month:'long', year:'numeric'});
  var righeHTML = '';
  var tot1 = 0, totM = 0;
  document.querySelectorAll('#tabella-prodotti tbody tr').forEach(function(tr) {
    var sigla = tr.querySelector('.td-sigla') ? tr.querySelector('.td-sigla').textContent.trim() : '';
    var nome = tr.querySelector('.p-nome') ? tr.querySelector('.p-nome').textContent.trim() : '';
    var a1 = parseFloat(tr.dataset.anno1 || 0);
    var mn = parseFloat(tr.dataset.mens || 0);
    tot1 += a1; totM += mn;
    righeHTML += '<tr style="border-bottom:1px solid #f0f0f0">' +
      '<td style="padding:10px 14px;font-family:monospace;font-size:10px;color:#E8001C;font-weight:700;white-space:nowrap">' + sigla + '</td>' +
      '<td style="padding:10px 14px;font-size:11px;color:#1a1a1a;font-weight:500">' + nome + '</td>' +
      '<td style="padding:10px 14px;font-size:11px;color:#555;text-align:right;white-space:nowrap">' + (a1 ? '&euro; ' + a1.toLocaleString('it-IT') : '&mdash;') + '</td>' +
      '<td style="padding:10px 14px;font-size:11px;color:#555;text-align:right;white-space:nowrap">' + (mn ? '&euro; ' + mn + '/mese' : '&mdash;') + '</td>' +
      '</tr>';
  });
  var mensHTML = totM ? '<div style="text-align:right;margin-left:28px"><div style="font-size:9px;opacity:0.7;margin-bottom:2px">Canone mensile</div><div style="font-size:20px;font-weight:700">&euro; ' + totM + '<span style="font-size:13px;opacity:0.7">/mese</span></div></div>' : '';
  var html = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>Proposta ' + nomeAz + '</title>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;padding:36px 44px;max-width:780px;margin:0 auto}' +
    '@media print{body{padding:20px 28px;print-color-adjust:exact;-webkit-print-color-adjust:exact}}' +
    '</style></head><body>' +
    '<div style="background:#111;padding:20px 26px;border-radius:10px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between">' +
      '<img src="data:image/svg+xml;base64,' + logo_b64 + '" style="height:36px;width:auto" />' +
      '<div style="font-size:10px;color:rgba(255,255,255,0.4);text-align:right">Proposta commerciale<br>' + oggi + '</div>' +
    '</div>' +
    '<div style="border:1px solid #e0e0e0;border-left:4px solid #E8001C;border-radius:8px;padding:16px 20px;margin-bottom:22px">' +
      '<div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:4px">' + nomeAz + '</div>' +
      '<div style="font-size:11px;color:#888">' + indirizzo + '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">' +
      '<thead><tr style="background:#111">' +
        '<th style="padding:10px 14px;text-align:left;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Sigla</th>' +
        '<th style="padding:10px 14px;text-align:left;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Servizio proposto</th>' +
        '<th style="padding:10px 14px;text-align:right;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Anno 1</th>' +
        '<th style="padding:10px 14px;text-align:right;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Mensile</th>' +
      '</tr></thead>' +
      '<tbody>' + righeHTML + '</tbody>' +
    '</table>' +
    '<div style="background:#E8001C;color:#fff;border-radius:8px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center">' +
      '<div>' +
        '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.7;margin-bottom:4px">Piano di investimento</div>' +
        '<div style="font-size:10px;opacity:0.6">IVA esclusa &middot; Valida 30 giorni</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center">' +
        '<div style="text-align:right"><div style="font-size:9px;opacity:0.7;margin-bottom:2px">Investimento anno 1</div><div style="font-size:20px;font-weight:700">&euro; ' + tot1.toLocaleString('it-IT') + '</div></div>' +
        mensHTML +
      '</div>' +
    '</div>' +
    '<div style="margin-top:14px;font-size:9px;color:#bbb;text-align:center">Pagine S&igrave;! SpA &middot; P.zza San Giovanni Decollato 1, 05100 Terni &middot; paginesispa.it</div>' +
    '</body></html>';
  var w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function(){ w.print(); }, 600);
}

</script>

<!-- PANNELLO AGGIUNGI SERVIZIO -->
<div id="pannello-overlay" onclick="if(event.target===this)chiudiPannello()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;">
  <div style="background:#fff;border-radius:16px;width:680px;max-width:95vw;max-height:84vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
    <div style="padding:18px 22px 14px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:14px;font-weight:700;color:#111">Aggiungi un servizio</div>
        <div style="font-size:11px;color:#aaa;margin-top:2px">Listino Pagine Sì! 2026 — seleziona e conferma</div>
      </div>
      <button onclick="chiudiPannello()" style="width:28px;height:28px;border-radius:50%;border:none;background:#f0f0f0;cursor:pointer;font-size:14px;color:#666">✕</button>
    </div>
    <div id="pannello-body" style="overflow-y:auto;padding:18px 22px;flex:1"></div>
    <div style="padding:12px 22px;border-top:1px solid #eee;display:flex;align-items:center;justify-content:space-between;background:#f9f9f9">
      <span style="font-size:11px;color:#aaa">Clicca un servizio per selezionarlo</span>
      <button id="btn-aggiungi-ok" onclick="aggiungiServizio()" disabled style="padding:8px 20px;background:#E8001C;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;opacity:0.4" onmouseover="if(!this.disabled)this.style.opacity=0.85" onmouseout="if(!this.disabled)this.style.opacity=1">Aggiungi ✓</button>
    </div>
  </div>
</div>

</body>
</html>`;
}

// Endpoint
router.post('/', async (req, res) => {
  try {
    const { lead, consulente, sigleExtra } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    const fatturato = stimaFatturato(lead);
    const analisi = analisiDigitale(lead);
    let prodotti = costruisciPreventivo(lead, fatturato, analisi);

    // Aggiungi sigle extra scelte manualmente dal consulente
    if (sigleExtra && sigleExtra.length > 0) {
      const sigleGiaPresenti = new Set(prodotti.map(p => p.sigla));
      sigleExtra.forEach(sigla => {
        if (!sigleGiaPresenti.has(sigla) && PRODOTTI[sigla]) {
          prodotti.push({
            sigla,
            ...PRODOTTI[sigla],
            motivazione: 'Aggiunto manualmente dal consulente',
            priorita: 10
          });
        }
      });
    }

    const html = generaHTML(lead, prodotti, fatturato, consulente || 'Consulente Pagine Sì!');
    res.json({ html, prodotti, fatturato });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
