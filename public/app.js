// @ts-check
// Remote control only: the countdown and the shutdown live in the Node process.

/** @typedef {import('../src/gui/server.ts').GuiState} GuiState */

const token = new URLSearchParams(location.hash.slice(1)).get('t') ?? '';

/** @template {HTMLElement} T @param {string} id @returns {T} */
const $ = (id) => /** @type {T} */ (document.getElementById(id));
const form = /** @type {HTMLFormElement} */ ($('form'));
const amountInput = /** @type {HTMLInputElement} */ ($('amount'));
const unitSelect = /** @type {HTMLSelectElement} */ ($('unit'));
const startButton = /** @type {HTMLButtonElement} */ ($('start'));
const pauseButton = /** @type {HTMLButtonElement} */ ($('pause'));
const cancelButton = /** @type {HTMLButtonElement} */ ($('cancel'));
const progress = /** @type {HTMLProgressElement} */ ($('progress'));
const clock = $('clock');
const caption = $('caption');
const errorBox = $('error');
const dryRunBanner = $('dry-run');
const commandInfo = $('command');

/** @type {GuiState['status']} */
let status = 'idle';
let disconnected = false;

/** @param {string} path @param {unknown} [body] */
async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: path === 'info' ? 'GET' : 'POST',
    headers: { 'X-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Błąd ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** @param {() => Promise<unknown>} action */
const run = (action) => {
  errorBox.textContent = '';
  action().catch((/** @type {Error} */ err) => (errorBox.textContent = err.message));
};

/** Whole seconds from the form, or null if the value is not a positive duration. */
function readSeconds() {
  const seconds = Math.round(amountInput.valueAsNumber * (unitSelect.value === 'minutes' ? 60 : 1));
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function updateStartButton() {
  startButton.disabled = disconnected || status !== 'idle' || readSeconds() === null;
}

/** @param {GuiState} state */
function render(state) {
  status = state.status;
  const counting = state.status === 'running' || state.status === 'paused';

  amountInput.disabled = state.status !== 'idle';
  unitSelect.disabled = state.status !== 'idle';
  pauseButton.disabled = disconnected || !counting;
  pauseButton.textContent = state.status === 'paused' ? 'Wznów' : 'Pauza';
  cancelButton.disabled = disconnected || !counting;
  updateStartButton();

  document.body.dataset.status = state.status;
  clock.textContent = state.clock;
  caption.textContent = state.caption;
  if (state.error) errorBox.textContent = state.error;
  progress.value = counting ? state.remaining / state.total : state.status === 'done' ? 0 : 1;
  document.title = counting ? `${state.clock} — Shutdowner` : 'Shutdowner';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const seconds = readSeconds();
  if (seconds !== null) run(() => api('start', { seconds }));
});
amountInput.addEventListener('input', updateStartButton);
unitSelect.addEventListener('change', updateStartButton);
pauseButton.addEventListener('click', () => run(() => api(status === 'paused' ? 'resume' : 'pause')));
cancelButton.addEventListener('click', () => run(() => api('cancel')));

const events = new EventSource(`/api/events?t=${encodeURIComponent(token)}`);
events.addEventListener('message', (event) => {
  if (disconnected) errorBox.textContent = '';
  disconnected = false;
  render(JSON.parse(event.data));
});
events.addEventListener('error', async () => {
  disconnected = true;
  updateStartButton();
  pauseButton.disabled = cancelButton.disabled = true;
  // EventSource doesn't expose the status code, so ask the server why we were refused.
  const status = await fetch('/api/info', { headers: { 'X-Token': token } }).then(
    (res) => res.status,
    () => 0,
  );
  if (!disconnected) return;
  errorBox.textContent =
    status === 0
      ? 'Brak połączenia z programem w terminalu. Jeśli go zamknięto, uruchom ponownie z --gui.'
      : status === 403
        ? 'Ten link jest nieaktualny (np. po ponownym uruchomieniu programu) — otwórz link wypisany w terminalu.'
        : `Błąd połączenia (${status}).`;
});

try {
  const info = await api('info');
  dryRunBanner.hidden = !info.dryRun;
  commandInfo.textContent = info.command
    ? `Po odliczeniu: ${info.command}`
    : 'Ten system nie jest obsługiwany — wyłączenie nie zadziała.';
} catch {
  // The event stream's error handler already explains what's wrong.
}
