# Clam Bump Jr Draft Tracker

A click-to-pick fantasy football draft board for a 12-team full-PPR league,
with a second panel that calls Claude (Anthropic's AI) for live pick
recommendations based on your actual roster and the players still on the
board.

Built as a learning project to understand how a real frontend + backend +
third-party API fit together — not just a script.

---

## What it does

- Click a player to mark them drafted (no typing during a live draft)
- Tracks a 12-team snake draft order and flags your upcoming picks
- A local, instant "Suggested for you" panel using a simple scoring formula
- An "Ask Claude" panel that sends your draft state to a real AI model and
  gets back a genuine recommendation, not a canned formula
- Saves your progress in the browser (`localStorage`) so a refresh mid-draft
  doesn't lose anything

---

## The architecture — and why it's built this way

This app has **two halves** that talk to each other over the network, even
though they're deployed together:

```
Your phone/browser                Netlify's servers
┌─────────────────┐               ┌──────────────────────────┐
│   index.html     │   POST      │  netlify/functions/       │
│  (frontend)      │ ──────────► │  suggest-pick.js          │
│                   │             │  (backend, holds API key) │
│                   │ ◄────────── │                            │
└─────────────────┘   JSON reply  │  calls api.anthropic.com  │
                                    └──────────────────────────┘
```

**The core lesson here is: never put a secret in code that runs in the
browser.** `index.html` is public — anyone can open Safari/Chrome dev tools
and read every line of JavaScript on the page. If your Anthropic API key
were sitting in that file, anyone who viewed the page source could copy it
and rack up charges on your account.

So the API key lives only on the server side, as an **environment
variable** — a value injected into the program at run time instead of
written directly in the code. `netlify/functions/suggest-pick.js` is the
only piece of code that ever touches it, and that file never gets sent to
the browser — only its *output* (the function runs on Netlify's servers,
not the user's device).

This pattern — a small backend function whose only job is to safely make
one API call — is called a **serverless function**. "Serverless" doesn't
mean there's no server; it means you don't manage one yourself. Netlify
spins your function up on demand, runs it, and shuts it down. You just
write the one function.

---

## Concept glossary (the stuff worth actually understanding)

| Term | What it means here |
|---|---|
| **Frontend** | Code that runs in the user's browser — `index.html` and its `<script>`. Anyone can read it. |
| **Backend** | Code that runs on a server you don't hand to the user — `suggest-pick.js`. Secrets are safe here. |
| **API** | A defined way for two programs to talk. We use two: Netlify's own function endpoint, and Anthropic's `/v1/messages` endpoint. |
| **Environment variable** | A secret or config value set outside the code (in the Netlify dashboard, or a local `.env` file) and read at run time via `process.env.X`. Never hardcoded, never committed. |
| **`fetch()`** | The browser/Node built-in for making HTTP requests. Used on both sides: the frontend fetches your function, and your function fetches Anthropic. |
| **`async` / `await`** | JavaScript's way of saying "wait for this network call to finish, without freezing the whole page while you wait." |
| **JSON** | The plain-text format both requests and responses use to pass structured data (`{"name": "...", "pos": "..."}`) between frontend, backend, and Anthropic. |
| **`.gitignore`** | Tells git which files to never track — critically, your real `.env` file with the live key. |

---

## Running it yourself

### 1. Install the Netlify CLI (one-time)
```bash
npm install -g netlify-cli
```

### 2. Add your real API key locally
Copy `.env.example` to a new file named `.env` in the same folder, and paste
in a real key from https://console.anthropic.com. This file is already in
`.gitignore` — it will never be committed.

### 3. Run everything locally
```bash
netlify dev
```
This starts both the static site *and* the serverless function on your
machine, and automatically loads your `.env` file. Open the local URL it
prints (usually `http://localhost:8888`) and try the "Ask Claude" button —
it's hitting the real function on your machine, calling the real API.

### 4. Deploy for real
1. Push this folder to a new GitHub repository.
2. Log into [netlify.com](https://netlify.com) → **Add new site → Import an
   existing project** → connect the GitHub repo.
3. In **Site settings → Environment variables**, add `ANTHROPIC_API_KEY`
   with your real key. This is the production equivalent of your local
   `.env` file — Netlify injects it at run time, it's never in the repo.
4. Deploy. Netlify builds the static site and the function together.
5. On your iPhone: open the live URL in Safari → Share → **Add to Home
   Screen** for the app-like experience.

---

## Why this is a decent portfolio piece

It touches the things that separate "I followed a tutorial" from "I can
build a small product":

- A real frontend/backend split, not everything crammed into one file
- Secrets handled correctly (this is the exact mistake a lot of beginner
  projects get wrong)
- A genuine third-party API integration with error handling
- State persistence, and a UI built around a real use case (a live draft),
  not a toy example

Feel free to fork this, swap in a different model, or extend the prompt in
`suggest-pick.js` with more context (bye weeks, your league's exact scoring
rules, etc.) as a next step.
