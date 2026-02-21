// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

const USER_COLORS = [
  "#7c6af7",
  "#4ecdc4",
  "#ff6b6b",
  "#ffd93d",
  "#51cf66",
  "#ff9f43",
  "#fd79a8",
  "#a29bfe",
  "#00b894",
  "#fdcb6e",
];

let me = { id: "", name: "", color: "" };
let users = {};
let channel; // BroadcastChannel
let currentDoc = "doc_1";
let editCount = 0;
let typingTimer;
let isTypingInChat = false;
let sidebarOpen = true;
let rightPanelOpen = true;
let editorMode = "code";
let lineWrapping = false;

const docs = {
  doc_1: {
    id: "doc_1",
    title: "Untitled Document",
    content: `// Welcome to CollabPad! 🚀
// Open this in another browser tab to see real-time collaboration.

function greet(name) {
  return \`Hello, \${name}! Welcome to CollabPad.\`;
}

class CollabEditor {
  constructor(options = {}) {
    this.users = new Map();
    this.version = 0;
    this.history = [];
  }

  addUser(user) {
    this.users.set(user.id, user);
    this.broadcast({ type: 'user_joined', user });
  }

  broadcast(event) {
    // Real-time via BroadcastChannel API
    channel.postMessage(event);
  }
}

const editor = new CollabEditor();
console.log(greet('World'));
`,
    lang: "js",
    type: "code",
  },
  doc_2: {
    id: "doc_2",
    title: "Project Notes",
    content: `# Project Notes 📋

## Overview
This document tracks our collaborative project notes.

## Goals
- Build real-time collaboration
- Multi-user cursor support  
- Live chat integration
- Document management

## Architecture
The collaboration layer uses the BroadcastChannel API for
same-origin real-time communication between browser tabs.

## Next Steps
1. Add operational transforms for conflict resolution
2. Implement persistent storage (IndexedDB)
3. Add video/voice chat integration
`,
    lang: "md",
    type: "note",
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  // Populate color picker
  const cp = document.getElementById("colorPicks");
  USER_COLORS.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "color-pick" + (i === 0 ? " selected" : "");
    div.style.background = c;
    div.dataset.color = c;
    div.onclick = () => {
      document
        .querySelectorAll(".color-pick")
        .forEach((x) => x.classList.remove("selected"));
      div.classList.add("selected");
    };
    cp.appendChild(div);
  });

  // Random name suggestion
  const names = [
    "Alice",
    "Bob",
    "Carol",
    "Dave",
    "Eve",
    "Frank",
    "Grace",
    "Hank",
  ];
  document.getElementById("userNameInput").value =
    names[Math.floor(Math.random() * names.length)];

  document.getElementById("userNameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinSession();
  });
});

function joinSession() {
  const nameInput = document.getElementById("userNameInput").value.trim();
  if (!nameInput) return;

  const selectedColor =
    document.querySelector(".color-pick.selected")?.dataset.color ||
    USER_COLORS[0];

  me = {
    id: "user_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name: nameInput,
    color: selectedColor,
    initials: nameInput.slice(0, 2).toUpperCase(),
  };

  // Hide modal
  document.getElementById("joinModal").style.display = "none";

  // Setup BroadcastChannel (real WebSocket-like comms between tabs)
  channel = new BroadcastChannel("collabpad_v1");
  channel.onmessage = handleBroadcast;

  // Announce presence
  broadcast({ type: "user_joined", user: me });

  // Load initial doc
  loadDoc("doc_1");
  renderDocsList();

  // Setup editor events
  const editor = document.getElementById("editor");
  editor.addEventListener("input", onEditorInput);
  editor.addEventListener("keydown", onEditorKeyDown);
  editor.addEventListener("selectionchange", onSelectionChange);
  editor.addEventListener("click", onSelectionChange);
  editor.addEventListener("keyup", onSelectionChange);
  editor.addEventListener("scroll", syncScroll);

  // Track own user
  users[me.id] = me;
  updateUsersUI();
  addActivity("🟢", `${me.name} joined the session`);
  addSystemChat(`${me.name} joined`);

  // Stats update
  setInterval(updateStats, 1000);

  // Periodic heartbeat
  setInterval(() => {
    broadcast({ type: "heartbeat", user: me, docId: currentDoc });
  }, 5000);

  // Request state from peers
  setTimeout(() => {
    broadcast({ type: "request_state", from: me.id });
  }, 200);

  showToast(`Welcome, ${me.name}! 👋`);
}

