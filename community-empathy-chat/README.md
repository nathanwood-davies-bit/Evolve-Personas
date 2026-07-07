# Community Case Files — Empathy Chat

A design-thinking classroom tool. Students click a "case file" for a persona connected to a
community issue (isolation, migration, disability, poverty, small business decline, young carers)
and interview that persona in a chat, in first person, to build empathy before they define a
problem to solve.

## How it works

```
Student's browser  --->  Your server (Node/Express)  --->  Anthropic API
   (public/)                  (server/)
```

The browser never talks to Anthropic directly. Your server holds the API key and the persona
"system prompts" (the hidden instructions that shape each character) — students only ever see the
public name, age, role and a short blurb. This also stops students from opening dev tools and
rewriting a persona's instructions.

## 1. Get an API key

Create one at [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys.
Treat it like a password: never put it in the frontend code or commit it to a public repo.

## 2. Run it locally (to test before deploying)

Requires [Node.js](https://nodejs.org) 18 or later.

```bash
cd server
npm install
cp .env.example .env        # then edit .env and paste in your real API key
node -r dotenv/config index.js   # or: npm install dotenv, then npm start
```

Simplest local option without dotenv — just set the variable directly:

```bash
cd server
npm install
ANTHROPIC_API_KEY=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 start
```

Then open **http://localhost:3000** in a browser.

## 3. Deploy so students can access it

Any host that runs a small Node.js app works. A few beginner-friendly options:

- **Render.com** or **Railway.app** — connect a GitHub repo, set `ANTHROPIC_API_KEY` as an
  environment variable in their dashboard, done. Free tiers exist but may sleep between uses.
- **Your school's own server / IT department** — if your school already hosts a Node-capable
  server or LMS with app hosting, hand them this folder and the environment variable requirement.
- **A school Chromebook-friendly LMS embed** — once deployed to a URL, most LMS tools (Canvas,
  Google Classroom, etc.) can embed the URL in an iframe or just link to it.

Whichever host you choose, the only things it needs to know are:
1. Run `npm install` then `npm start` inside `server/`
2. Set the `ANTHROPIC_API_KEY` environment variable
3. The app listens on `process.env.PORT` (most hosts set this automatically)

## 4. Editing or adding personas

Open `server/personas.js`. Each persona is one object in the `personas` array with:
- `name`, `age`, `role`, `colour` (hex, used for the case-file card), `blurb` (shown to students)
- `systemPrompt` — the actual character instructions. Copy an existing one as a template; keep
  the `${STYLE_RULES}` and `${SAFETY_RULES}` lines at the end of every persona so the built-in
  age-appropriateness and de-escalation rules still apply.

No frontend changes are needed — new personas automatically appear on the corkboard.

## 5. Before using with students

- **Read through each persona's system prompt yourself first**, and consider having students
  debrief afterward on what felt authentic vs. stereotyped — that discussion is itself valuable
  design-thinking work.
- **Test a few conversations yourself**, including trying to derail it, before your first class.
- **Check your school/district's policy on AI tools and student data.** This app doesn't store
  chat transcripts anywhere by default, but the messages do pass through Anthropic's API — review
  [Anthropic's terms](https://www.anthropic.com/legal/commercial-terms) and your local policy
  before deploying with minors, and avoid having students share personal identifying information
  in the chat.
- Consider a short framing intro for students: these are realistic composites, not real
  individuals — useful for building empathy skills, not a substitute for talking to real people
  in your actual community.

## Project structure

```
community-empathy-chat/
├── server/
│   ├── index.js        # Express server + /api/chat, /api/personas
│   ├── personas.js      # Edit this to change personas
│   ├── package.json
│   └── .env.example
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```
