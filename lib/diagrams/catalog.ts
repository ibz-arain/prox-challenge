export const DIAGRAM_CATALOG: Record<string, string> = {
  polarity_mig: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MIG polarity DCEP">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">MIG Polarity (DCEP)</text>
  <rect x="70" y="110" width="220" height="170" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="90" y="145" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="18" font-weight="700">OmniPro 220</text>
  <circle cx="130" cy="205" r="26" fill="#22c55e" />
  <text x="116" y="211" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">+</text>
  <circle cx="235" cy="205" r="26" fill="#ef4444" />
  <text x="223" y="211" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">-</text>
  <rect x="390" y="85" width="290" height="95" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="2" />
  <text x="410" y="125" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">MIG Torch Lead</text>
  <text x="410" y="152" fill="#22c55e" font-family="Arial, sans-serif" font-size="14">Connect torch to POSITIVE (+)</text>
  <rect x="390" y="205" width="290" height="95" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="410" y="245" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Ground Clamp</text>
  <text x="410" y="272" fill="#3b82f6" font-family="Arial, sans-serif" font-size="14">Connect work clamp to NEGATIVE (-)</text>
  <path d="M157 205 C 230 205, 300 130, 390 130" stroke="#22c55e" stroke-width="5" fill="none" />
  <path d="M260 205 C 320 205, 330 255, 390 255" stroke="#3b82f6" stroke-width="5" fill="none" />
  <text x="530" y="325" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: reversing polarity causes unstable arc and poor penetration.</text>
</svg>`,
  polarity_fcaw: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flux-cored polarity DCEN">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">Flux-Cored Polarity (DCEN)</text>
  <rect x="70" y="110" width="220" height="170" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="90" y="145" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="18" font-weight="700">OmniPro 220</text>
  <circle cx="130" cy="205" r="26" fill="#22c55e" />
  <text x="116" y="211" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">+</text>
  <circle cx="235" cy="205" r="26" fill="#ef4444" />
  <text x="223" y="211" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">-</text>
  <rect x="390" y="85" width="290" height="95" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="2" />
  <text x="410" y="125" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Ground Clamp</text>
  <text x="410" y="152" fill="#22c55e" font-family="Arial, sans-serif" font-size="14">Connect work clamp to POSITIVE (+)</text>
  <rect x="390" y="205" width="290" height="95" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="410" y="245" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Flux-Cored Torch Lead</text>
  <text x="410" y="272" fill="#3b82f6" font-family="Arial, sans-serif" font-size="14">Connect torch to NEGATIVE (-)</text>
  <path d="M157 205 C 230 205, 300 130, 390 130" stroke="#22c55e" stroke-width="5" fill="none" />
  <path d="M260 205 C 320 205, 330 255, 390 255" stroke="#3b82f6" stroke-width="5" fill="none" />
  <text x="490" y="325" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: self-shielded FCAW normally requires DCEN.</text>
</svg>`,
  polarity_tig: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TIG polarity setup">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">TIG Polarity Setup (DCEN)</text>
  <rect x="70" y="105" width="235" height="180" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="90" y="140" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="18" font-weight="700">OmniPro 220</text>
  <circle cx="135" cy="210" r="26" fill="#22c55e" />
  <text x="122" y="216" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">+</text>
  <circle cx="245" cy="210" r="26" fill="#ef4444" />
  <text x="233" y="216" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">-</text>
  <rect x="390" y="80" width="290" height="92" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="410" y="118" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">TIG Torch Lead</text>
  <text x="410" y="146" fill="#3b82f6" font-family="Arial, sans-serif" font-size="14">Connect torch to NEGATIVE (-)</text>
  <rect x="390" y="192" width="290" height="92" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="2" />
  <text x="410" y="230" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Ground Clamp</text>
  <text x="410" y="258" fill="#22c55e" font-family="Arial, sans-serif" font-size="14">Connect work clamp to POSITIVE (+)</text>
  <path d="M271 210 C 330 210, 338 126, 390 126" stroke="#3b82f6" stroke-width="5" fill="none" />
  <path d="M161 210 C 230 210, 300 238, 390 238" stroke="#22c55e" stroke-width="5" fill="none" />
  <text x="465" y="316" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: verify gas and torch setup before striking arc.</text>
</svg>`,
  polarity_stick: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Stick polarity setup">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">Stick Polarity (electrode-dependent)</text>
  <rect x="70" y="105" width="235" height="180" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="90" y="140" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="18" font-weight="700">OmniPro 220</text>
  <circle cx="135" cy="210" r="26" fill="#22c55e" />
  <text x="122" y="216" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">+</text>
  <circle cx="245" cy="210" r="26" fill="#ef4444" />
  <text x="233" y="216" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="22" font-weight="700">-</text>
  <rect x="390" y="80" width="290" height="92" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="2" />
  <text x="410" y="118" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Electrode Holder</text>
  <text x="410" y="146" fill="#22c55e" font-family="Arial, sans-serif" font-size="14">Use + or - per rod spec sheet</text>
  <rect x="390" y="192" width="290" height="92" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <text x="410" y="230" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16" font-weight="700">Ground Clamp</text>
  <text x="410" y="258" fill="#3b82f6" font-family="Arial, sans-serif" font-size="14">Connect to remaining terminal</text>
  <path d="M161 210 C 250 210, 305 126, 390 126" stroke="#22c55e" stroke-width="5" fill="none" />
  <path d="M271 210 C 330 210, 338 238, 390 238" stroke="#3b82f6" stroke-width="5" fill="none" />
  <text x="455" y="316" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: verify polarity for each electrode classification.</text>
</svg>`,
  front_panel: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Front panel socket layout">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">Front Panel Socket Layout</text>
  <rect x="85" y="95" width="590" height="210" rx="12" fill="#1a1a26" stroke="#3b82f6" stroke-width="2" />
  <circle cx="190" cy="200" r="34" fill="#22c55e" />
  <text x="165" y="206" fill="#0a0a0f" font-family="Arial, sans-serif" font-size="20" font-weight="700">DINSE+</text>
  <circle cx="305" cy="200" r="34" fill="#3b82f6" />
  <text x="280" y="206" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="20" font-weight="700">DINSE-</text>
  <rect x="390" y="165" width="108" height="70" rx="8" fill="#1f2937" stroke="#e4e4ef" />
  <text x="400" y="205" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16">TIG 2T/4T</text>
  <rect x="525" y="165" width="118" height="70" rx="8" fill="#1f2937" stroke="#e4e4ef" />
  <text x="542" y="205" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="16">Euro MIG</text>
  <text x="140" y="278" fill="#22c55e" font-family="Arial, sans-serif" font-size="13">Ground clamp often goes here for MIG/TIG charts.</text>
  <text x="140" y="300" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: always confirm polarity table before connecting leads.</text>
</svg>`,
  wire_path: `<svg viewBox="0 0 760 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wire feed path">
  <rect x="20" y="20" width="720" height="320" rx="16" fill="#12121a" stroke="#2a2a3a" />
  <text x="40" y="55" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="22" font-weight="700">Wire Feed Path (MIG/FCAW)</text>
  <circle cx="120" cy="190" r="42" fill="#1a1a26" stroke="#3b82f6" stroke-width="3" />
  <text x="82" y="196" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="15">Spool</text>
  <rect x="230" y="160" width="120" height="62" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="3" />
  <text x="247" y="198" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="14">Drive Rolls</text>
  <rect x="410" y="160" width="120" height="62" rx="10" fill="#1a1a26" stroke="#3b82f6" stroke-width="3" />
  <text x="432" y="198" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="14">Liner</text>
  <rect x="590" y="160" width="90" height="62" rx="10" fill="#1a1a26" stroke="#22c55e" stroke-width="3" />
  <text x="606" y="198" fill="#e4e4ef" font-family="Arial, sans-serif" font-size="14">Tip</text>
  <path d="M162 190 C 190 190, 208 190, 230 190" stroke="#3b82f6" stroke-width="6" fill="none" />
  <path d="M350 190 C 375 190, 390 190, 410 190" stroke="#3b82f6" stroke-width="6" fill="none" />
  <path d="M530 190 C 554 190, 568 190, 590 190" stroke="#3b82f6" stroke-width="6" fill="none" />
  <text x="230" y="255" fill="#22c55e" font-family="Arial, sans-serif" font-size="13">Green: active contact points to inspect first.</text>
  <text x="230" y="279" fill="#ef4444" font-family="Arial, sans-serif" font-size="13">Warning: overtight drive-roll tension can deform wire.</text>
</svg>`,
};

export const DIAGRAM_IDS = Object.keys(DIAGRAM_CATALOG);
