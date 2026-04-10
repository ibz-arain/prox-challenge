import { DIAGRAM_CATALOG } from "./diagrams/catalog";
import type { Artifact } from "./types";

const TITLES: Record<string, string> = {
  polarity_mig: "MIG polarity (DCEP) — torch & work lead",
  polarity_fcaw: "Flux-cored polarity (DCEN) — torch & work lead",
  polarity_tig: "TIG polarity (DCEN) — torch & work lead",
  polarity_stick: "Stick welding — electrode & work lead",
  front_panel: "Front panel — sockets & controls",
  wire_path: "Wire feed path — drive to gun",
};

function haystack(userMessage: string, assistantText: string): string {
  return `${userMessage}\n${assistantText}`.toLowerCase();
}

/**
 * When the model forgets to emit svg-diagram artifacts, infer which canonical
 * diagram matches polarity / socket / lead questions so the UI still shows a diagram.
 */
export function inferPolarityDiagramId(
  userMessage: string,
  assistantText: string
): keyof typeof DIAGRAM_CATALOG | null {
  const h = haystack(userMessage, assistantText);
  const u = userMessage.toLowerCase();
  const a = assistantText.toLowerCase();

  const wantsConnection =
    /polarity|socket|sockets|clamp|ground|work\s*lead|torch\s*lead|electrode|dcen|dcep/.test(h);
  const wantsWirePath = /wire\s+path|thread(ing)?\s+wire|drive\s+roll|liner|birdnest/.test(h);
  const wantsPanelLayout =
    /front\s+panel\s+layout|knob|dial|menu\s+button|where\s+is\s+the\s+lcd/i.test(h) &&
    !/ground\s+clamp|torch\s+lead|polarity|dcen|dcep/.test(h);

  if (wantsWirePath && !wantsConnection) {
    return "wire_path";
  }
  if (wantsPanelLayout) {
    return "front_panel";
  }

  const processes: { id: keyof typeof DIAGRAM_CATALOG; re: RegExp }[] = [
    { id: "polarity_tig", re: /\btig\b|tungsten|lift\s+tig/ },
    { id: "polarity_mig", re: /\bmig\b|gmaw|metal\s*inert|short[\s-]?circuit/ },
    {
      id: "polarity_fcaw",
      re: /\bfcaw\b|flux[\s-]?core|flux\s*cored|self[\s-]?shielded/,
    },
    { id: "polarity_stick", re: /\bstick\b|smaw|electrode\s+holder/ },
  ];

  let best: keyof typeof DIAGRAM_CATALOG | null = null;
  for (const { id, re } of processes) {
    if (re.test(u) || re.test(a)) {
      best = id;
      break;
    }
  }

  if (!best) {
    if (/\btig\b|tungsten/.test(h)) best = "polarity_tig";
    else if (/\bmig\b|gmaw/.test(h)) best = "polarity_mig";
    else if (/flux|fcaw/.test(h)) best = "polarity_fcaw";
    else if (/\bstick\b|smaw/.test(h)) best = "polarity_stick";
  }

  if (best && wantsConnection) {
    return best;
  }

  if (best && /polarity|dcen|dcep|torch|clamp|ground|socket/.test(h)) {
    return best;
  }

  if (!wantsConnection && !/polarity|dcen|dcep/.test(h)) {
    return null;
  }

  return best;
}

/**
 * Prepend a canonical svg-diagram when the model emitted **no** artifacts but the
 * question clearly matches polarity / leads / sockets (common model omission).
 */
export function injectCanonicalDiagramIfMissing(
  artifacts: Artifact[],
  userMessage: string,
  assistantText: string
): { artifacts: Artifact[]; injectedId: string | null } {
  if (artifacts.length > 0) {
    return { artifacts, injectedId: null };
  }

  const id = inferPolarityDiagramId(userMessage, assistantText);
  if (!id || !DIAGRAM_CATALOG[id]) {
    return { artifacts, injectedId: null };
  }

  const title = TITLES[id] ?? `Diagram — ${id}`;
  const diagram: Artifact = {
    type: "svg-diagram",
    title,
    content: DIAGRAM_CATALOG[id],
  };

  return { artifacts: [diagram, ...artifacts], injectedId: id };
}

/** Porosity, defects, “what should I check” — not covered by polarity diagram inference. */
const TROUBLESHOOTING_INTENT =
  /porosity|spatter|undercut|incomplete fusion|cold lap|slag inclusion|crater|defect|weld quality|erratic arc|bird[\s-]?nest|feed (problem|issue|failure)|burn[\s-]?through|troubleshoot|what should i check|why (is|are|do|does) my|wrong with (my|the)|having trouble|getting bad|poor (weld|bead|fusion)/i;

function inferTroubleshootingIntent(
  userMessage: string,
  assistantText: string
): boolean {
  const h = haystack(userMessage, assistantText);
  return TROUBLESHOOTING_INTENT.test(h);
}

const GENERIC_TROUBLESHOOTING_MERMAID = `flowchart TD
  A[Confirm process and mode match the job] --> B[Compare polarity and settings to the manual]
  B --> C[Clean joint and base metal]
  C --> D[Check wire path: spool, drive rolls, liner]
  D --> E[Inspect contact tip and nozzle]
  E --> F[Verify gas type and flow if the process uses gas]
  F --> G[Still an issue: re-read the manual troubleshooting table for your symptom]`;

/**
 * When the model returns prose-only for a defect/troubleshooting-style question,
 * inject a generic decision-style mermaid chart (checklist order — not a substitute for the manual).
 */
export function injectTroubleshootingMermaidIfMissing(
  artifacts: Artifact[],
  userMessage: string,
  assistantText: string
): { artifacts: Artifact[]; injected: boolean } {
  if (artifacts.length > 0) {
    return { artifacts, injected: false };
  }
  if (!inferTroubleshootingIntent(userMessage, assistantText)) {
    return { artifacts, injected: false };
  }

  const diagram: Artifact = {
    type: "mermaid",
    title: "What to check first (troubleshooting order)",
    content: GENERIC_TROUBLESHOOTING_MERMAID,
  };

  return { artifacts: [diagram], injected: true };
}
