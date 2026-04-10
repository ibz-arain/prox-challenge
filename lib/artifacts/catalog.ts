/**
 * Single source of truth for artifact patterns embedded in the system prompt.
 * Keep names stable; adjust "whenToUse" as product docs evolve.
 */

export type ArtifactPatternId =
  | "specs-duty-matrix"
  | "polarity-leads"
  | "panel-wire-path"
  | "troubleshooting-tree"
  | "synergic-settings"
  | "process-material-matrix"
  | "gas-regulator"
  | "wire-feed-drive"
  | "input-voltage-compare"
  | "safety-callout"
  | "maintenance-intervals"
  | "parts-consumables"
  | "off-topic-redirect"
  | "visual-evidence";

export interface ArtifactPattern {
  id: ArtifactPatternId;
  name: string;
  primaryType: string;
  secondType?: string;
  whenToUse: string;
  manualSections: string;
}

export const ARTIFACT_PATTERNS: ArtifactPattern[] = [
  {
    id: "specs-duty-matrix",
    name: "Specs / duty matrix",
    primaryType: "table",
    secondType: "calculator (only if exploration helps)",
    whenToUse: "Duty cycle, amperage limits, dimensions, weight, input power—any numeric specs from the manual.",
    manualSections: "specs; lookup_specs",
  },
  {
    id: "polarity-leads",
    name: "Polarity / lead routing",
    primaryType: "svg-diagram (use get_diagram when possible)",
    secondType: "table",
    whenToUse: "DCEP/DCEN, torch/work lead, which socket for ground—spatial connection questions.",
    manualSections: "polarity",
  },
  {
    id: "panel-wire-path",
    name: "Front panel / wire path",
    primaryType: "svg-diagram",
    secondType: "artifact-html (short legend if needed)",
    whenToUse: "LCD/menus, drive path, wire threading, front-panel layout.",
    manualSections: "setup",
  },
  {
    id: "troubleshooting-tree",
    name: "Troubleshooting",
    primaryType: "flowchart",
    secondType: "artifact-html (checklist)",
    whenToUse: "Porosity, arc start, wire feed, erratic arc, contamination—decision-style fixes.",
    manualSections: "troubleshooting",
  },
  {
    id: "synergic-settings",
    name: "Synergic / recommended settings",
    primaryType: "settings-card",
    secondType: "table",
    whenToUse: "Suggested volts, wire speed, gas, polarity after you have process/material/thickness context.",
    manualSections: "welding-process",
  },
  {
    id: "process-material-matrix",
    name: "Process × material matrix",
    primaryType: "table",
    whenToUse: "Selection charts, comparing processes or materials side by side.",
    manualSections: "welding-process; selection-chart",
  },
  {
    id: "gas-regulator",
    name: "Gas / regulator",
    primaryType: "calculator (JSON type gas-flow) or table",
    secondType: "table",
    whenToUse: "Shielding gas, flow rate thinking, regulator setup—pair with manual-cited values in prose/table.",
    manualSections: "setup",
  },
  {
    id: "wire-feed-drive",
    name: "Wire feed / drive tension",
    primaryType: "flowchart or step-list",
    secondType: "artifact-html",
    whenToUse: "Drive roll tension, liner, birdnesting, slipping wire—ordered checks or steps.",
    manualSections: "setup; maintenance",
  },
  {
    id: "input-voltage-compare",
    name: "120V vs 240V",
    primaryType: "table",
    whenToUse: "Differences in capability, plug type, when to use which input—cite manual.",
    manualSections: "specs; setup",
  },
  {
    id: "safety-callout",
    name: "Safety callout",
    primaryType: "artifact-html",
    whenToUse: "Highlight PPE, ventilation, shock hazard, hot work in a compact callout box.",
    manualSections: "safety",
  },
  {
    id: "maintenance-intervals",
    name: "Maintenance intervals",
    primaryType: "table or settings-card",
    whenToUse: "Cleaning, inspection, consumable replacement schedules from the manual.",
    manualSections: "maintenance",
  },
  {
    id: "parts-consumables",
    name: "Parts / consumables",
    primaryType: "table",
    whenToUse: "Tips, nozzles, liners, drive rolls—sizes and names as listed in the manual.",
    manualSections: "parts",
  },
  {
    id: "off-topic-redirect",
    name: "Off-topic redirect",
    primaryType: "artifact-html (suggested questions)",
    whenToUse: "Only when the user is off-topic per Scope Guard.",
    manualSections: "n/a",
  },
  {
    id: "visual-evidence",
    name: "Manual page visuals",
    primaryType: "(use get_page_image / get_visual_context—not an artifact tag)",
    secondType: "artifact-html (optional caption card)",
    whenToUse: "When the scanned manual page photo/diagram is the best evidence; still keep 1–2 other artifacts if they add clarity.",
    manualSections: "general",
  },
];

/** Harbor Freight listing context — marketing/retail only; never override manual numbers. */
export const RETAIL_PRODUCT_CONTEXT = `## Retail listing context (supplementary, not a spec sheet)
- Listed as Vulcan OmniPro 220 Industrial Multiprocess Welder with 120/240V input (Harbor Freight item 57812).
- Positioned as a multiprocess unit (MIG, flux-cored, TIG, stick) with synergic-style control; exact features and ratings on the store page may change—always confirm numbers in the Owner's Manual via tools.`;

export const ARTIFACT_CATALOG_PROMPT_SECTION = `## Artifact catalog (pick 1–2 patterns per answer)
Choose the smallest set that helps the user. Do not add artifacts just to reach a count.

${ARTIFACT_PATTERNS.map(
  (p, i) =>
    `${i + 1}. **${p.name}** — primary: \`${p.primaryType}\`${p.secondType ? `; optional second: \`${p.secondType}\`` : ""}
   - When: ${p.whenToUse}
   - Manual areas: ${p.manualSections}`
).join("\n\n")}

### Calculator JSON \`type\` values (inside <artifact type="calculator">)
- \`{"type":"duty-cycle"}\` — weld vs cool time in a 10-minute window (educational slider).
- \`{"type":"gas-flow"}\` — CFH slider for thinking about shielding gas flow (always cite manual for actual recommended values).
- \`{"type":"thermal-rest"}\` — same math as duty cycle but framed as cool-down / rest between welds.
- \`{"type":"settings-configurator"}\` — starting-point MIG/FCAW picks by material/thickness (fine-tune from manual/selection chart).

### step-list artifact
- Use \`<artifact type="step-list" title="Title">{"steps":[{"title":"...","detail":"..."}]}</artifact>\` for ordered procedures (setup, drive tension, checks).

### artifact-html
- JSON with \`html\`, \`css\`, optional \`js\`, optional \`height\`. Use for safety callouts, checklists, suggested-questions lists when off-topic.`;
