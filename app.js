const API_URL = 'https://script.google.com/macros/s/AKfycbzknFIpHsJk9MNiJ7D_QLRoEqkZW1hEe-gmrj-9O-km56TLtup_Ze0-IJFImHiJNZYXFw/exec';
const API_KEY = 'georges-cellar-9k2m-vino-2026'; // must match Code.gs
const VIEW_KEY = 'georges-cellar-view-7f3q-2026'; // must match Code.gs — read-only, rejected for writes server-side

const VIEW_MODE = new URLSearchParams(location.search).get('view') === '1';
const ACTIVE_KEY = VIEW_MODE ? VIEW_KEY : API_KEY;

let WINES = [];

async function apiGet(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set('key', ACTIVE_KEY);
  url.searchParams.set('action', action);
  Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body) {
  // Sent as text/plain (not application/json) so the browser doesn't trigger a CORS
  // preflight — Apps Script web apps don't handle OPTIONS requests.
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ ...body, key: ACTIVE_KEY })
  });
  return res.json();
}

async function loadWines() {
  document.getElementById('loadingNote').style.display = 'block';
  try {
    const data = await apiGet('list');
    WINES = data.wines || [];
    document.getElementById('loadingNote').style.display = 'none';
    populateFilters();
    render();
  } catch (e) {
    document.getElementById('loadingNote').textContent = 'Could not load — check your connection.';
  }
}

function grapeShort_(g) {
  return (g || '').split(',')[0].split('(')[0].split('—')[0].trim();
}

function populateFilters() {
  const types = [...new Set(WINES.map(w => w.Type))].filter(Boolean).sort();
  document.getElementById('filterType').innerHTML = '<option value="">All types</option>' + types.map(t => `<option>${t}</option>`).join('');

  const countries = [...new Set(WINES.map(w => w.Country))].filter(Boolean).sort();
  document.getElementById('filterCountry').innerHTML = '<option value="">All countries</option>' + countries.map(c => `<option>${c}</option>`).join('');

  const grapes = [...new Set(WINES.map(w => grapeShort_(w.Grapes)))].filter(Boolean).sort();
  document.getElementById('filterGrape').innerHTML = '<option value="">All grapes</option>' + grapes.map(g => `<option>${g}</option>`).join('');
}

function kpis() {
  const totalBottles = WINES.reduce((s, w) => s + (parseInt(w.Bottles) || 1), 0);
  const remaining = WINES.filter(w => !w.Drunk).reduce((s, w) => s + (parseInt(w.Bottles) || 1), 0);
  const totalValue = WINES.reduce((s, w) => s + (w.Drunk ? 0 : (parseFloat(w.Value) || 0) * (parseInt(w.Bottles) || 1)), 0);
  document.getElementById('kpiBottles').textContent = totalBottles;
  document.getElementById('kpiRemaining').textContent = remaining;
  document.getElementById('kpiValue').textContent = totalValue ? '£' + Math.round(totalValue) : '—';
}

function isDrinkSoon(w) {
  if (!w.DrinkBy || w.Drunk) return false;
  const y = parseInt(w.DrinkBy);
  if (!y) return false;
  return y <= new Date().getFullYear() + 1;
}

