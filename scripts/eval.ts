import { searchManual } from "../lib/retrieval/search";

interface TestCase {
  prompt: string;
  expectedKeywords: string[];
  expectedSections?: string[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    prompt: "duty cycle MIG 200A 240V",
    expectedKeywords: ["duty cycle", "200", "240"],
    expectedSections: ["specs"],
    description: "Should find duty cycle specs for MIG at 200A on 240V",
  },
  {
    prompt: "porosity flux-cored welds troubleshooting",
    expectedKeywords: ["porosity", "flux"],
    expectedSections: ["troubleshooting"],
    description: "Should find troubleshooting for porosity in flux-cored welds",
  },
  {
    prompt: "TIG welding polarity DCEN DCEP",
    expectedKeywords: ["polarity", "TIG"],
    expectedSections: ["polarity", "welding-process"],
    description: "Should find TIG polarity setup information",
  },
  {
    prompt: "ground clamp socket connection",
    expectedKeywords: ["ground", "clamp"],
    description: "Should find ground clamp connection instructions",
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

async function runEval() {
  console.log("=== OmniPro 220 Retrieval Evaluation ===\n");

  let passed = 0;
  let total = TEST_CASES.length;

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

    const pass = keywordScore >= 0.5 && sectionMatch;
    if (pass) passed++;

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
    console.log(`  ${pass ? "PASS" : "FAIL"}\n`);
  }

  console.log(`\n=== Results: ${passed}/${total} passed ===`);
}

runEval().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
