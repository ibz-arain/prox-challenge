export type WeldingSuggestion = {
  label: string;
  query: string;
};

/** Shown in the sidebar “Try asking” list */
export const SIDEBAR_SAMPLE_PROMPTS: WeldingSuggestion[] = [
  {
    label: "Duty cycle at 200A",
    query: "What's the duty cycle for MIG welding at 200A on 240V?",
  },
  {
    label: "Flux-cored porosity",
    query:
      "I'm getting porosity in my flux-cored welds. What should I check?",
  },
  {
    label: "TIG polarity setup",
    query: "What polarity setup do I need for TIG welding?",
  },
  {
    label: "Ground clamp socket",
    query: "Show me which socket the ground clamp goes in.",
  },
  {
    label: "Settings for mild steel",
    query: "Help me choose settings for 1/8 inch mild steel on 240V",
  },
  {
    label: "120V vs 240V",
    query: "What's the difference between 120V and 240V mode?",
  },
];

const EXTRA_WELDING_TOPICS: WeldingSuggestion[] = [
  { label: "Stick electrode size", query: "What stick electrode sizes work best for 1/8 inch steel?" },
  { label: "Gas flow rate", query: "What shielding gas flow rate should I use for MIG?" },
  { label: "Spatter reduction", query: "How do I reduce spatter on my MIG welds?" },
  { label: "Burn-through thin metal", query: "I'm burning through thin sheet metal on MIG—what should I change?" },
  { label: "TIG tungsten type", query: "What tungsten type and size should I use for TIG on steel?" },
  { label: "AC vs DC TIG", query: "When do I need AC vs DC for TIG on this machine?" },
  { label: "Flux-core vs MIG gas", query: "Do I need gas for flux-cored wire on the OmniPro 220?" },
  { label: "Wire feed slipping", query: "My wire feed is slipping—what should I check?" },
  { label: "Duty cycle explanation", query: "Explain duty cycle and how it affects my welding time." },
  { label: "Overload or thermal", query: "What does it mean if the welder shuts off from heat?" },
  { label: "Polarity for stick", query: "What polarity should I use for stick welding?" },
  { label: "Regulator setup", query: "How do I set up the gas regulator for MIG?" },
  { label: "Contact tip wear", query: "How do I know when to replace the MIG contact tip?" },
  { label: "Weld porosity causes", query: "What causes porosity in MIG welds and how do I fix it?" },
  { label: "Stainless MIG wire", query: "Can I weld stainless steel with this welder using MIG?" },
  { label: "Aluminum spool gun", query: "What do I need to weld aluminum on the OmniPro 220?" },
  { label: "Synergic mode", query: "How does synergic mode work on the LCD?" },
  { label: "Inductance setting", query: "What does inductance do on MIG and how should I set it?" },
  { label: "Arc length / voltage", query: "How do voltage and arc length relate for MIG?" },
  { label: "Travel speed", query: "How does travel speed affect my MIG bead?" },
  { label: "TIG foot pedal", query: "Can I use a foot pedal with this machine for TIG?" },
  { label: "High frequency start", query: "Does the OmniPro 220 support HF start for TIG?" },
  { label: "Work clamp placement", query: "Where should I attach the work clamp for best results?" },
  { label: "Input plug 240V", query: "What kind of 240V outlet and plug do I need?" },
  { label: "Generator use", query: "Can I run this welder on a portable generator?" },
  { label: "Error codes", query: "Where do I find error codes and what do they mean?" },
  { label: "Maintenance schedule", query: "What routine maintenance does the OmniPro 220 need?" },
  { label: "Drive roll tension", query: "How tight should the wire drive rolls be?" },
  { label: "Liners and kinks", query: "How do I check the MIG liner for problems?" },
  { label: "Tack welding settings", query: "Good starting settings for tack welds on thin steel?" },
  { label: "Vertical MIG", query: "Tips for vertical MIG welding with this machine." },
  { label: "Overhead welding", query: "Any tips for overhead welding settings?" },
  { label: "Stick 6010 vs 7018", query: "Difference between 6010 and 7018 rods for this welder?" },
  { label: "Preheat thick steel", query: "Do I need preheat for thick steel with stick?" },
  { label: "WPS / parameters", query: "How do I read a WPS and set the welder to match?" },
  { label: "Shielding gas mix", query: "CO2 vs C25 gas—when should I use each for MIG?" },
  { label: "Bird nesting", query: "Wire bird-nests at the drive—how do I prevent it?" },
  { label: "No arc on start", query: "Welder won't start an arc—what should I troubleshoot?" },
  { label: "Display won’t turn on", query: "The display on my OmniPro won’t power on—what to check?" },
];

/** Pool for landing “Try” pills (sidebar samples + extended topics) */
export const WELDING_TOPIC_BANK: WeldingSuggestion[] = [
  ...SIDEBAR_SAMPLE_PROMPTS,
  ...EXTRA_WELDING_TOPICS,
];

export function pickRandomDistinct<T>(items: readonly T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}
