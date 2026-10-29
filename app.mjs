import { Deck, fieldLabels, parseTsv } from "./deck.mjs";

const STORAGE_KEY = "vocdog-pwa-session-v1";
const $ = (id) => document.getElementById(id);
const controls = ["startButton", "resetButton", "swapButton", "rangeButton", "fieldsButton", "randomButton", "viewButton"];

let deck = null;
let filename = "";
let header = null;
let skipped = 0;
let labels = [];
let promptIndex = 0;
let answerIndex = 1;
let detailIndices = [];
let running = false;
let revealed = false;
let editing = false;
let elapsedMs = 0;
let startedAt = null;

function setLoaded(enabled) {
  controls.forEach((id) => { $(id).disabled = !enabled; });
}

function currentElapsed() {
  return elapsedMs + (startedAt ? Date.now() - startedAt : 0);
}

function pauseTimer() {
  if (startedAt) {
    elapsedMs += Date.now() - startedAt;
    startedAt = null;
  }
}

function resetTimer() {
  elapsedMs = 0;
  startedAt = null;
}

function formatElapsed(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function fieldValue(item, index, editable = false) {
  const value = item?.value(index) ?? "";
  return value || (editable ? "" : `[Field ${index + 1} is empty]`);
}

function status(action) {
  if (!deck) {
    $("status").textContent = action;
    return;
  }
  const blank = skipped ? ` · ${skipped} blank lines skipped` : "";
  $("status").textContent = `${filename} · range ${deck.rangeStart}–${deck.rangeEnd} · ${deck.activeCount} active · ${deck.ejected.length} learned · ${deck.totalCount} total${blank} · ${action}`;
}

function setCard(message, answer = "") {
  $("promptInput").value = message;
  $("answerInput").value = answer;
  $("details").textContent = "";
}

function setActionState(mode) {
  $("actions").hidden = mode === "idle";
  $("editButton").disabled = mode === "idle";
  $("revealButton").hidden = mode !== "prompt";
  $("revealButton").disabled = mode !== "prompt";
  $("ratingActions").hidden = mode !== "answer";
  if (mode === "idle") {
    $("revealButton").hidden = false;
    $("revealButton").disabled = true;
  }
  document.querySelectorAll("#revealButton, #ratingActions button").forEach((button) => {
    button.disabled = editing || (button.id === "revealButton" && mode !== "prompt");
  });
}

function setEditing(enabled) {
  if (!deck?.active) return;
  if (!enabled) commitEdits();
  editing = enabled;
  $("promptInput").readOnly = !enabled;
  $("answerInput").readOnly = !enabled || !revealed;
  $("editButton").textContent = enabled ? "Done editing" : "Edit card";
  setActionState(revealed ? "answer" : "prompt");
  if (enabled) {
    (revealed ? $("answerInput") : $("promptInput")).focus();
  } else {
    document.activeElement?.blur();
  }
}

function commitEdits() {
  if (!deck?.active) return;
  const prompt = $("promptInput").value.replace(/\r?\n/g, " ");
  deck.active.setField(promptIndex, prompt);
  $("promptInput").value = prompt;
  if (revealed) {
    const answer = $("answerInput").value.replace(/\r?\n/g, " ");
    deck.active.setField(answerIndex, answer);
    $("answerInput").value = answer;
  }
}

function persist() {
  if (!deck) return;
  commitEdits();
  const session = {
    version: 1,
    deck,
    filename,
    header,
    skipped,
    labels,
    promptIndex,
    answerIndex,
    detailIndices,
    revealed,
    elapsedMs: currentElapsed(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* Continue without persistence. */ }
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!session?.deck) return false;
    deck = Deck.fromJSON(session.deck);
    deck.restoreActive();
    filename = session.filename || "restored deck";
    header = session.header ?? null;
    skipped = session.skipped || 0;
    labels = session.labels || fieldLabels(deck.snapshot(), header);
    promptIndex = session.promptIndex ?? 0;
    answerIndex = session.answerIndex ?? 1;
    detailIndices = session.detailIndices ?? labels.map((_, i) => i).filter((i) => i > 1);
    elapsedMs = session.elapsedMs || 0;
    startedAt = null;
    running = revealed = editing = false;
    setLoaded(true);
    setCard("Session restored — press Start");
    setActionState("idle");
    status("Stopped");
    return true;
  } catch {
    return false;
  }
}

