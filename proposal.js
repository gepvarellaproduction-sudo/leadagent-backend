const express = require('express');
const router = express.Router();

// Listino prodotti Pagine Si! con logica di abbinamento
const LISTINO = {
  sito: [
    { sigla: 'Si2A-PM', nome: 'Sì!2Site Atom', desc: 'Sito CMS base (HP + gallery + contatti)', prezzo_anno1: 945, prezzo_mens: 59, tag: ['no_sito', 'micro'] },
    { sigla: 'Si2RE-PM', nome: 'Sì!2Site Ready', desc: 'Sito CMS completo con blog', prezzo_anno1: 1545, prezzo_mens: 93, tag: ['no_sito', 'pmi'] },
    { sigla: 'Si2S-PM', nome: 'Sì!2Site Super', desc: 'Sito CMS avanzato con catalogo', prezzo_anno1: 2150, prezzo_mens: 127, tag: ['no_sito', 'medio'] },
    { sigla: 'Sì2VN-PM', nome: 'Sì!2Site Vertical New', desc: 'Sito WordPress professionale fino 10 pagine', prezzo_anno1: 2350, prezzo_mens: 141, tag: ['no_sito', 'grande'] },
  ],
  directory: [
    { sigla: 'WDSAL', nome: 'Scheda Azienda Light', desc: 'Scheda base su PagineSi.it (15 kw)', prezzo_anno1: 280, prezzo_mens: null, tag: ['sempre', 'micro'] },
    { sigla: 'WDSA', nome: 'Scheda Azienda', desc: 'Scheda completa su PagineSi.it (45 kw)', prezzo_anno1: 400, prezzo_mens: 38, tag: ['sempre', 'pmi'] },
    { sigla: 'WDSAV', nome: 'Scheda Azienda Video', desc: 'Scheda con video in header su PagineSi.it', prezzo_anno1: 490, prezzo_mens: null, tag: ['sempre', 'medio'] },
  ],
  reputazione: [
    { sigla: 'ISTQQ', nome: 'Instatrust QR Code', desc: 'Gestione recensioni con QR Code e analisi AI', prezzo_anno1: 600, prezzo_mens: 58, tag: ['rating_basso', 'poche_rec'] },
    { sigla: 'ISTBS', nome: 'Instatrust Business Suite', desc: 'Suite completa recensioni multipiattaforma', prezzo_anno1: 722, prezzo_mens: 69, tag: ['rating_basso', 'poche_rec'] },
    { sigla: 'ISTPS', nome: 'Instatrust Premium Suite', desc: 'Suite premium con kit in-store incluso', prezzo_anno1: 833, prezzo_mens: 80, tag: ['rating_basso'] },
  ],
  gbp: [
    { sigla: 'GBP', nome: 'Google Business Profile', desc: 'Ottimizzazione scheda Google Maps', prezzo_anno1: 211, prezzo_mens: null, tag: ['poche_rec', 'no_sito'] },
    { sigla: 'GBPP', nome: 'Google Business Profile Plus', desc: 'Scheda Google con SEO e inserimento prodotti', prezzo_anno1: 878, prezzo_mens: null, tag: ['poche_rec', 'pmi'] },
  ],
  social: [
    { sigla: 'SOC-START', nome: 'Social Start FB+IG', desc: '2 post/mese su Facebook e Instagram', prezzo_anno1: 2256, prezzo_mens: 188, tag: ['no_social', 'pmi'] },
    { sigla: 'SOC-WEEK', nome: 'Social Week FB+IG', desc: '4 post/mese su Facebook e Instagram', prezzo_anno1: 3840, prezzo_mens: 320, tag: ['no_social', 'medio'] },
    { sigla: 'SOC-BAS', nome: 'Social Basic FB+IG', desc: '1 post/mese su Facebook e Instagram', prezzo_anno1: 1320, prezzo_mens: 110, tag: ['no_social', 'micro'] },
  ],
  seo: [
    { sigla: 'SIN', nome: 'SEO In Site', desc: 'Posizionamento SEO su sito Pagine Sì!', prezzo_anno1: 1390, prezzo_mens: 133, tag: ['no_sito', 'pmi'] },
    { sigla: 'SMN', nome: 'SEO Main', desc: 'SEO su sito esterno con URL parlante', prezzo_anno1: 1390, prezzo_mens: 133, tag: ['ha_sito', 'pmi'] },
  ],
  adv: [
    { sigla: 'SIADVLS + SIADVLG', nome: 'SìAdvertising Locale', desc: 'Google Ads locale (setup + gestione mensile)', prezzo_anno1: 200 + 250, prezzo_mens: 250, tag: ['sempre', 'pmi'] },
    { sigla: 'ADW-E', nome: 'Google AdWords Entry', desc: 'Campagna Google Ads entry level', prezzo_anno1: 450, prezzo_mens: null, tag: ['sempre', 'micro'] },
  ],
};

