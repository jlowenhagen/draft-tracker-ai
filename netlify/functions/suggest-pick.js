/**
 * suggest-pick.js
 * ----------------
 * This is a SERVERLESS FUNCTION. Think of it as a tiny, single-purpose
 * backend that Netlify runs on-demand — it doesn't run all the time like
 * a traditional server; it wakes up when called, does its job, and shuts
 * back down. You don't manage a server at all, which is why this pattern
 * is popular for small apps like this one.
 *
 * WHY THIS FILE EXISTS AT ALL:
 * Your browser (the index.html file) is public — anyone can open dev tools
 * and read every line of JavaScript running on the page, including any
 * secret you hardcoded in it. Your Anthropic API key is basically a
 * password that lets someone spend YOUR money on API calls. So the key
 * can never live in index.html.
 *
 * Instead: the browser calls THIS function (which lives on Netlify's
 * servers, not the user's browser), and only this function — running in a
 * private server environment — holds the real API key, pulled from an
 * environment variable. The browser never sees it.
 *
 * FLOW:
 *   Browser (index.html)
 *      --> POST /.netlify/functions/suggest-pick   (draft context, no key)
 *   This function
 *      --> reads ANTHROPIC_API_KEY from env (set in Netlify dashboard)
 *      --> calls api.anthropic.com with the key attached
 *      --> gets Claude's answer back
 *      --> forwards just the TEXT to the browser (still no key)
 */

exports.handler = async function (event) {
  // Serverless functions receive raw HTTP requests. We only support POST —
  // reject anything else early. This is a common defensive pattern.
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // event.body arrives as a raw JSON string — we parse it into a real object.
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { available, yourRoster, pickIndex, round } = payload;

  // process.env.ANTHROPIC_API_KEY is set in the Netlify dashboard
  // (Site settings -> Environment variables), NOT in this file and NOT
  // committed to git. That's what keeps it secret. See README for setup.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. See README setup step." }),
    };
  }

  // Build a compact, readable prompt from the draft state the browser sent.
  const availableList = (available || [])
    .slice(0, 40)
    .map((p) => `${p.rank}. ${p.name} (${p.pos}, ${p.team})`)
    .join("; ");

  const rosterList = (yourRoster || [])
    .map((p) => `${p.name} (${p.pos})`)
    .join(", ") || "no players drafted yet";

  const prompt = `You are a concise fantasy football draft assistant for a 12-team,
full PPR league that awards 6 points for every touchdown. I draft from the
11th overall slot in a snake draft.

It is round ${round}, overall pick ${Number(pickIndex) + 1}.

My roster so far: ${rosterList}.

Top available players by ADP: ${availableList}.

In 2-3 sentences, recommend the single best pick right now and briefly say
why, weighing both player value and my roster's positional needs. Be direct.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: errText }) };
    }

    const data = await response.json();

    // Claude's response comes back as an array of "content blocks" — usually
    // just one text block, but the API supports multiple, so we join them.
    const text = (data.content || [])
      .map((block) => block.text || "")
      .join("\n")
      .trim();

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text || "No response generated." }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