async function openFile(file) {
  const text = await file.text();
  const hasHeader = window.confirm("Does the first row contain column headings?");
  const parsed = parseTsv(text, hasHeader);
  const width = Math.max(0, ...parsed.items.map((item) => item.fields.length));
  if (!parsed.items.length || width < 2) {
    window.alert("The file needs at least one item with two tab-delimited fields.");
    return;
  }
  stop(false);
  deck = new Deck(parsed.items);
  filename = file.name;
  header = parsed.header;
  skipped = parsed.skipped;
  labels = fieldLabels(parsed.items, header);
  promptIndex = 0;
  answerIndex = 1;
  detailIndices = labels.map((_, index) => index).filter((index) => index > 1);
  resetTimer();
  running = revealed = editing = false;
  setLoaded(true);
  setCard("Ready — press Start");
  setActionState("idle");
  status("Stopped");
  persist();
}

function start() {
  if (!deck?.activeCount) return;
  running = true;
  startedAt = Date.now();
  $("startButton").disabled = true;
  $("stopButton").disabled = false;
  showNext();
}

function stop(updateCard = true) {
  commitEdits();
  editing = false;
  $("promptInput").readOnly = true;
  $("answerInput").readOnly = true;
  $("editButton").textContent = "Edit card";
  pauseTimer();
  deck?.restoreActive();
  running = revealed = false;
  $("stopButton").disabled = true;
  $("startButton").disabled = !deck?.activeCount;
  if (updateCard && deck) setCard("Stopped — press Start to resume");
  setActionState("idle");
  if (deck) status("Stopped");
  persist();
}

function showNext() {
  const item = deck?.takeNext();
  if (!item) {
    pauseTimer();
    running = revealed = editing = false;
    $("stopButton").disabled = true;
    $("startButton").disabled = true;
    setCard("Practice range complete", `Elapsed time: ${formatElapsed(elapsedMs)}`);
    $("promptInput").disabled = true;
    $("answerInput").disabled = true;
    setActionState("idle");
    status(`Complete · elapsed ${formatElapsed(elapsedMs)}`);
    persist();
    return;
  }
  revealed = false;
  editing = false;
  $("promptInput").disabled = false;
  $("promptInput").readOnly = true;
  $("answerInput").disabled = true;
  $("answerInput").readOnly = true;
  $("editButton").textContent = "Edit card";
  $("promptInput").value = fieldValue(item, promptIndex, true);
  $("answerInput").value = "";
  $("details").textContent = "";
  setActionState("prompt");
  status("Reveal the answer");
  persist();
}

function reveal() {
  if (!running || !deck?.active) return;
  commitEdits();
  revealed = true;
  $("answerInput").disabled = false;
  $("answerInput").readOnly = true;
  $("answerInput").value = fieldValue(deck.active, answerIndex, true);
  $("details").textContent = detailIndices.map((index) => fieldValue(deck.active, index)).join("\n\n");
  setActionState("answer");
  status("Choose 1–9, 0 Learned, or Move to end");
  persist();
}

function schedule(rating = null) {
  if (!revealed || !deck?.active) return;
  commitEdits();
  editing = false;
  deck.scheduleActive(rating);
  showNext();
}

function eject() {
  if (!revealed || !deck?.active) return;
  commitEdits();
  editing = false;
  deck.ejectActive();
  showNext();
}

function resetRange() {
  if (!deck) return;
  stop(false);
  deck.resetRange();
  resetTimer();
  $("startButton").disabled = false;
  setCard("Practice range reset — press Start");
  status("Reset");
  persist();
}

function swapFields() {
  if (!deck) return;
  stop(false);
  [promptIndex, answerIndex] = [answerIndex, promptIndex];
  setCard("Prompt and answer swapped — press Start");
  status("Fields swapped");
  persist();
}

function randomize() {
  if (!deck) return;
  stop(false);
  deck.shuffle();
  setCard("Current range randomized — press Start");
  status("Randomized");
  persist();
}

