const openingForm = document.getElementById('opening-form');
const openingDateInput = document.getElementById('opening-date');
const openingStatus = document.getElementById('opening-status');
const closingStatus = document.getElementById('closing-status');
const closingSummary = document.getElementById('closing-summary');
const closeDayButton = document.getElementById('close-day-button');
const clearButton = document.getElementById('clear-button');

function toDateTimeLocalValue(isoString) {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(isoString) {
  if (!isoString) {
    return 'Nenhuma abertura registrada ainda.';
  }

  return `Sistema aberto em ${new Date(isoString).toLocaleString('pt-BR')}`;
}

function formatClosingDate(isoString) {
  if (!isoString) {
    return 'Nenhum encerramento registrado ainda.';
  }

  return `Sistema encerrado em ${new Date(isoString).toLocaleString('pt-BR')}`;
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderClosingSummary(summary) {
  if (!summary) {
    closingSummary.innerHTML = '';
    return;
  }

  closingSummary.innerHTML = `
    <strong>Resumo do dia</strong>
    <p>Pedidos feitos no dia: ${summary.ordersCount}</p>
  `;
}

async function loadSystemSettings() {
  const response = await fetch('/api/system');
  const data = await response.json();
  const openingDate = data.system?.openingDate || '';
  const closingDate = data.system?.closingDate || '';
  const summary = data.system?.closingSummary || null;

  openingDateInput.value = toDateTimeLocalValue(openingDate);
  openingStatus.textContent = formatDate(openingDate);
  closingStatus.textContent = formatClosingDate(closingDate);
  renderClosingSummary(summary);
}

openingForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const openingDate = openingDateInput.value;
  const response = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ openingDate })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Não foi possível salvar a data de abertura.');
    return;
  }

  openingStatus.textContent = formatDate(data.system?.openingDate);
  renderClosingSummary(data.system?.closingSummary || null);
});

closeDayButton.addEventListener('click', async () => {
  const closingDate = new Date().toISOString();
  const response = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ closingDate })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Não foi possível encerrar o dia.');
    return;
  }

  closingStatus.textContent = formatClosingDate(data.system?.closingDate);
  renderClosingSummary(data.system?.closingSummary || null);
});

clearButton.addEventListener('click', async () => {
  if (!confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
    return;
  }

  const response = await fetch('/api/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clear: true })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Não foi possível limpar os dados.');
    return;
  }

  openingDateInput.value = '';
  snackPriceInput.value = '';
  openingStatus.textContent = 'Nenhuma abertura registrada ainda.';
  closingStatus.textContent = 'Nenhum encerramento registrado ainda.';
  renderClosingSummary(null);
  alert('Dados limpos com sucesso!');
});

loadSystemSettings();