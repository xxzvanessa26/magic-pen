const { getDb } = require("./_lib/db.js");

const CHAT_MODEL = "claude-haiku-4-5-20251001";
const MAX_MESSAGE_LEN = 500;
const HISTORY_LIMIT = 6;
const RATE_LIMIT_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_PROMPT =
  "You are the friendly help assistant built into Magic Pen, a simple, kid-friendly " +
  "website where elementary school kids write and illustrate their own storybooks. " +
  "You answer visitor questions about how to use the site.\n\n" +
  "What Magic Pen does:\n" +
  "- Kids write a story across several pages, with a cover page (title + author name).\n" +
  "- Each page can have a picture: upload your own photo, or pick a fun scene emoji " +
  "(grouped into Sky & Space, Places, Creatures, Fun & Magic). Pictures can be zoomed " +
  "in/out (Picture Size controls) and repositioned by dragging.\n" +
  "- Stickers: a searchable sticker library (try words like \"butterfly\" or \"beach\"), " +
  "including hand-drawn bunny stickers, plus a \"draw your own sticker\" tool if nothing " +
  "matches what you're looking for.\n" +
  "- You can pick the page's paper color, and the story text's size and color.\n" +
  "- There's an Undo button for mistakes, and a Preview mode to flip through the whole " +
  "book page by page before printing.\n" +
  "- When a book is finished: \"Export PDF\" makes a downloadable PDF, or \"Print Book\" " +
  "opens the browser's print dialog. The recommended way to get a real paper book is to " +
  "save it as a PDF and upload it to CVS Photo's Document Printing service.\n" +
  "- Saving works with no account at all — books save automatically in the browser, and " +
  "there's a \"Sync Code\" button to restore your books on another device without signing " +
  "up. There's also an optional free account (just an email + password) so a family can " +
  "log in on any device and see the same books.\n" +
  "- It's designed for elementary school kids, simple enough to use without help, though " +
  "parents often help with printing.\n\n" +
  "Answer warmly and briefly — 2 to 4 short sentences, plain language a parent or a kid " +
  "could follow. If asked something unrelated to Magic Pen, or anything inappropriate for " +
  "a kids' site, politely steer the conversation back to what Magic Pen can help with. " +
  "Never invent features that aren't listed above.";

async function checkRateLimit(db, ip) {
  const col = db.collection("chatLimits");
  const now = Date.now();
  const rec = await col.findOne({ _id: ip });
  if (rec && now - rec.windowStart < RATE_WINDOW_MS) {
    if (rec.count >= RATE_LIMIT_PER_HOUR) return false;
    await col.updateOne({ _id: ip }, { $inc: { count: 1 } });
    return true;
  }
  await col.updateOne({ _id: ip }, { $set: { windowStart: now, count: 1 } }, { upsert: true });
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "unavailable", message: "The chat assistant isn't configured right now." });
    }

    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return res.status(400).json({ error: "empty_message", message: "Please type a question first." });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ error: "too_long", message: "That question is a bit long — could you ask in fewer words?" });
    }

    const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || "unknown").trim() || "unknown";
    const db = await getDb();
    const allowed = await checkRateLimit(db, ip);
    if (!allowed) {
      return res.status(429).json({ error: "rate_limited", message: "You've asked a lot of questions! Please try again in a little while." });
    }

    const trimmedHistory = history.slice(-HISTORY_LIMIT).map(function (m) {
      return {
        role: m && m.role === "assistant" ? "assistant" : "user",
        content: String((m && m.content) || "").slice(0, MAX_MESSAGE_LEN)
      };
    });
    const messages = trimmedHistory.concat([{ role: "user", content: message }]);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: messages
      })
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("[/api/chat] upstream error", upstream.status, errText);
      return res.status(502).json({ error: "upstream_error", message: "The assistant is having trouble right now — please try again in a moment." });
    }

    const data = await upstream.json();
    const reply =
      (data.content && data.content[0] && data.content[0].text) ||
      "Sorry, I didn't quite catch that — could you try asking again?";

    return res.status(200).json({ reply: reply });
  } catch (e) {
    console.error("[/api/chat]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