function openRangeDialog() {
  if (!deck) return;
  stop(false);
  $("rangeHelp").textContent = `Choose a contiguous range from 1 to ${deck.totalCount}.`;
  $("rangeStart").max = deck.totalCount;
  $("rangeEnd").max = deck.totalCount;
  $("rangeStart").value = deck.rangeStart;
  $("rangeEnd").value = deck.rangeEnd;
  $("rangeDialog").showModal();
}

function fillFieldDialog() {
  const options = labels.map((label, index) => `<option value="${index}">${escapeHtml(label)}</option>`).join("");
  $("promptSelect").innerHTML = options;
  $("answerSelect").innerHTML = options;
  $("promptSelect").value = promptIndex;
  $("answerSelect").value = answerIndex;
  $("detailsChoices").innerHTML = labels.map((label, index) => `<label><input type="checkbox" value="${index}" ${detailIndices.includes(index) ? "checked" : ""}> ${escapeHtml(label)}</label>`).join("");
  $("fieldsError").textContent = "";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function openFieldsDialog() {
  if (!deck) return;
  stop(false);
  fillFieldDialog();
  $("fieldsDialog").showModal();
}

function viewAll() {
  if (!deck) return;
  commitEdits();
  $("viewHeading").textContent = `${labels[promptIndex]} · ${deck.totalCount} items`;
  $("allItems").textContent = deck.snapshot().map((item) => fieldValue(item, promptIndex)).join("\n");
  $("viewDialog").showModal();
}

$("openButton").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await openFile(file);
  event.target.value = "";
});
$("startButton").addEventListener("click", start);
$("stopButton").addEventListener("click", () => stop());
$("resetButton").addEventListener("click", resetRange);
$("swapButton").addEventListener("click", swapFields);
$("randomButton").addEventListener("click", randomize);
$("rangeButton").addEventListener("click", openRangeDialog);
$("fieldsButton").addEventListener("click", openFieldsDialog);
$("viewButton").addEventListener("click", viewAll);
$("editButton").addEventListener("click", () => setEditing(!editing));
$("revealButton").addEventListener("click", reveal);
$("endButton").addEventListener("click", () => schedule(null));
$("ejectButton").addEventListener("click", eject);
document.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => schedule(Number(button.dataset.rating))));

$("rangeAll").addEventListener("click", () => {
  $("rangeStart").value = 1;
  $("rangeEnd").value = deck.totalCount;
});
$("rangeForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  try {
    deck.setRange(Number($("rangeStart").value), Number($("rangeEnd").value));
    resetTimer();
    $("rangeDialog").close();
    $("startButton").disabled = false;
    setCard(`Range ${deck.rangeStart}–${deck.rangeEnd} selected — press Start`);
    status("Range updated");
    persist();
  } catch (error) {
    window.alert(error.message);
  }
});

$("dialogSwap").addEventListener("click", () => {
  const value = $("promptSelect").value;
  $("promptSelect").value = $("answerSelect").value;
  $("answerSelect").value = value;
});
$("fieldsForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const nextPrompt = Number($("promptSelect").value);
  const nextAnswer = Number($("answerSelect").value);
  if (nextPrompt === nextAnswer) {
    $("fieldsError").textContent = "Prompt and answer must be different.";
    return;
  }
  promptIndex = nextPrompt;
  answerIndex = nextAnswer;
  detailIndices = [...$("detailsChoices").querySelectorAll("input:checked")]
    .map((input) => Number(input.value)).filter((index) => index !== promptIndex && index !== answerIndex);
  $("fieldsDialog").close();
  setCard("Field selection updated — press Start");
  status("Fields updated");
  persist();
});

document.addEventListener("keydown", (event) => {
  if (!running || event.target.closest("dialog")) return;
  if (editing) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      setEditing(false);
    }
    return;
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    revealed ? schedule(null) : reveal();
  } else if (revealed && /^[1-9]$/.test(event.key) && !["TEXTAREA", "INPUT"].includes(event.target.tagName)) {
    schedule(Number(event.key));
  } else if (revealed && event.key === "0" && !["TEXTAREA", "INPUT"].includes(event.target.tagName)) {
    eject();
  }
});

window.addEventListener("pagehide", persist);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js");
if (!restoreSession()) setActionState("idle");
