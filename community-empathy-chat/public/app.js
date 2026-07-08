// app.js — talks to our own backend (/api/personas, /api/chat), never to Anthropic directly.

const CHALLENGE_LABELS = {
  "sport-girls": "Girls in Sport",
  "social-connection": "Life After the Social Media Ban",
  "belonging-safety": "Feeling Safe & Belonging",
  "healthy-masculinity": "Healthy Masculinity",
  "refugee-support": "Supporting Refugees",
  "migrant-histories": "Celebrating Migrant Histories",
  "remove-barriers": "Removing Barriers to Participation",
  "cost-of-living": "Cost of Living Crisis",
  "redesign-spaces": "Redesigning Safer Spaces",
  "community-support": "Supporting Communities in Need",
};

const cardBoard = document.getElementById("cardBoard");
const challengeFilters = document.getElementById("challengeFilters");
const overlay = document.getElementById("overlay");
const closeFolderBtn = document.getElementById("closeFolder");
const exportChatBtn = document.getElementById("exportChat");
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const composerNote = document.getElementById("composerNote");

let personas = [];
let activeFilter = null;
let activePersona = null;
let history = []; // [{role: 'user'|'assistant', content: string}] — the OPEN persona's conversation
const conversationStore = {}; // personaId -> history array, kept alive even after closing the folder
const MAX_TURNS = 24;

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

async function loadPersonas() {
  try {
    const res = await fetch("/api/personas");
    personas = await res.json();
    renderFilters();
    renderBoard();
  } catch (err) {
    cardBoard.innerHTML = `<p class="cork__loading">Couldn't load case files. Is the server running?</p>`;
  }
}

function renderFilters() {
  const usedChallenges = new Set();
  personas.forEach((p) => (p.challenges || []).forEach((c) => usedChallenges.add(c)));

  challengeFilters.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "chip" + (activeFilter === null ? " chip--active" : "");
  allChip.textContent = "All";
  allChip.addEventListener("click", () => {
    activeFilter = null;
    renderFilters();
    renderBoard();
  });
  challengeFilters.appendChild(allChip);

  Array.from(usedChallenges).forEach((code) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (activeFilter === code ? " chip--active" : "");
    chip.textContent = CHALLENGE_LABELS[code] || code;
    chip.addEventListener("click", () => {
      activeFilter = activeFilter === code ? null : code;
      renderFilters();
      renderBoard();
    });
    challengeFilters.appendChild(chip);
  });
}

function renderBoard() {
  cardBoard.innerHTML = "";
  const visible = activeFilter
    ? personas.filter((p) => (p.challenges || []).includes(activeFilter))
    : personas;

  if (visible.length === 0) {
    cardBoard.innerHTML = `<p class="cork__loading">No case files tagged for this challenge yet.</p>`;
    return;
  }

  visible.forEach((p, i) => {
    const tilt = (i % 2 === 0 ? -1 : 1) * (1.5 + (i % 3));
    const tagsHtml = (p.challenges || [])
      .map((c) => `<span class="card__tag">${CHALLENGE_LABELS[c] || c}</span>`)
      .join("");
    const btn = document.createElement("button");
    btn.className = "card";
    btn.style.setProperty("--tilt", `${tilt}deg`);
    btn.innerHTML = `
      <div class="card__tape"></div>
      <div class="card__top">
        <div class="card__badge" style="background:${p.colour}">${initials(p.name)}</div>
        <div>
          <p class="card__name">${p.name}</p>
          <p class="card__role">${p.role}</p>
        </div>
      </div>
      <p class="card__blurb">${p.blurb}</p>
      <div class="card__tags">${tagsHtml}</div>
      <span class="card__stamp" style="color:${p.colour}">CASE FILE · AGE ${p.age}</span>
    `;
    btn.addEventListener("click", () => openFolder(p));
    cardBoard.appendChild(btn);
  });
}

function openFolder(persona) {
  activePersona = persona;
  history = conversationStore[persona.id] || [];

  document.getElementById("folderTabLabel").textContent = `CASE FILE — ${persona.name.toUpperCase()}`;
  document.getElementById("folderBadge").textContent = initials(persona.name);
  document.getElementById("folderBadge").style.background = persona.colour;
  document.getElementById("folderName").textContent = persona.name;
  document.getElementById("folderRole").textContent = persona.role.toUpperCase();
  document.getElementById("folderAge").textContent = persona.age;

  chatLog.innerHTML = "";
  if (history.length === 0) {
    addMessage("persona", `Hi, I'm ${persona.name.split(" ")[0]}. Go ahead, ask me something.`, { record: false });
  } else {
    // Restore the previous conversation without re-adding it to history (it's already there).
    history.forEach((m) => {
      addMessage(m.role === "user" ? "student" : "persona", m.content, { record: false });
    });
  }
  composerNote.textContent = "";
  chatInput.value = "";
  overlay.hidden = false;
  chatInput.focus();
}

function closeFolder() {
  if (activePersona) {
    conversationStore[activePersona.id] = history;
  }
  overlay.hidden = true;
  activePersona = null;
}

function exportChat() {
  if (!activePersona) return;

  if (history.length === 0) {
    composerNote.textContent = "Ask at least one question before exporting.";
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;
  let y = margin;

  function checkPageBreak(neededHeight) {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Community Case Files — Chat Transcript", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Persona: ${activePersona.name} (${activePersona.role}, age ${activePersona.age})`, margin, y);
  y += 16;
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  y += 18;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  // Messages
  doc.setFontSize(11);
  history.forEach((m) => {
    const speaker = m.role === "user" ? "Student" : activePersona.name;
    const lines = doc.splitTextToSize(m.content, maxWidth);
    const blockHeight = lineHeight + lines.length * lineHeight + 8;

    checkPageBreak(blockHeight);

    doc.setFont("helvetica", "bold");
    doc.text(`${speaker}:`, margin, y);
    y += lineHeight;

    doc.setFont("helvetica", "normal");
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + 8;
  });

  const safeName = activePersona.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`${safeName}-chat-${dateStamp}.pdf`);
}

exportChatBtn.addEventListener("click", exportChat);
closeFolderBtn.addEventListener("click", closeFolder);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeFolder(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeFolder(); });

function addMessage(kind, text, opts = {}) {
  const div = document.createElement("div");
  div.className = `msg msg--${kind}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  if (opts.record !== false && (kind === "persona" || kind === "student")) {
    history.push({ role: kind === "student" ? "user" : "assistant", content: text });
  }
  return div;
}

function setTyping(on) {
  let el = document.getElementById("typingIndicator");
  if (on) {
    if (!el) {
      el = document.createElement("div");
      el.id = "typingIndicator";
      el.className = "msg msg--typing";
      el.textContent = `${activePersona.name.split(" ")[0]} is typing…`;
      chatLog.appendChild(el);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  } else if (el) {
    el.remove();
  }
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !activePersona) return;

  if (history.length >= MAX_TURNS) {
    composerNote.textContent = "This conversation has reached its limit — close and reopen the case file to start fresh.";
    return;
  }

  addMessage("student", text);
  chatInput.value = "";
  chatInput.disabled = true;
  setTyping(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaId: activePersona.id, messages: history }),
    });
    const data = await res.json();
    setTyping(false);

    if (!res.ok) {
      addMessage("system", data.error || "Something went wrong. Please try again.", { record: false });
    } else {
      addMessage("persona", data.reply);
    }
  } catch (err) {
    setTyping(false);
    addMessage("system", "Couldn't reach the server. Please check your connection and try again.", { record: false });
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
});

loadPersonas();
