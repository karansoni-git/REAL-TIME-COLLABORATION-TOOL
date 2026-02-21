# REAL-TIME-COLLABORATION-TOOL

### COMPANY: CODTECH IT SOLUTIONS
### NAME: KARAN PAREKH
### INTERN ID: CTIS1913
### DOMAIN: SOFTWARE DEVELOPMENT
### DURATION: 6 WEEEKS
### MENTOR: MUZAMMIL AHMED

DESCRIPTION :

CollabPad is a browser-based, multi-user collaborative editing platform that enables developers and teams to write code and take notes together in real time — no backend server required. Inspired by tools like Google Docs, it brings live collaboration directly into a single, self-contained HTML file powered by the **BroadcastChannel API**, a WebSocket-equivalent for same-origin tab communication.

---

## What It Does

CollabPad allows multiple users to open the same document simultaneously and see each other's changes, cursor positions, and chat messages as they happen — with zero latency and zero setup. It's split into two primary modes:

- **Code Mode** — A developer-focused editor with line numbers, auto-closing brackets, tab indentation, language selection (JavaScript, Python, TypeScript, HTML, CSS, JSON, Markdown), and code snippets for common patterns like functions, classes, async/await, and try/catch blocks.
- **Notes Mode** — A clean prose editor optimized for Markdown-style writing, meeting notes, and project documentation.

---

## Key Features

**Real-Time Collaboration**
Every keystroke is broadcast instantly to all connected tabs. Remote user cursors appear as color-coded labels floating over the editor, updating live as collaborators type and scroll.

**Presence & Identity**
On joining, users pick a name and a color. Their avatar appears in the header alongside all other online users. Join and leave events are announced in both the chat and activity feed.

**Live Chat & Activity Feed**
A right-side panel provides a persistent team chat with typing indicators, timestamps, and system messages. The Activity tab logs every edit, document switch, and user event in chronological order.

**Multi-Document Workspace**
Users can create, switch between, and rename multiple documents. All document state — content, title, language — syncs across every connected tab in real time.

**Smart Editor Utilities**
The toolbar provides one-click snippet insertion, word wrap toggling, and a language selector that updates the status bar. A Stats panel tracks live character count, line count, word count, and total session edits.

---

## Technology

CollabPad is built entirely with **vanilla HTML, CSS, and JavaScript** — no frameworks, no servers, no dependencies. Real-time sync is handled by the **BroadcastChannel API**, with a clean message protocol supporting edits, cursor moves, chat, presence, and document management. The dark-themed UI uses JetBrains Mono and Syne typefaces for a refined, professional aesthetic.

> **To collaborate:** Open the file in two or more browser tabs and start typing.

OUTPUT : ![img](https://github.com/user-attachments/assets/a9544582-9454-4b7c-b9be-cdb8a85f7ef1)
