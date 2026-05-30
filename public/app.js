const form = document.getElementById('order-form');
const finalizeForm = document.getElementById('finalize-form');
const ordersContainer = document.getElementById('orders');
const counter = document.getElementById('counter');
const codeInput = document.getElementById('code');
const statusInput = document.getElementById('status');
const finalizeCodeInput = document.getElementById('finalize-code');

let orders = [];

function formatDate(isoString) {
  if (!isoString) {
    return '-';
  }

  return new Date(isoString).toLocaleString('pt-BR');
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('finalizado')) return 'done';
  if (normalized.includes('pronto')) return 'ready';
  if (normalized.includes('preparo')) return 'separating';
  return 'progress';
}

function canFinalize(status) {
  const normalized = String(status || '').toLowerCase();
  return !normalized.includes('finalizado');
}

function renderOrders() {
  counter.textContent = `${orders.length} item${orders.length === 1 ? '' : 's'}`;
  ordersContainer.innerHTML = '';

  if (!orders.length) {
    ordersContainer.innerHTML = '<p class="empty-state">Nenhuma comanda cadastrada ainda.</p>';
    return;
  }

  orders.forEach((order) => {
    const article = document.createElement('article');
    article.className = `order-card ${statusClass(order.status)}`;
    article.innerHTML = `
      <div class="order-top">
        <h3>Comanda ${order.code}</h3>
        <span class="status-pill">${order.status}</span>
      </div>
      <p><strong>Criada:</strong> ${formatDate(order.createdAt)}</p>
      <p><strong>Atualizada:</strong> ${formatDate(order.updatedAt)}</p>
      <div class="order-actions">
        <button data-ready="${order.code}" class="primary small">Pronto</button>
        <button data-finalize="${order.code}" class="success small" ${!canFinalize(order.status) ? 'disabled' : ''}>Finalizar</button>
        <button data-delete="${order.code}" class="danger small">Remover</button>
      </div>
    `;
    ordersContainer.appendChild(article);
  });
}

async function refreshOrders() {
  const response = await fetch('/api/orders');
  const data = await response.json();
  orders = data.orders || [];
  renderOrders();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    code: codeInput.value,
    status: statusInput.value
  };

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Não foi possível salvar a comanda.');
    return;
  }

  codeInput.value = '';
  codeInput.focus();
  await refreshOrders();
});

finalizeForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const code = finalizeCodeInput.value.trim();
  const response = await fetch(`/api/orders/${encodeURIComponent(code)}/finalize`, {
    method: 'POST'
  });
  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Não foi possível finalizar a entrega.');
    return;
  }

  finalizeCodeInput.value = '';
  finalizeCodeInput.focus();
  await refreshOrders();
});

ordersContainer.addEventListener('click', async (event) => {
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
