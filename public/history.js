const historyCounter = document.getElementById('history-counter');
const historyList = document.getElementById('history-list');
const exportButton = document.getElementById('export-button');

let historyItems = [];

function formatDate(isoString) {
  if (!isoString) {
    return '-';
  }

  return new Date(isoString).toLocaleString('pt-BR');
}

function renderHistory() {
  historyCounter.textContent = `${historyItems.length} item${historyItems.length === 1 ? '' : 's'}`;
  historyList.innerHTML = '';

  if (!historyItems.length) {
    historyList.innerHTML = '<p class="empty-state">Nenhuma comanda finalizada ainda.</p>';
    return;
  }

  historyItems.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'order-card done';
    article.innerHTML = `
      <div class="order-top">
        <h3>Comanda ${item.code}</h3>
        <span class="status-pill">${item.status}</span>
      </div>
      <p><strong>Criada:</strong> ${formatDate(item.createdAt)}</p>
      <p><strong>Finalizada:</strong> ${formatDate(item.finalizedAt || item.updatedAt)}</p>
      <div class="order-actions">
        <button data-delete="${item.code}" class="danger small">Remover</button>
      </div>
    `;
    historyList.appendChild(article);
  });
}

async function refreshHistory() {
  const response = await fetch('/api/history');
  const data = await response.json();
  historyItems = data.history || [];
  renderHistory();
}

async function exportToCSV() {
  const response = await fetch('/api/history/export');
  
  if (!response.ok) {
    alert('Não foi possível exportar o histórico.');
    return;
  }

  const csvContent = await response.text();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `historico_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

exportButton.addEventListener('click', exportToCSV);

historyList.addEventListener('click', async (event) => {
  const deleteCode = event.target.getAttribute('data-delete');

  if (deleteCode) {
    if (!confirm(`Tem certeza que deseja remover a comanda ${deleteCode}?`)) {
      return;
    }

    const response = await fetch(`/api/history/${encodeURIComponent(deleteCode)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      alert(data.error || 'Não foi possível remover a comanda.');
      return;
    }
    await refreshHistory();
  }
});

refreshHistory();
setInterval(refreshHistory, 3000);