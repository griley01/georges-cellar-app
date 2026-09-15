const API_URL = 'https://script.google.com/macros/s/AKfycbzknFIpHsJk9MNiJ7D_QLRoEqkZW1hEe-gmrj-9O-km56TLtup_Ze0-IJFImHiJNZYXFw/exec';
const API_KEY = 'georges-cellar-9k2m-vino-2026'; // must match Code.gs

let WINES = [];

async function apiGet(action, params) {
  const url = new URL(API_URL);
  url.searchParams.set('key', API_KEY);
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
    body: JSON.stringify({ ...body, key: API_KEY })
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

function populateFilters() {
  const types = [...new Set(WINES.map(w => w.Type))].filter(Boolean).sort();
  document.getElementById('filterType').innerHTML = '<option value="">All types</option>' + types.map(t => `<option>${t}</option>`).join('');
}

function kpis() {
  const totalBottles = WINES.reduce((s, w) => s + (parseInt(w.Bottles) || 1), 0);
  const remaining = WINES.filter(w => !w.Drunk).reduce((s, w) => s + (parseInt(w.Bottles) || 1), 0);
  const totalValue = WINES.reduce((s, w) => s + (w.Drunk ? 0 : (parseFloat(w.Value) || 0) * (parseInt(w.Bottles) || 1)), 0);
  document.getElementById('kpiBottles').textContent = totalBottles;
  document.getElementById('kpiRemaining').textContent = remaining;
  document.getElementById('kpiValue').textContent = totalValue ? '£' + Math.round(totalValue) : '—';
}

function render() {
  kpis();
  const q = (document.getElementById('search').value || '').toLowerCase();
  const ft = document.getElementById('filterType').value;
  const filtered = WINES.filter(w => {
    const txt = `${w.Producer} ${w.Wine} ${w.Region} ${w.Grapes}`.toLowerCase();
    return (!q || txt.includes(q)) && (!ft || w.Type === ft);
  });

  const grid = document.getElementById('grid');
  if (!filtered.length) { grid.innerHTML = '<div class="loading-note">No wines match.</div>'; return; }

  grid.innerHTML = filtered.map(w => {
    const myRating = parseInt(w.MyRating) || 0;
    const starsHtml = [1,2,3,4,5].map(n => `<span class="${n <= myRating ? 'filled' : ''}" data-row="${w._row}" data-n="${n}" onclick="setRating(this)">★</span>`).join('');
    return `
    <div class="card">
      <div class="card-top">
        <div>
          <div class="card-name">${w.Producer} — ${w.Wine}</div>
          <div class="card-sub">${w.Vintage}${w.Bottles > 1 ? ' · ' + w.Bottles + ' bottles' : ''}</div>
        </div>
        ${w.VivinoRating ? `<div class="pill">★ ${parseFloat(w.VivinoRating).toFixed(1)}</div>` : ''}
      </div>
      <div style="margin-top:6px">
        <span class="pill">${w.Type || ''}</span>
        ${w.Region ? `<span class="pill">${w.Region.split(',')[0]}</span>` : ''}
        ${w.Magnum === 'Yes' ? '<span class="pill">Magnum</span>' : ''}
      </div>
      <div class="stars">${starsHtml}</div>
      <div class="drunk-row">
        <label class="switch">
          <input type="checkbox" ${w.Drunk ? 'checked' : ''} data-row="${w._row}" onchange="toggleDrunk(this)">
          <span class="slider"></span>
        </label>
        <span>${w.Drunk ? 'Drunk' : 'In cellar'}</span>
      </div>
      <textarea class="notes-input" placeholder="Notes…" data-row="${w._row}" onblur="saveNotes(this)">${w.MyNotes || ''}</textarea>
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

// --- Add / edit modal ---

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

document.getElementById('cameraInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('loadingNote').style.display = 'block';
  document.getElementById('loadingNote').textContent = 'Reading the label…';
  const base64 = await resizeImage(file, 1024);
  const result = await apiPost({ action: 'identifyPhoto', imageData: base64, mimeType: 'image/jpeg' });
  document.getElementById('loadingNote').style.display = 'none';
  event.target.value = '';
  if (!result.found) {
    alert(result.error || "Couldn't identify a wine label in that photo — try again or add it manually.");
    return;
  }
  openAddModal(result);
});

loadWines();