function render() {
  kpis();
  const q = (document.getElementById('search').value || '').toLowerCase();
  const ft = document.getElementById('filterType').value;
  const fc = document.getElementById('filterCountry').value;
  const fv = parseFloat(document.getElementById('filterVivino').value) || 0;
  const fg = document.getElementById('filterGrape').value;
  const fds = document.getElementById('filterDrinkSoon').value;
  const filtered = WINES.filter(w => {
    const txt = `${w.Producer} ${w.Wine} ${w.Region} ${w.Grapes}`.toLowerCase();
    if (q && !txt.includes(q)) return false;
    if (ft && w.Type !== ft) return false;
    if (fc && w.Country !== fc) return false;
    if (fv && (!w.VivinoRating || parseFloat(w.VivinoRating) < fv)) return false;
    if (fg && !(w.Grapes || '').includes(fg)) return false;
    if (fds === 'soon' && !isDrinkSoon(w)) return false;
    return true;
  });

  const grid = document.getElementById('grid');
  if (!filtered.length) { grid.innerHTML = '<div class="loading-note">No wines match.</div>'; return; }

  grid.innerHTML = filtered.map(w => {
    const myRating = parseInt(w.MyRating) || 0;
    const starsHtml = [1,2,3,4,5].map(n => `<span class="${n <= myRating ? 'filled' : ''}" data-row="${w._row}" data-n="${n}" onclick="setRating(this)">★</span>`).join('');
    const drinkSoonBadge = isDrinkSoon(w) ? `<span class="pill pill-drinksoon">Drink soon${w.DrinkBy ? ' · ' + w.DrinkBy : ''}</span>` : '';
    const personalControlsHtml = VIEW_MODE ? '' : `
      <div class="stars">${starsHtml}</div>
      <div class="drunk-row">
        <label class="switch">
          <input type="checkbox" ${w.Drunk ? 'checked' : ''} data-row="${w._row}" onchange="toggleDrunk(this)">
          <span class="slider"></span>
        </label>
        <span>${w.Drunk ? 'Drunk' : 'In cellar'}</span>
      </div>
      <textarea class="notes-input" placeholder="Notes…" data-row="${w._row}" onblur="saveNotes(this)">${w.MyNotes || ''}</textarea>`;
    return `
    <div class="card">
      <div class="card-top" onclick="openDetailModal(${w._row})" style="cursor:pointer">
        <div>
          <div class="card-name">${w.Producer} — ${w.Wine}</div>
          <div class="card-sub">${w.Vintage}${w.Bottles > 1 ? ' · ' + w.Bottles + ' bottles' : ''}</div>
        </div>
        ${w.VivinoRating ? `<div class="pill pill-vivino">★ ${parseFloat(w.VivinoRating).toFixed(1)}</div>` : ''}
      </div>
      <div style="margin-top:6px;cursor:pointer" onclick="openDetailModal(${w._row})">
        <span class="pill">${w.Type || ''}</span>
        ${w.Region ? `<span class="pill">${w.Region.split(',')[0]}</span>` : ''}
        ${w.Grapes ? `<span class="pill">${grapeShort_(w.Grapes)}</span>` : ''}
        ${w.Magnum === 'Yes' ? '<span class="pill">Magnum</span>' : ''}
        ${drinkSoonBadge}
      </div>
      ${personalControlsHtml}
    </div>`;
  }).join('');
}

async function setRating(el) {
  const row = parseInt(el.dataset.row);
  const n = parseInt(el.dataset.n);
  const wine = WINES.find(w => w._row === row);
  const newRating = (parseInt(wine.MyRating) === n) ? 0 : n;
  wine.MyRating = newRating;
  render();
  await apiPost({ action: 'update', row, patch: { MyRating: newRating } });
}

async function toggleDrunk(el) {
  const row = parseInt(el.dataset.row);
  const wine = WINES.find(w => w._row === row);
  wine.Drunk = el.checked;
  const patch = { Drunk: el.checked };
  if (el.checked && !wine.DateOpened) {
    wine.DateOpened = new Date().toISOString().slice(0, 10);
    patch.DateOpened = wine.DateOpened;
  }
  render();
  await apiPost({ action: 'update', row, patch });
}