function selezionaProdotti(lead) {
  const hasSito = lead.web && lead.web !== 'N/D';
  const pocheRec = lead.nRating < 20;
  const ratingBasso = lead.rating && lead.rating < 3.5;
  const nRating = lead.nRating || 0;

  // Determina dimensione cliente
  let dim = 'micro';
  if (nRating >= 50 || hasSito) dim = 'pmi';
  if (nRating >= 100) dim = 'medio';

  const prodotti = [];

  // 1. Sito web
  if (!hasSito) {
    const sitoList = LISTINO.sito.filter(p => p.tag.includes(dim) || p.tag.includes('no_sito'));
    if (sitoList.length) prodotti.push({ ...sitoList[0], categoria: 'Sito Web', motivazione: 'Nessuna presenza web rilevata — opportunità primaria' });
  }

  // 2. Scheda Directory (sempre)
  const dirList = LISTINO.directory.filter(p => p.tag.includes(dim) || p.tag.includes('sempre'));
  if (dirList.length) prodotti.push({ ...dirList[0], categoria: 'Directory PagineSi.it', motivazione: 'Visibilità immediata su PagineSi.it con ' + (dirList[0].sigla === 'WDSAL' ? '15' : '45') + ' parole chiave' });

  // 3. Reputazione se rating basso o poche rec
  if (ratingBasso || pocheRec) {
    const repList = LISTINO.reputazione.filter(p => p.tag.some(t => (ratingBasso && t === 'rating_basso') || (pocheRec && t === 'poche_rec')));
    if (repList.length) prodotti.push({ ...repList[0], categoria: 'Gestione Reputazione', motivazione: ratingBasso ? `Rating ${lead.rating}/5 — gestione recensioni urgente` : `Solo ${lead.nRating} recensioni — accelerare la raccolta` });
  }

  // 4. Google Business Profile
  const gbpList = LISTINO.gbp.filter(p => p.tag.includes(dim) || (!hasSito && p.tag.includes('no_sito')));
  if (gbpList.length) prodotti.push({ ...gbpList[0], categoria: 'Google Business Profile', motivazione: 'Ottimizzazione scheda Google Maps per visibilità locale' });

  // 5. Social (se PMI o medio)
  if (dim !== 'micro') {
    const socList = LISTINO.social.filter(p => p.tag.includes(dim) || p.tag.includes('no_social'));
    if (socList.length) prodotti.push({ ...socList[0], categoria: 'Social Media', motivazione: 'Gestione professionale presenza social per acquisire nuovi clienti' });
  }

  // 6. ADV (se ha già sito o è PMI)
  if (hasSito || dim === 'pmi' || dim === 'medio') {
    const advList = LISTINO.adv.filter(p => p.tag.includes(dim) || p.tag.includes('sempre'));
    if (advList.length) prodotti.push({ ...advList[0], categoria: 'Advertising', motivazione: 'Campagna pubblicitaria per generare contatti immediati' });
  }

  return prodotti;
}

