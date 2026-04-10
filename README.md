# OmniPro 220 support agent

Next.js app for the Vulcan OmniPro 220 multiprocess welder. You chat in plain language and can attach a photo (panel, weld, error screen). Replies are grounded in the owner manuals under `files/`: the UI shows citations, page excerpts, and rendered page images. When a table, diagram, or small interactive piece helps more than prose, the model wraps that content in `<artifact>` tags and the client renders it as real components.

**Live:** [prox-challenge-ibz-arain.vercel.app](https://prox-challenge-ibz-arain.vercel.app/)

<p align="center">
  <a href="https://www.youtube.com/watch?v=lpVg2lxntsc">
    <img src="https://img.youtube.com/vi/lpVg2lxntsc/maxresdefault.jpg" alt="Walkthrough video" width="720" />
  </a>
</p>

## How the agent works

The browser sends the thread to `POST /api/chat` ([`app/api/chat/route.ts`](app/api/chat/route.ts)). The handler calls `runAgent` in [`lib/agent/index.ts`](lib/agent/index.ts), which talks to the Anthropic Messages API in a loop: the model may request tool calls, the server runs them and appends tool results to the conversation, and this repeats until the model returns final text without new tools.

Tools are defined in [`lib/agent/tools.ts`](lib/agent/tools.ts): search the manuals (including multi-query search), read full page text, fetch page bundles, load page PNGs, pull entries from a diagram catalog, and look up specs. The system prompt in [`lib/agent/system-prompt.ts`](lib/agent/system-prompt.ts) keeps the assistant on welder-related topics, nudges it to retrieve instead of guessing, and describes how to format artifacts. User images ride along in the message so the model can relate a photo to manual content.

Nothing useful is hidden in the stream. Token text goes out over SSE; citations, page images, and parsed artifacts are emitted as their own events so the evidence sidebar and inline widgets stay aligned with what the user is reading. [`components/artifacts/ArtifactRenderer.tsx`](components/artifacts/ArtifactRenderer.tsx) maps artifact types to React (tables, SVG, Mermaid, calculators, constrained HTML, etc.).

## Design decisions

I kept the agent loop in application code rather than leaning on a separate “agent SDK” stack. This is a product surface: I wanted predictable streaming, explicit timeouts (cold starts can spend time building the index), and full control over which structured payloads reach the client. The pattern is still the familiar one—LLM, tools, multi-turn execution—but it lives beside the route that already owns request validation, `maxDuration`, and the SSE stream shape.

Retrieval is split into several tools instead of one retrieval step that dumps a large context block. A manual is navigated in steps: search, open a page, compare another section, fetch an image when the figure matters. That usually spends tokens more deliberately than sending every possibly relevant chunk at once.

Artifacts are a deliberate contract. Procedures and numeric relationships are hard to scan in a wall of markdown. Letting the model emit tagged blocks means the UI can treat them as data and render them consistently, instead of hoping markdown tables and ASCII art survive streaming and mobile layouts.

The evidence panel is not decorative. If the assistant cites a page, you should be able to open the excerpt and the same page render the tools used. That keeps “grounded in the PDF” something you can verify in one place.

## Knowledge extraction and representation

Ingestion is [`scripts/ingest.ts`](scripts/ingest.ts) plus [`lib/ingest/`](lib/ingest/). PDFs in `files/` are parsed with pdf.js. When a page has almost no extractable text (common for diagram-heavy spreads), a vision pass asks Claude for structured text so search and snippets still have something to index.

Each page carries light metadata (for example section hints and content type). Search is backed by MiniSearch; the built index and `pages.json` live under `generated/` (gitignored). Page renders for evidence are written to `public/manual-pages/` and `generated/page-images/` as part of that pipeline.

At query time, [`lib/retrieval/search.ts`](lib/retrieval/search.ts) can build the index on the first search if nothing exists yet, so a fresh clone runs after `npm install` without a mandatory ingest step. Running `npm run ingest` beforehand avoids a long first message when you would rather pay that cost up front.

To the model, knowledge is not “in the weights.” It arrives as tool output: search hits pointing at pages, full page text as JSON, paths to PNGs it can request, and a small curated diagram catalog. There is no separate vector database; retrieval is keyword search over indexed page records plus explicit fetches.

## Run it

```bash
git clone https://github.com/ibz-arain/prox-challenge.git
cd prox-challenge
cp .env.example .env
```

Add `ANTHROPIC_API_KEY` to `.env` (from [Anthropic Console](https://console.anthropic.com/)), then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The chat model is `claude-sonnet-4-20250514`.