async function saveNotes(el) {
  const row = parseInt(el.dataset.row);
  await apiPost({ action: 'update', row, patch: { MyNotes: el.value } });
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('filterType').addEventListener('change', render);
document.getElementById('filterCountry').addEventListener('change', render);
document.getElementById('filterVivino').addEventListener('change', render);
document.getElementById('filterGrape').addEventListener('change', render);
document.getElementById('filterDrinkSoon').addEventListener('change', render);

if (VIEW_MODE) {
  document.getElementById('addBtn').style.display = 'none';
  document.getElementById('cameraBtn').style.display = 'none';
  document.getElementById('shareBtn').style.display = 'none';
}

async function shareLink() {
  const url = location.origin + location.pathname + '?view=1';
  if (navigator.share) {
    try { await navigator.share({ title: "George's Cellar", url }); return; } catch (e) { /* user cancelled */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('shareBtn');
    const original = btn.textContent;
    btn.textContent = 'Link copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (e) {
    prompt('Copy this link:', url);
  }
}

// --- Add / edit modal ---

function openDetailModal(row) {
  const w = WINES.find(x => x._row === row);
  if (!w) return;
  document.getElementById('modal').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:1rem">
      <div>
        <div style="font-family:Georgia,serif;font-size:20px">${w.Producer} — ${w.Wine}</div>
        <div style="font-size:13px;color:var(--ink-soft);margin-top:4px">${w.Vintage} · ${w.Type || ''}${w.Magnum === 'Yes' ? ' · Magnum' : ''} · ${w.Region || ''}</div>
      </div>
      <button class="btn btn-secondary" style="flex:none;padding:6px 12px" onclick="closeModal()">Close</button>
    </div>
    ${w.VivinoRating ? `<label>Vivino / critic score</label><div style="margin-bottom:10px">${parseFloat(w.VivinoRating).toFixed(1)} / 5 ${w.VivinoNote ? '<span style="color:var(--ink-soft)">(' + w.VivinoNote + ')</span>' : ''}</div>` : ''}
    ${w.ExtraScore ? `<label>Additional scores</label><div style="margin-bottom:10px">${w.ExtraScore}</div>` : ''}
    <label>Grapes</label><div style="margin-bottom:10px">${w.Grapes || '—'}</div>
    <label>Tasting notes</label><div style="margin-bottom:10px">${w.TastingNotes || '—'}</div>
    ${w.Estate ? `<label>Estate</label><div style="margin-bottom:10px">${w.Estate}</div>` : ''}
    ${w.Awards ? `<label>Awards</label><div style="margin-bottom:10px">${w.Awards}</div>` : ''}
    <label>In cellar</label>
    <div style="margin-bottom:10px">${w.Bottles} bottle${w.Bottles > 1 ? 's' : ''}${w.Value ? ` · £${w.Value} each · £${(w.Value * (parseInt(w.Bottles) || 1)).toLocaleString('en-GB')} total` : ''}</div>
    <label>Drink by</label>
    ${VIEW_MODE
      ? `<div style="margin-bottom:10px">${w.DrinkBy || '—'}</div>`
      : `<input type="number" id="drinkByInput" placeholder="e.g. 2027" value="${w.DrinkBy || ''}" style="margin-bottom:10px" onchange="setDrinkBy(${w._row}, this.value)">`
    }
    ${w.MyNotes ? `<label>My notes</label><div style="margin-bottom:10px">${w.MyNotes}</div>` : ''}
  `;
  document.getElementById('overlay').classList.add('open');
}

async function setDrinkBy(row, value) {
  const wine = WINES.find(w => w._row === row);
  if (wine) wine.DrinkBy = value;
  await apiPost({ action: 'update', row, patch: { DrinkBy: value } });
  render();
}

function openAddModal(prefill) {
  const w = prefill || {};
  document.getElementById('modal').innerHTML = `
    <label>Producer</label><input id="f_Producer" value="${w.producer || ''}">
    <label>Wine</label><input id="f_Wine" value="${w.wine || ''}">
    <label>Vintage</label><input id="f_Vintage" value="${w.vintage || ''}">
    <label>Type</label>
    <select id="f_Type">
      ${['Red','White','Sparkling','Dessert','Rosé'].map(t => `<option ${w.type === t ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
    <label>Region</label><input id="f_Region" value="${w.region || ''}">
    <label>Country</label><input id="f_Country" value="${w.country || ''}">
    <label>Grapes</label><input id="f_Grapes" value="${w.grapes || ''}">
    <label>Bottles</label><input id="f_Bottles" type="number" value="1" min="1">
    <label>Value (£ each)</label><input id="f_Value" type="number" value="">
    <label>Drink by</label><input id="f_DrinkBy" type="number" placeholder="e.g. 2027" value="${w.drinkBy || ''}">
    <label>Tasting notes</label><textarea id="f_TastingNotes" rows="3">${w.tastingNotes || ''}</textarea>
    <label>Estate</label><textarea id="f_Estate" rows="2">${w.estate || ''}</textarea>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="submitAdd()">Save</button>
    </div>
  `;
  document.getElementById('overlay').classList.add('open');
}

function closeModal() { document.getElementById('overlay').classList.remove('open'); }

async function submitAdd() {
  const wine = {
    Producer: document.getElementById('f_Producer').value,
    Wine: document.getElementById('f_Wine').value,
    Vintage: document.getElementById('f_Vintage').value,
    Type: document.getElementById('f_Type').value,
    Region: document.getElementById('f_Region').value,
    Country: document.getElementById('f_Country').value,
    Grapes: document.getElementById('f_Grapes').value,
    Bottles: document.getElementById('f_Bottles').value,
    Value: document.getElementById('f_Value').value,
    DrinkBy: document.getElementById('f_DrinkBy').value,
    TastingNotes: document.getElementById('f_TastingNotes').value,
    Estate: document.getElementById('f_Estate').value,
    Magnum: 'No', Drunk: false
  };
  closeModal();
  document.getElementById('loadingNote').style.display = 'block';
  document.getElementById('loadingNote').textContent = 'Saving…';
  await apiPost({ action: 'add', wine });
  await loadWines();
}

// --- Add via photo ---

function resizeImage(file, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
}

function showScanningModal(message) {
  document.getElementById('modal').innerHTML = `
    <div style="text-align:center; padding: 1.5rem 0.5rem;">
      <div class="spinner" style="margin: 0 auto 1rem;"></div>
      <div style="font-size:14px; color:var(--ink-soft); margin-bottom:1rem">${message}</div>
      <button class="btn btn-secondary" style="max-width:140px; margin:0 auto" onclick="cancelScan()">Cancel</button>
    </div>
  `;
  document.getElementById('overlay').classList.add('open');
}

let scanCancelled = false;
function cancelScan() { scanCancelled = true; closeModal(); }

function showScanFailedModal(result) {
  const reason = result && result.error
    ? `Reason: ${result.error}`
    : "Gemini didn't recognize a wine label in that photo.";
  document.getElementById('modal').innerHTML = `
    <div style="text-align:center; padding: 1rem 0.5rem;">
      <div style="font-size:14px; color:var(--ink-soft); margin-bottom:0.5rem">
        Couldn't read a wine label in that photo, even after a second try.
      </div>
      <div style="font-size:12px; color:var(--ink-soft); margin-bottom:1rem; font-style:italic">
        ${reason}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-secondary" onclick="closeModal(); document.getElementById('cameraInput').click();">Try another photo</button>
        <button class="btn btn-primary" onclick="openAddModal()">Enter manually</button>
      </div>
    </div>
  `;
  document.getElementById('overlay').classList.add('open');
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ found: false, error: 'Timed out — the request took too long.' }), ms))
  ]);
}

async function runPhotoIdentify(base64) {
  try {
    return await withTimeout(
      apiPost({ action: 'identifyPhoto', imageData: base64, mimeType: 'image/jpeg' }),
      25000
    );
  } catch (e) {
    return { found: false, error: 'Network error — check your connection.' };
  }
}

document.getElementById('cameraInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;

  scanCancelled = false;
  showScanningModal('Reading the label…');
  const base64 = await resizeImage(file, 1024);
  if (scanCancelled) return;

  let result = await runPhotoIdentify(base64);
  if (scanCancelled) return;
  if (!result.found) {
    // Automatic single retry — Gemini occasionally misses on the first pass with an
    // angled or partially obscured label, and a second attempt often succeeds.
    showScanningModal('First read was unclear — trying again…');
    result = await runPhotoIdentify(base64);
    if (scanCancelled) return;
  }

  if (!result.found) {
    showScanFailedModal(result);
    return;
  }
  openAddModal(result);
});

loadWines();