// ══════════════════════════════════════════════════════════════════════════════
// BROADCAST (simulated WebSocket via BroadcastChannel)
// ══════════════════════════════════════════════════════════════════════════════

function broadcast(msg) {
  if (channel) channel.postMessage({ ...msg, senderId: me.id, ts: Date.now() });
}

function handleBroadcast(event) {
  const msg = event.data;
  if (!msg || msg.senderId === me.id) return;

  switch (msg.type) {
    case "request_state":
      // Send our state to the new joiner
      broadcast({
        type: "state_response",
        to: msg.from,
        docId: currentDoc,
        content: document.getElementById("editor").value,
        docs: docs,
        user: me,
      });
      break;

    case "state_response":
      if (msg.to === me.id) {
        // Merge docs
        Object.assign(docs, msg.docs);
        renderDocsList();
        // Sync current content
        if (msg.docId === currentDoc) {
          const editor = document.getElementById("editor");
          if (editor.value !== msg.content) {
            const sel = editor.selectionStart;
            editor.value = msg.content;
            docs[currentDoc].content = msg.content;
            editor.selectionStart = editor.selectionEnd = Math.min(
              sel,
              msg.content.length,
            );
            updateLineNumbers();
          }
        }
        // Add user
        if (!users[msg.user.id]) {
          users[msg.user.id] = msg.user;
          updateUsersUI();
        }
      }
      break;

    case "user_joined":
      if (!users[msg.user.id]) {
        users[msg.user.id] = msg.user;
        updateUsersUI();
        addActivity("🟢", `${msg.user.name} joined`);
        addSystemChat(`${msg.user.name} joined`);
        showToast(`${msg.user.name} joined the session`);
        // Send our state back
        broadcast({
          type: "state_response",
          to: msg.user.id,
          docId: currentDoc,
          content: document.getElementById("editor").value,
          docs: docs,
          user: me,
        });
      }
      break;

    case "user_left":
      if (users[msg.userId]) {
        const u = users[msg.userId];
        delete users[msg.userId];
        removeCursor(msg.userId);
        updateUsersUI();
        addActivity("🔴", `${u.name} left`);
        addSystemChat(`${u.name} left`);
      }
      break;

    case "heartbeat":
      if (!users[msg.user.id]) {
        users[msg.user.id] = msg.user;
        updateUsersUI();
      }
      break;

    case "doc_edit":
      if (msg.docId === currentDoc) {
        const editor = document.getElementById("editor");
        const myPos = editor.selectionStart;
        editor.value = msg.content;
        docs[currentDoc].content = msg.content;
        editor.selectionStart = editor.selectionEnd = myPos;
        updateLineNumbers();
        setSaveStatus("saved");
      } else {
        if (docs[msg.docId]) docs[msg.docId].content = msg.content;
      }
      addActivity(
        "✏️",
        `${getUserName(msg.userId)} edited "${getDocTitle(msg.docId)}"`,
      );
      break;

    case "cursor_move":
      if (msg.docId === currentDoc) {
        updateRemoteCursor(
          msg.userId,
          msg.x,
          msg.y,
          getUserColor(msg.userId),
          getUserName(msg.userId),
        );
      }
      break;

    case "chat":
      appendChatMessage(msg.user, msg.text, false);
      break;

    case "typing_start":
      showTypingIndicator(msg.user.name);
      break;

    case "typing_stop":
      hideTypingIndicator();
      break;

    case "doc_switch":
      if (!users[msg.userId]) break;
      addActivity(
        "📄",
        `${getUserName(msg.userId)} switched to "${getDocTitle(msg.docId)}"`,
      );
      break;

    case "doc_create":
      docs[msg.doc.id] = msg.doc;
      renderDocsList();
      addActivity(
        "📄",
        `${getUserName(msg.userId)} created "${msg.doc.title}"`,
      );
      break;

    case "doc_title":
      if (docs[msg.docId]) {
        docs[msg.docId].title = msg.title;
        renderDocsList();
        if (msg.docId === currentDoc) {
          document.getElementById("docTitle").value = msg.title;
        }
      }
      break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EDITOR
// ══════════════════════════════════════════════════════════════════════════════

function onEditorInput(e) {
  const editor = document.getElementById("editor");
  const content = editor.value;
  docs[currentDoc].content = content;
  editCount++;

  updateLineNumbers();
  setSaveStatus("saving...");

  // Broadcast to peers
  broadcast({ type: "doc_edit", docId: currentDoc, content, userId: me.id });

  // Debounce save status
  clearTimeout(window.saveTimer);
  window.saveTimer = setTimeout(() => setSaveStatus("saved"), 800);
}

function onEditorKeyDown(e) {
  const editor = document.getElementById("editor");

  // Tab key
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value =
      editor.value.substring(0, start) + "  " + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    onEditorInput();
    return;
  }

  // Auto-close brackets
  const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
  if (pairs[e.key]) {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const sel = editor.value.substring(start, end);
    editor.value =
      editor.value.substring(0, start) +
      e.key +
      sel +
      pairs[e.key] +
      editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 1;
    onEditorInput();
  }
}

function onSelectionChange() {
  const editor = document.getElementById("editor");
  const pos = editor.selectionStart;
  const text = editor.value.substring(0, pos);
  const lines = text.split("\n");
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;
  document.getElementById("statusCursor").textContent =
    `Ln ${line}, Col ${col}`;

  // Broadcast cursor position (approximate visual position)
  const rect = editor.getBoundingClientRect();
  const lineH = 24; // approx line height
  const charW = 8.4; // approx char width at 14px mono
  const x = rect.left + (col - 1) * charW + 20;
  const y = rect.top + (line - 1) * lineH + 16 - editor.scrollTop;

  broadcast({ type: "cursor_move", docId: currentDoc, userId: me.id, x, y });
}

function syncScroll() {
  const editor = document.getElementById("editor");
  const ln = document.getElementById("lineNumbers");
  ln.scrollTop = editor.scrollTop;
}

function updateLineNumbers() {
  const editor = document.getElementById("editor");
  const lines = editor.value.split("\n").length;
  const ln = document.getElementById("lineNumbers");
  let html = "";
  for (let i = 1; i <= lines; i++) html += `<span>${i}</span>`;
  ln.innerHTML = html;
}

function insertText(text) {
  const editor = document.getElementById("editor");
  const start = editor.selectionStart;
  editor.value =
    editor.value.substring(0, start) +
    text +
    editor.value.substring(editor.selectionEnd);
  editor.selectionStart = editor.selectionEnd = start + text.length;
  editor.focus();
  onEditorInput();
}

const snippets = {
  function: `function name(params) {\n  \n}`,
  arrow: `const name = (params) => {\n  \n};`,
  class: `class Name {\n  constructor() {\n    \n  }\n}`,
  async: `async function name() {\n  const result = await fetch('');\n  const data = await result.json();\n  return data;\n}`,
  try: `try {\n  \n} catch (error) {\n  console.error(error);\n}`,
  header1: `# Heading\n`,
  bold: `**bold text**`,
  italic: `_italic text_`,
  code: "`code`",
  link: `[link text](url)`,
};

function insertSnippet(key) {
  insertText(snippets[key] || "");
}

function toggleWrap() {
  lineWrapping = !lineWrapping;
  const editor = document.getElementById("editor");
  editor.style.whiteSpace = lineWrapping ? "pre-wrap" : "pre";
  document.getElementById("wrapBtn").classList.toggle("active", lineWrapping);
}

function changeLanguage() {
  const lang = document.getElementById("langSelect").value;
  docs[currentDoc].lang = lang;
  const names = {
    js: "JavaScript",
    py: "Python",
    ts: "TypeScript",
    html: "HTML",
    css: "CSS",
    json: "JSON",
    md: "Markdown",
    txt: "Plain Text",
  };
  document.getElementById("statusLang").textContent = names[lang] || lang;
}

function setMode(mode) {
  editorMode = mode;
  const editor = document.getElementById("editor");
  document
    .getElementById("modeCode")
    .classList.toggle("active", mode === "code");
  document
    .getElementById("modeNote")
    .classList.toggle("active", mode === "note");
  editor.classList.toggle("note-mode", mode === "note");
  document.getElementById("statusMode").textContent =
    mode === "code" ? "Code Mode" : "Note Mode";
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

function loadDoc(docId) {
  const doc = docs[docId];
  if (!doc) return;
  currentDoc = docId;
  const editor = document.getElementById("editor");
  editor.value = doc.content;
  document.getElementById("docTitle").value = doc.title;
  document.getElementById("langSelect").value = doc.lang || "js";
  changeLanguage();
  updateLineNumbers();
  renderDocsList();

  broadcast({ type: "doc_switch", docId, userId: me.id });
}

function renderDocsList() {
  const list = document.getElementById("docsList");
  list.innerHTML = "";
  const icons = { code: "📄", note: "📝" };
  Object.values(docs).forEach((doc) => {
    const item = document.createElement("div");
    item.className = "doc-item" + (doc.id === currentDoc ? " active" : "");
    item.innerHTML = `
      <span class="doc-icon">${icons[doc.type] || "📄"}</span>
      <span class="doc-name">${doc.title}</span>
      <span class="doc-type">${doc.lang || "txt"}</span>
    `;
    item.onclick = () => loadDoc(doc.id);
    list.appendChild(item);
  });
}

function newDocument() {
  const id = "doc_" + Date.now();
  const doc = {
    id,
    title: "Untitled " + Object.keys(docs).length,
    content: "// Start typing...\n",
    lang: "js",
    type: "code",
  };
  docs[id] = doc;
  broadcast({ type: "doc_create", doc, userId: me.id });
  loadDoc(id);
  renderDocsList();
  document.getElementById("docTitle").focus();
}

// Title sync
document.addEventListener("DOMContentLoaded", () => {}, false);
setTimeout(() => {
  const titleInput = document.getElementById("docTitle");
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      docs[currentDoc].title = titleInput.value;
      broadcast({
        type: "doc_title",
        docId: currentDoc,
        title: titleInput.value,
      });
      renderDocsList();
    });
  }
}, 100);

