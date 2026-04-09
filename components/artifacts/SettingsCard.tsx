"use client";

import { Settings } from "lucide-react";

interface SettingsCardProps {
  title: string;
  content: string;
}

export default function SettingsCard({ title, content }: SettingsCardProps) {
  let settings: Record<string, string> = {};
  try {
    settings = JSON.parse(content);
  } catch {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <Settings size={14} />
          {title}
        </div>
        <div className="p-4 text-sm">{content}</div>
      </div>
    );
  }

  const labelMap: Record<string, string> = {
    process: "Welding Process",
    material: "Material",
    thickness: "Material Thickness",
    voltage_input: "Input Voltage",
    wire_type: "Wire Type",
    wire_diameter: "Wire Diameter",
    voltage_setting: "Voltage Setting",
    wire_speed: "Wire Feed Speed",
    gas: "Shielding Gas",
    gas_flow: "Gas Flow Rate",
    polarity: "Polarity",
    amperage: "Amperage",
    notes: "Notes",
  };

  const entries = Object.entries(settings).filter(
    ([, v]) => v && v.toString().trim()
  );

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <Settings size={14} />
        {title}
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center px-4 py-2.5">
            <span className="text-xs font-medium text-[var(--color-text-muted)] w-40 flex-shrink-0">
              {labelMap[key] || key}
            </span>
            <span className="text-sm font-mono text-[var(--color-text)]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
