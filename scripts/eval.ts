import { runAgent } from "../lib/agent";
import { searchManual } from "../lib/retrieval/search";
import type { Artifact, Citation, PageImage } from "../lib/types";

interface TestCase {
  prompt: string;
  expectedKeywords: string[];
  expectedSections?: string[];
  description: string;
  needsVisual?: boolean;
  expectedArtifactTypes?: Artifact["type"][];
  maxWords?: number;
}

const TEST_CASES: TestCase[] = [
  {
    prompt: "duty cycle MIG 200A 240V",
    expectedKeywords: ["duty cycle", "200", "240"],
    expectedSections: ["specs"],
    description: "Should find duty cycle specs for MIG at 200A on 240V",
    expectedArtifactTypes: [
      "table",
      "calculator",
      "settings-card",
      "artifact-html",
      "step-list",
    ],
    maxWords: 120,
  },
  {
    prompt: "porosity flux-cored welds troubleshooting",
    expectedKeywords: ["porosity", "flux"],
    expectedSections: ["troubleshooting"],
    description: "Should find troubleshooting for porosity in flux-cored welds",
    expectedArtifactTypes: [
      "flowchart",
      "table",
      "artifact-html",
      "step-list",
      "svg-diagram",
    ],
    maxWords: 140,
  },
  {
    prompt: "TIG welding polarity DCEN DCEP",
    expectedKeywords: ["polarity", "TIG"],
    expectedSections: ["polarity", "welding-process"],
    description: "Should find TIG polarity setup information",
    needsVisual: true,
    expectedArtifactTypes: [
      "svg-diagram",
      "mermaid",
      "artifact-html",
      "table",
      "flowchart",
      "settings-card",
      "step-list",
    ],
    maxWords: 130,
  },
  {
    prompt: "ground clamp socket connection",
    expectedKeywords: ["ground", "clamp"],
    description: "Should find ground clamp connection instructions",
    needsVisual: true,
    expectedArtifactTypes: [
      "svg-diagram",
      "mermaid",
      "flowchart",
      "artifact-html",
      "table",
      "step-list",
    ],
    maxWords: 120,
  },
  {
    prompt: "wire feed speed tension adjustment",
    expectedKeywords: ["wire", "feed", "tension"],
    description: "Should find wire feed mechanism setup",
  },
  {
    prompt: "120V 240V input voltage difference",
    expectedKeywords: ["120", "240", "voltage"],
    description: "Should find information about input voltage options",
  },
  {
    prompt: "weld diagnosis bead appearance",
    expectedKeywords: ["weld", "diagnosis"],
    description: "Should find weld diagnosis/bead appearance info",
  },
  {
    prompt: "gas regulator flow rate setup",
    expectedKeywords: ["gas", "flow"],
    description: "Should find gas setup information",
  },
];