// ══════════════════════════════════════════════════════════════════════════════
// COLLABORATIVE CURSORS
// ══════════════════════════════════════════════════════════════════════════════

function updateRemoteCursor(userId, x, y, color, name) {
  const overlay = document.getElementById("cursorsOverlay");
  let cursor = document.getElementById("cursor_" + userId);

  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = "cursor_" + userId;
    cursor.className = "remote-cursor";
    cursor.innerHTML = `
      <div style="width:2px;height:20px;background:${color};border-radius:1px;"></div>
      <div class="cursor-label" style="background:${color};">${name}</div>
    `;
    overlay.appendChild(cursor);
  }

  const editorRect = document.getElementById("editor").getBoundingClientRect();
  const relX = x - editorRect.left;
  const relY = y - editorRect.top;

  cursor.style.left = Math.max(0, relX) + "px";
  cursor.style.top = Math.max(0, relY) + "px";
  cursor.style.opacity = "1";

  // Fade out after 3s
  clearTimeout(cursor._fadeTimer);
  cursor._fadeTimer = setTimeout(() => {
    if (cursor) cursor.style.opacity = "0";
  }, 3000);
}

function removeCursor(userId) {
  const cursor = document.getElementById("cursor_" + userId);
  if (cursor) cursor.remove();
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════════════════

function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  } else {
    // Typing indicator
    if (!isTypingInChat) {
      isTypingInChat = true;
      broadcast({ type: "typing_start", user: me });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTypingInChat = false;
      broadcast({ type: "typing_stop", user: me });
    }, 1500);
  }
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  broadcast({ type: "chat", user: me, text });
  appendChatMessage(me, text, true);
  isTypingInChat = false;
  broadcast({ type: "typing_stop", user: me });
}

