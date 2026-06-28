const prepList = document.getElementById('prep-list');
const readyList = document.getElementById('ready-list');
const prepListCount = document.getElementById('prep-list-count');
const readyListCount = document.getElementById('ready-list-count');

let orders = [];

function formatShortDate(isoString) {
  if (!isoString) {
    return '-';
  }

  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function boardClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('entreg')) return 'done';
  if (normalized.includes('pronto')) return 'ready';
  if (normalized.includes('separ')) return 'separating';
  if (normalized.includes('aguard')) return 'waiting';
  return 'progress';
}

function isReady(order) {
  return String(order.status || '').toLowerCase().includes('pronto');
}

function isDelivered(order) {
  return String(order.status || '').toLowerCase().includes('entreg');
}

function isPrep(order) {
  return !isReady(order) && !isDelivered(order);
}

function renderBoard() {
  const prepOrders = orders.filter(isPrep);
  const readyOrders = orders.filter(isReady);

  prepListCount.textContent = `${prepOrders.length} ${prepOrders.length === 1 ? 'lanche' : 'lanches'}`;
  readyListCount.textContent = `${readyOrders.length} ${readyOrders.length === 1 ? 'lanche' : 'lanches'}`;
  prepList.innerHTML = '';
  readyList.innerHTML = '';

  if (!prepOrders.length) {
    prepList.innerHTML = '<div class="ready-empty">Nenhuma comanda em preparo no momento.</div>';
  } else {
    prepOrders.forEach((order) => {
      const pill = document.createElement('div');
      pill.className = 'ready-pill prep';
      pill.innerHTML = `<strong>${order.code}</strong>`;
      prepList.appendChild(pill);
    });
  }

  if (!readyOrders.length) {
    readyList.innerHTML = '<div class="ready-empty">Nenhuma comanda pronta no momento.</div>';
  } else {
    readyOrders.forEach((order) => {
      const pill = document.createElement('div');
      pill.className = 'ready-pill';
      pill.innerHTML = `<strong>${order.code}</strong>`;
      readyList.appendChild(pill);
    });
  }
}

async function refreshOrders() {
  const response = await fetch('/api/orders');
  const data = await response.json();
  orders = data.orders || [];
  renderBoard();
}

document.addEventListener('click', async (event) => {
  const readyCode = event.target.getAttribute('data-ready');
  const finalizeCode = event.target.getAttribute('data-finalize');
  const deleteCode = event.target.getAttribute('data-delete');

  if (readyCode) {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: readyCode, status: 'Pronto' })
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'Não foi possível marcar como pronto.');
      return;
    }

    await refreshOrders();
  }

  if (finalizeCode) {
    const response = await fetch(`/api/orders/${encodeURIComponent(finalizeCode)}/finalize`, { method: 'POST' });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'Não foi possível finalizar a comanda.');
      return;
    }

    await refreshOrders();
  }

  if (deleteCode) {
    const confirmed = confirm(`Remover a comanda ${deleteCode}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/orders/${encodeURIComponent(deleteCode)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      alert(data.error || 'Não foi possível remover a comanda.');
      return;
    }

    await refreshOrders();
  }
});

refreshOrders();
setInterval(refreshOrders, 2500);

// Theme toggle: persist preference in localStorage and apply on load
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(isLight) {
  if (isLight) {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
}

function loadTheme() {
  const stored = localStorage.getItem('theme');
  const isLight = stored === 'light';
  applyTheme(isLight);
  if (themeToggle) themeToggle.textContent = isLight ? 'Tema claro' : 'Tema escuro';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggle.textContent = isLight ? 'Tema claro' : 'Tema escuro';
  });
}

loadTheme();

// Font size controls: increase, decrease, reset
const fontIncrease = document.getElementById('font-increase');
const fontDecrease = document.getElementById('font-decrease');
const fontReset = document.getElementById('font-reset');

function getCurrentFontSize() {
  const stored = localStorage.getItem('fontSizePx');
  if (stored) return parseInt(stored, 10);
  const computed = window.getComputedStyle(document.documentElement).fontSize || '18px';
  return parseInt(computed.replace('px', ''), 10);
}

function setFontSize(px) {
  const size = Math.max(12, Math.min(28, px));
  document.documentElement.style.fontSize = size + 'px';
  localStorage.setItem('fontSizePx', String(size));
}

function changeFont(delta) {
  const current = getCurrentFontSize();
  setFontSize(current + delta);
}

if (fontIncrease) fontIncrease.addEventListener('click', () => changeFont(2));
if (fontDecrease) fontDecrease.addEventListener('click', () => changeFont(-2));
if (fontReset) fontReset.addEventListener('click', () => {
  const defaultSize = 18;
  setFontSize(defaultSize);
});

// Apply saved font size on load
(function applySavedFont() {
  const saved = localStorage.getItem('fontSizePx');
  if (saved) {
    const n = parseInt(saved, 10);
    if (!Number.isNaN(n)) document.documentElement.style.fontSize = n + 'px';
  }
})();
