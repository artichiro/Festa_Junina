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

  prepListCount.textContent = `${prepOrders.length} número${prepOrders.length === 1 ? '' : 's'}`;
  readyListCount.textContent = `${readyOrders.length} número${readyOrders.length === 1 ? '' : 's'}`;
  prepList.innerHTML = '';
  readyList.innerHTML = '';

  if (!prepOrders.length) {
    prepList.innerHTML = '<div class="ready-empty">Nenhuma comanda em preparo no momento.</div>';
  } else {
    prepOrders.forEach((order) => {
      const pill = document.createElement('div');
      pill.className = 'ready-pill prep';
      pill.innerHTML = `<strong>${order.code}</strong><span>${order.status}</span>`;
      prepList.appendChild(pill);
    });
  }

  if (!readyOrders.length) {
    readyList.innerHTML = '<div class="ready-empty">Nenhuma comanda pronta no momento.</div>';
  } else {
    readyOrders.forEach((order) => {
      const pill = document.createElement('div');
      pill.className = 'ready-pill';
      pill.innerHTML = `<strong>${order.code}</strong><span>${order.status}</span>`;
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