function appendChatMessage(user, text, isOwn) {
  const msgs = document.getElementById("chatMessages");
  const isMe = user.id === me.id;
  const div = document.createElement("div");
  div.className = "chat-msg" + (isMe ? " own" : "");
  div.innerHTML = `
    <div class="msg-meta">
      <div class="msg-author-dot" style="background:${user.color}"></div>
      <span>${isMe ? "You" : user.name}</span>
      <span>${formatTime(Date.now())}</span>
    </div>
    <div class="msg-bubble">${escapeHtml(text)}</div>
  `;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addSystemChat(text) {
  const msgs = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "system-msg";
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

let typingDisplayTimer;
function showTypingIndicator(name) {
  const el = document.getElementById("typingIndicator");
  el.innerHTML = `<span style="color:var(--text2)">${name} is typing <span class="typing-dots"><span>•</span><span>•</span><span>•</span></span></span>`;
  clearTimeout(typingDisplayTimer);
  typingDisplayTimer = setTimeout(() => (el.innerHTML = ""), 2000);
}
function hideTypingIndicator() {
  document.getElementById("typingIndicator").innerHTML = "";
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY
// ══════════════════════════════════════════════════════════════════════════════

function addActivity(icon, text) {
  const list = document.getElementById("activityList");
  const div = document.createElement("div");
  div.className = "activity-item";
  div.innerHTML = `
    <span class="activity-icon">${icon}</span>
    <span>${escapeHtml(text)}</span>
    <span class="activity-time">${formatTime(Date.now())}</span>
  `;
  list.insertBefore(div, list.firstChild);
  // Keep max 50
  while (list.children.length > 50) list.removeChild(list.lastChild);
}

// ══════════════════════════════════════════════════════════════════════════════
// USERS UI
// ══════════════════════════════════════════════════════════════════════════════

function updateUsersUI() {
  const bar = document.getElementById("usersBar");
  const count = document.getElementById("onlineCount");
  const statOnline = document.getElementById("statOnline");
  const total = Object.keys(users).length;

  bar.innerHTML = "";
  Object.values(users).forEach((u) => {
    const av = document.createElement("div");
    av.className = "user-avatar";
    av.style.background = u.color;
    av.innerHTML = `${u.initials || u.name.slice(0, 2).toUpperCase()}<div class="tooltip">${u.name}</div>`;
    bar.appendChild(av);
  });

  count.textContent = `${total} online`;
  if (statOnline) statOnline.textContent = total;
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════════════════════

function updateStats() {
  const editor = document.getElementById("editor");
  const content = editor.value;
  document.getElementById("statChars").textContent = content.length;
  document.getElementById("statLines").textContent = content.split("\n").length;
  document.getElementById("statWords").textContent = content.trim()
    ? content.trim().split(/\s+/).length
    : 0;
  document.getElementById("statEdits").textContent = editCount;
}

// ══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document
    .getElementById("sidebar")
    .classList.toggle("collapsed", !sidebarOpen);
}

function toggleRightPanel() {
  rightPanelOpen = !rightPanelOpen;
  document
    .getElementById("rightPanel")
    .classList.toggle("collapsed", !rightPanelOpen);
}

function switchTab(name) {
  document
    .querySelectorAll(".panel-section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".panel-tab")
    .forEach((t) => t.classList.remove("active"));
  document.getElementById("section-" + name).classList.add("active");
  event.target.classList.add("active");
}

function setSaveStatus(text) {
  document.getElementById("saveStatusText").textContent = text;
}

function shareDoc() {
  const url = location.href;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      showToast("🔗 Link copied! Open in another tab to collaborate.");
    })
    .catch(() => {
      showToast("Open this page in another tab to collaborate!");
    });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 3000);
}

function getUserName(id) {
  return users[id]?.name || "Someone";
}
function getUserColor(id) {
  return users[id]?.color || "#7c6af7";
}
function getDocTitle(id) {
  return docs[id]?.title || "Unknown";
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatTime(ts) {
  const d = new Date(ts);
  return (
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0")
  );
}

// Cleanup on page close
window.addEventListener("beforeunload", () => {
  if (channel) {
    broadcast({ type: "user_left", userId: me.id });
    channel.close();
  }
});
