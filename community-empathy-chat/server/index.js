// index.js — minimal backend for the Community Empathy Chat tool.
//
// Responsibilities:
//  1. Serve the static frontend (public/).
//  2. Provide GET /api/personas — the public-safe persona list (no system prompts).
//  3. Provide POST /api/chat — takes { personaId, messages }, adds the hidden
//     system prompt server-side, calls the Anthropic API, returns the reply.
//
// Setup:
//   cd server && npm install
//   set the ANTHROPIC_API_KEY environment variable (see .env.example)
//   npm start
//   visit http://localhost:3000

const express = require("express");
const path = require("path");
const { personas } = require("./personas");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";
const MAX_TURNS = 24; // safety cap: student + persona messages combined, per session

if (!API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not set. Set it as an environment variable before deploying.\n" +
      "e.g. on Mac/Linux:  export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "     on Windows:    set ANTHROPIC_API_KEY=sk-ant-...\n" +
      "     or use a .env file with a tool like dotenv."
  );
}

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Public list — only what the frontend needs to render persona cards.
// Never sends systemPrompt to the browser.
app.get("/api/personas", (req, res) => {
  const publicPersonas = personas.map(({ id, name, age, role, colour, blurb }) => ({
    id,
    name,
    age,
    role,
    colour,
    blurb,
  }));
  res.json(publicPersonas);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { personaId, messages } = req.body || {};

    const persona = personas.find((p) => p.id === personaId);
    if (!persona) {
      return res.status(400).json({ error: "Unknown persona." });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages must be a non-empty array." });
    }
    if (messages.length > MAX_TURNS) {
      return res.status(400).json({
        error: "This conversation has reached its message limit. Please start a new chat.",
      });
    }
    // Basic shape validation — only allow role/content strings through.
    const cleanMessages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (!API_KEY) {
      return res.status(500).json({ error: "Server is missing its Anthropic API key." });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: persona.systemPrompt,
        messages: cleanMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ error: "The AI service returned an error. Please try again." });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const reply = textBlock ? textBlock.text : "Sorry, I didn't catch that — could you ask again?";

    res.json({ reply });
  } catch (err) {
    console.error("Unexpected /api/chat error:", err);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

app.listen(PORT, () => {
  console.log(`Community Empathy Chat running at http://localhost:${PORT}`);
});