function wordCount(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasInlineCitation(text: string) {
  return /\bpage\s*\d+\b/i.test(text) || /\bp\.\s*\d+\b/i.test(text);
}

function hasMatchingArtifact(
  artifacts: Artifact[],
  expectedTypes: Artifact["type"][] | undefined
) {
  if (!expectedTypes || expectedTypes.length === 0) return true;
  return artifacts.some((artifact) => expectedTypes.includes(artifact.type));
}

const VISUAL_ARTIFACT_TYPES: Artifact["type"][] = [
  "svg-diagram",
  "mermaid",
  "flowchart",
  "artifact-html",
];

function hasVisualEvidence(pageImages: PageImage[], artifacts: Artifact[], needsVisual?: boolean) {
  if (!needsVisual) return true;
  return (
    pageImages.length > 0 ||
    artifacts.some((artifact) => VISUAL_ARTIFACT_TYPES.includes(artifact.type))
  );
}

async function runAgentEval(prompt: string) {
  const citations: Citation[] = [];
  const artifacts: Artifact[] = [];
  const pageImages: PageImage[] = [];
  const result = await runAgent([{ role: "user", content: prompt }], {
    onCitation: async (citation) => {
      citations.push(citation);
    },
    onArtifact: async (artifact) => {
      artifacts.push(artifact);
    },
    onPageImage: async (pageImage) => {
      pageImages.push(pageImage);
    },
  });

  return { result, citations, artifacts, pageImages };
}

function hasAgentKeyConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

async function runEval() {
  console.log("=== OmniPro 220 Retrieval Evaluation ===\n");

  let retrievalPassed = 0;
  let responsePassed = 0;
  const total = TEST_CASES.length;
  const runAgentChecks = hasAgentKeyConfigured();

  if (!runAgentChecks) {
    console.log("Agent response checks skipped: no LLM API key configured in this shell.\n");
  }

  for (const tc of TEST_CASES) {
    console.log(`--- ${tc.description} ---`);
    console.log(`Query: "${tc.prompt}"`);

    const results = await searchManual(tc.prompt, { topK: 3 });

    if (results.length === 0) {
      console.log("  FAIL: No results found\n");
      continue;
    }

    const allText = results.map((r) => r.text.toLowerCase()).join(" ");
    const foundKeywords = tc.expectedKeywords.filter((kw) =>
      allText.includes(kw.toLowerCase())
    );
    const keywordScore = foundKeywords.length / tc.expectedKeywords.length;

    let sectionMatch = true;
    if (tc.expectedSections) {
      const resultSections = results.map((r) => r.section);
      sectionMatch = tc.expectedSections.some((s) =>
        resultSections.includes(s)
      );
    }

    const retrievalPass = keywordScore >= 0.5 && sectionMatch;
    if (retrievalPass) retrievalPassed++;

    console.log(`  Results: ${results.length} pages found`);
    results.forEach((r, i) => {
      console.log(
        `    ${i + 1}. [${r.sourceLabel} p.${r.pageNumber}] score=${r.score.toFixed(1)} section=${r.section}`
      );
      console.log(`       "${r.excerpt.slice(0, 100)}..."`);
    });
    console.log(
      `  Keywords: ${foundKeywords.length}/${tc.expectedKeywords.length} (${(keywordScore * 100).toFixed(0)}%)`
    );
    console.log(`  Section match: ${sectionMatch}`);

    console.log(`  Retrieval: ${retrievalPass ? "PASS" : "FAIL"}`);

    if (runAgentChecks) {
      const { result, citations, artifacts, pageImages } = await runAgentEval(tc.prompt);
      const responseWords = wordCount(result.text);
      const conciseEnough = tc.maxWords ? responseWords <= tc.maxWords : true;
      const inlineCitations = hasInlineCitation(result.text);
      const visualOk = hasVisualEvidence(pageImages, artifacts, tc.needsVisual);
      const artifactOk = hasMatchingArtifact(artifacts, tc.expectedArtifactTypes);
      const hasAnyArtifact = artifacts.length >= 1;
      const responsePass =
        retrievalPass &&
        citations.length > 0 &&
        inlineCitations &&
        conciseEnough &&
        visualOk &&
        artifactOk &&
        hasAnyArtifact;
      if (responsePass) responsePassed++;

      console.log(
        `  Response words: ${responseWords}${tc.maxWords ? ` / ${tc.maxWords} max` : ""}`
      );
      console.log(`  Citations emitted: ${citations.length}`);
      console.log(`  Inline citation style: ${inlineCitations}`);
      console.log(
        `  Artifacts: ${artifacts.map((artifact) => artifact.type).join(", ") || "none"}`
      );
      console.log(`  Page images: ${pageImages.length}`);
      console.log(`  Visual requirement met: ${visualOk}`);
      console.log(`  Response check: ${responsePass ? "PASS" : "FAIL"}\n`);
    } else {
      console.log("  Response check: SKIPPED\n");
    }
  }

  console.log(`\n=== Retrieval Results: ${retrievalPassed}/${total} passed ===`);
  if (runAgentChecks) {
    console.log(`=== Response Results: ${responsePassed}/${total} passed ===`);
  }
}

runEval().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
