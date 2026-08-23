const form = document.querySelector("#meeting-form");
const audioInput = document.querySelector("#audio");
const dropZone = document.querySelector("#drop-zone");
const fileLabel = document.querySelector("#file-label");
const fileHelp = document.querySelector("#file-help");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");
const apiStatus = document.querySelector("#api-status");
const emptyResult = document.querySelector("#empty-result");
const result = document.querySelector("#result");
const history = document.querySelector("#history");

let activeMeeting = null;

audioInput.addEventListener("change", updateFileLabel);
dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  audioInput.files = transfer.files;
  updateFileLabel();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  showMessage("Uploading and transcribing your meeting. This may take a minute...");

  try {
    const response = await fetch("/api/meetings", {
      method: "POST",
      body: new FormData(form),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The meeting could not be processed.");

    renderMeeting(payload.meeting);
    showMessage("Meeting notes are ready.");
    await loadHistory();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(false);
  }
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  if (!activeMeeting) return;
  const button = document.querySelector("#copy-button");
  try {
    await navigator.clipboard.writeText(formatMeeting(activeMeeting));
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = "Copy notes"; }, 1600);
  } catch {
    showMessage("Copy failed. Select and copy the notes manually.", true);
  }
});

document.querySelector("#refresh-button").addEventListener("click", loadHistory);

function updateFileLabel() {
  const [file] = audioInput.files;
  if (!file) {
    fileLabel.textContent = "Drop audio here or choose a file";
    fileHelp.textContent = "MP3, M4A, WAV, WEBM, MP4, OGG, or FLAC · max 25 MB";
    return;
  }
  fileLabel.textContent = file.name;
  fileHelp.textContent = formatBytes(file.size);
}

function renderMeeting(meeting) {
  activeMeeting = meeting;
  emptyResult.hidden = true;
  result.hidden = false;

  setText("#result-title", meeting.title);
  setText(
    "#result-meta",
    `${formatDate(meeting.createdAt)} · ${meeting.source.filename} · ${formatBytes(meeting.source.sizeBytes)}`,
  );
  setText("#overview", meeting.summary.overview);
  setText("#transcript", meeting.transcript);
  renderList("#decisions", meeting.summary.keyDecisions, "No explicit decisions recorded.");
  renderList("#questions", meeting.summary.openQuestions, "No open questions recorded.");
  renderActions(meeting.summary.actionItems);
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderList(selector, items, emptyText) {
  const list = document.querySelector(selector);
  list.replaceChildren();
  const values = items.length ? items : [emptyText];
  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }
}

function renderActions(items) {
  const container = document.querySelector("#actions");
  container.replaceChildren();
  if (!items.length) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No action items were identified.";
    container.append(message);
    return;
  }

  for (const action of items) {
    const card = document.createElement("div");
    card.className = "action-card";
    const task = document.createElement("div");
    const taskTitle = document.createElement("strong");
    const dueDate = document.createElement("span");
    const owner = document.createElement("span");
    owner.className = "action-owner";
    taskTitle.textContent = action.task;
    dueDate.textContent = `Due: ${action.dueDate}`;
    owner.textContent = action.owner;
    task.append(taskTitle, dueDate);
    card.append(task, owner);
    container.append(card);
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/api/meetings");
    if (!response.ok) throw new Error();
    const { meetings } = await response.json();
    history.replaceChildren();
    if (!meetings.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Your processed meetings will appear here.";
      history.append(empty);
      return;
    }

    for (const meeting of meetings) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-item";
      const details = document.createElement("span");
      const title = document.createElement("strong");
      const meta = document.createElement("span");
      const arrow = document.createElement("span");
      title.textContent = meeting.title;
      meta.textContent = `${formatDate(meeting.createdAt)} · ${meeting.summary.actionItems.length} action item${meeting.summary.actionItems.length === 1 ? "" : "s"}`;
      arrow.textContent = "View →";
      details.append(title, meta);
      button.append(details, arrow);
      button.addEventListener("click", () => renderMeeting(meeting));
      history.append(button);
    }
  } catch {
    history.replaceChildren();
    const error = document.createElement("p");
    error.className = "muted";
    error.textContent = "Recent meetings could not be loaded.";
    history.append(error);
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    apiStatus.textContent = health.aiConfigured ? "AI connected" : "Setup required";
    apiStatus.className = `status-pill ${health.aiConfigured ? "ready" : "warning"}`;
    if (!health.aiConfigured) {
      showMessage("Add GROQ_API_KEY to .env before processing audio.");
    }
  } catch {
    apiStatus.textContent = "Server unavailable";
    apiStatus.className = "status-pill warning";
  }
}

function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.querySelector("span:first-child").textContent = busy
    ? "Processing meeting..."
    : "Generate meeting notes";
}

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error", isError);
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMeeting(meeting) {
  const lines = [
    meeting.title,
    "",
    "OVERVIEW",
    meeting.summary.overview,
    "",
    "KEY DECISIONS",
    ...asBullets(meeting.summary.keyDecisions),
    "",
    "ACTION ITEMS",
    ...meeting.summary.actionItems.map(
      (item) => `- ${item.task} — ${item.owner} — Due: ${item.dueDate}`,
    ),
    "",
    "OPEN QUESTIONS",
    ...asBullets(meeting.summary.openQuestions),
    "",
    "TRANSCRIPT",
    meeting.transcript,
  ];
  return lines.join("\n");
}

function asBullets(items) {
  return items.length ? items.map((item) => `- ${item}`) : ["- None recorded"];
}

checkHealth();
loadHistory();