function generaHTMLProposta(lead, prodotti, consulente) {
  const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const totaleAnno1 = prodotti.reduce((s, p) => s + (p.prezzo_anno1 || 0), 0);
  const totaleMens = prodotti.reduce((s, p) => s + (p.prezzo_mens || 0), 0);

  const righe = prodotti.map((p, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td class="sigla">${p.sigla}</td>
      <td>
        <div class="prod-nome">${p.nome}</div>
        <div class="prod-desc">${p.desc}</div>
        <div class="motivazione">💡 ${p.motivazione}</div>
      </td>
      <td class="cat-badge">${p.categoria}</td>
      <td class="prezzo">${p.prezzo_anno1 ? '€ ' + p.prezzo_anno1.toLocaleString('it-IT') : 'Prev.'}</td>
      <td class="prezzo">${p.prezzo_mens ? '€ ' + p.prezzo_mens + '/mese' : '—'}</td>
    </tr>`).join('');

  const segnali = [];
  if (!lead.web || lead.web === 'N/D') segnali.push('❌ Nessun sito web');
  if (lead.nRating < 20) segnali.push(`⚠️ Solo ${lead.nRating} recensioni online`);
  if (lead.rating && lead.rating < 3.5) segnali.push(`⚠️ Rating ${lead.rating}/5 su Google`);
  if (lead.rating && lead.rating >= 3.5) segnali.push(`✅ Rating ${lead.rating}/5 (${lead.nRating} recensioni)`);

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 11pt;
    color: #1e1e1e;
    background: white;
  }

  /* COVER */
  .cover {
    background: #1e1e1e;
    color: white;
    padding: 60px 50px 50px;
    min-height: 260px;
    position: relative;
    overflow: hidden;
  }

  .cover::before {
    content: '';
    position: absolute;
    top: -80px; right: -80px;
    width: 300px; height: 300px;
    background: #E8001C;
    border-radius: 50%;
    opacity: 0.15;
  }

  .cover::after {
    content: '';
    position: absolute;
    bottom: -40px; left: 200px;
    width: 150px; height: 150px;
    background: #E8001C;
    border-radius: 50%;
    opacity: 0.08;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 40px;
  }

  .logo-box {
    width: 44px; height: 44px;
    background: #E8001C;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 18px; color: white;
    letter-spacing: -1px;
  }

  .logo-testo span:first-child {
    display: block; font-size: 16px; font-weight: 700; color: white;
  }
  .logo-testo span:last-child {
    display: block; font-size: 10px; font-weight: 400; color: rgba(255,255,255,0.5);
    letter-spacing: 0.1em; text-transform: uppercase;
  }

  .cover h1 {
    font-size: 28pt;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    margin-bottom: 8px;
    color: white;
  }

  .cover h1 span { color: #E8001C; }

  .cover .subtitle {
    font-size: 13pt;
    color: rgba(255,255,255,0.6);
    font-weight: 300;
    margin-bottom: 0;
  }

  /* META INFO */
  .meta-bar {
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
    padding: 16px 50px;
    display: flex;
    gap: 40px;
    font-size: 10pt;
  }

  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { color: #999; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; }
  .meta-value { color: #1e1e1e; font-weight: 600; }

  /* BODY */
  .body { padding: 40px 50px; }

  /* LEAD CARD */
  .lead-card {
    background: white;
    border: 1.5px solid #e0e0e0;
    border-left: 5px solid #E8001C;
    border-radius: 10px;
    padding: 24px 28px;
    margin-bottom: 32px;
  }

  .lead-card h2 {
    font-size: 16pt;
    font-weight: 700;
    color: #1e1e1e;
    margin-bottom: 4px;
  }

  .lead-card .lead-addr {
    font-size: 10pt;
    color: #666;
    margin-bottom: 16px;
  }

  .lead-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
    margin-bottom: 16px;
  }

  .lead-info-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 10pt;
  }

  .lead-info-item .lbl { color: #999; font-size: 9pt; min-width: 70px; }
  .lead-info-item .val { color: #1e1e1e; font-weight: 500; }

  .segnali { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }

  .segnale {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 9pt;
    font-weight: 500;
  }
  .segnale.warn { background: #fff3e0; color: #e65100; }
  .segnale.bad { background: #fce4e4; color: #b71c1c; }
  .segnale.ok { background: #e8f5e9; color: #2e7d32; }

  /* SECTION */
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #E8001C;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #E8001C;
    display: flex; align-items: center; gap: 8px;
  }

  /* TABLE */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
    font-size: 10pt;
  }

  thead tr {
    background: #1e1e1e;
    color: white;
  }

  thead th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 500;
    font-size: 9pt;
    letter-spacing: 0.04em;
  }

  tbody tr.even { background: white; }
  tbody tr.odd { background: #fafafa; }
  tbody tr:hover { background: #fff5f5; }

  td { padding: 12px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }

  .sigla {
    font-family: monospace;
    font-size: 9pt;
    color: #E8001C;
    font-weight: 600;
    white-space: nowrap;
  }

  .prod-nome { font-weight: 600; color: #1e1e1e; margin-bottom: 2px; }
  .prod-desc { font-size: 9pt; color: #666; margin-bottom: 4px; }
  .motivazione { font-size: 8.5pt; color: #888; font-style: italic; }

  .cat-badge {
    display: inline-block;
    background: #f5f5f5;
    color: #555;
    font-size: 9pt;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .prezzo { font-weight: 600; color: #1e1e1e; white-space: nowrap; }

  /* TOTALE */
  .totale-box {
    background: #1e1e1e;
    color: white;
    border-radius: 10px;
    padding: 24px 28px;
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .totale-box .label { font-size: 10pt; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
  .totale-box .importo { font-size: 22pt; font-weight: 700; }
  .totale-box .importo span { color: #E8001C; }
  .totale-box .note { font-size: 9pt; color: rgba(255,255,255,0.4); margin-top: 4px; }

  .totale-divider { width: 1px; background: rgba(255,255,255,0.15); height: 60px; }

  /* PITCH */
  .pitch-box {
    background: #fff8f8;
    border: 1px solid #ffd0d5;
    border-left: 4px solid #E8001C;
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 32px;
  }

  .pitch-box h3 { font-size: 11pt; font-weight: 700; color: #E8001C; margin-bottom: 10px; }
  .pitch-box p { font-size: 10pt; color: #555; line-height: 1.7; }

  /* FOOTER */
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9pt;
    color: #999;
  }

  .footer strong { color: #E8001C; }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .cover { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="logo-area">
    <div class="logo-box">P!</div>
    <div class="logo-testo">
      <span>Pagine Sì!</span>
      <span>Human Digital Company</span>
    </div>
  </div>
  <h1>Proposta Digitale<br><span>Personalizzata</span></h1>
  <p class="subtitle">Soluzioni di comunicazione e marketing digitale</p>
</div>

<div class="meta-bar">
  <div class="meta-item">
    <span class="meta-label">Preparata per</span>
    <span class="meta-value">${lead.nome}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">Data</span>
    <span class="meta-value">${oggi}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">Consulente</span>
    <span class="meta-value">${consulente || 'Consulente Pagine Sì!'}</span>
  </div>
  <div class="meta-item">
    <span class="meta-label">Valida fino al</span>
    <span class="meta-value">${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('it-IT', {day:'2-digit',month:'long',year:'numeric'})}</span>
  </div>
</div>

<div class="body">

  <div class="lead-card">
    <h2>${lead.nome}</h2>
    <p class="lead-addr">📍 ${lead.indirizzo}</p>
    <div class="lead-info-grid">
      <div class="lead-info-item">
        <span class="lbl">Telefono</span>
        <span class="val">${lead.telefono !== 'N/D' ? lead.telefono : '—'}</span>
      </div>
      <div class="lead-info-item">
        <span class="lbl">Sito web</span>
        <span class="val">${lead.web !== 'N/D' ? lead.web : 'Non presente'}</span>
      </div>
      <div class="lead-info-item">
        <span class="lbl">Rating Google</span>
        <span class="val">${lead.rating ? lead.rating + '/5' : 'N/D'}</span>
      </div>
      <div class="lead-info-item">
        <span class="lbl">Recensioni</span>
        <span class="val">${lead.nRating || 0} su Google</span>
      </div>
    </div>
    <div class="segnali">
      ${segnali.map(s => {
        const cls = s.startsWith('❌') ? 'bad' : s.startsWith('⚠️') ? 'warn' : 'ok';
        return `<span class="segnale ${cls}">${s}</span>`;
      }).join('')}
    </div>
  </div>

  <div class="section-title">📋 Soluzione proposta</div>

  <table>
    <thead>
      <tr>
        <th>Sigla</th>
        <th>Prodotto e motivazione</th>
        <th>Categoria</th>
        <th>Investim. anno 1</th>
        <th>Canone mensile</th>
      </tr>
    </thead>
    <tbody>
      ${righe}
    </tbody>
  </table>

  <div class="totale-box">
    <div>
      <div class="label">Investimento totale anno 1</div>
      <div class="importo">€ <span>${totaleAnno1.toLocaleString('it-IT')}</span></div>
      <div class="note">IVA esclusa · rata minima 180€</div>
    </div>
    <div class="totale-divider"></div>
    <div>
      <div class="label">Canone mensile stimato</div>
      <div class="importo">€ <span>${totaleMens}</span><span style="font-size:14pt;color:rgba(255,255,255,0.5)">/mese</span></div>
      <div class="note">Con contratto pluriennale</div>
    </div>
    <div class="totale-divider"></div>
    <div>
      <div class="label">Prodotti inclusi</div>
      <div class="importo"><span>${prodotti.length}</span></div>
      <div class="note">soluzioni personalizzate</div>
    </div>
  </div>

  <div class="pitch-box">
    <h3>🎯 Note per il consulente</h3>
    <p>
      ${lead.web === 'N/D' ? `<strong>${lead.nome}</strong> non ha ancora una presenza web — questo è il punto di ingresso ideale. Proponi il sito come base, poi costruisci il pacchetto completo aggiungendo directory e reputazione.` : `<strong>${lead.nome}</strong> ha già un sito ma presenta margini di miglioramento significativi nella visibilità locale e nella gestione della reputazione online.`}
      ${lead.rating && lead.rating < 3.5 ? ` Il rating di ${lead.rating}/5 richiede un intervento urgente su Instatrust per invertire la tendenza.` : ''}
      ${lead.nRating < 10 ? ` Con sole ${lead.nRating} recensioni, il cliente è praticamente invisibile su Google Maps — opportunità enorme per la scheda GBP.` : ''}
    </p>
  </div>

  <div class="footer">
    <div>
      <strong>Pagine Sì! SpA</strong> · P.zza San Giovanni Decollato 1, 05100 Terni<br>
      paginesispa.it · info@paginesi.it
    </div>
    <div style="text-align:right;">
      I prezzi sono al netto di IVA e spese incasso.<br>
      Proposta valida 30 giorni dalla data di emissione.
    </div>
  </div>

</div>
</body>
</html>`;
}

// Endpoint generazione proposta
router.post('/', async (req, res) => {
  try {
    const { lead, consulente } = req.body;
    if (!lead) return res.status(400).json({ error: 'Lead mancante' });

    const prodotti = selezionaProdotti(lead);
    const html = generaHTMLProposta(lead, prodotti, consulente);

    // Converti HTML in PDF con Puppeteer se disponibile, altrimenti restituisci HTML
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
      });
      await browser.close();
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Proposta_${lead.nome.replace(/\s/g,'_')}.pdf"` });
      res.send(pdf);
    } catch(puppErr) {
      // Fallback: restituisci HTML
      res.json({ html, prodotti });
    }

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, selezionaProdotti, generaHTMLProposta };
