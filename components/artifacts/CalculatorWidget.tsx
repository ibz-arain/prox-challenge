"use client";

import { useState, type ReactNode } from "react";
import { Calculator } from "lucide-react";

interface CalculatorWidgetProps {
  title: string;
  content: string;
}

function DutyCycleCalculator() {
  const [amperage, setAmperage] = useState(150);
  const [dutyCycle, setDutyCycle] = useState(30);

  const cycleDuration = 10;
  const weldTime = (dutyCycle / 100) * cycleDuration;
  const coolTime = cycleDuration - weldTime;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400 leading-relaxed">
        Duty cycle tells you how many minutes out of a 10-minute cycle you can
        weld continuously before needing to let the machine cool.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-neutral-400 block mb-1">
            Amperage: {amperage}A
          </label>
          <input
            type="range"
            min={30}
            max={220}
            value={amperage}
            onChange={(e) => setAmperage(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="flex justify-between text-xs text-neutral-500">
            <span>30A</span>
            <span>220A</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400 block mb-1">
            Duty Cycle: {dutyCycle}%
          </label>
          <input
            type="range"
            min={10}
            max={60}
            step={5}
            value={dutyCycle}
            onChange={(e) => setDutyCycle(Number(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="flex justify-between text-xs text-neutral-500">
            <span>10%</span>
            <span>60%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-green-950/50 border border-green-600/35 shadow-sm ring-1 ring-green-600/20">
          <div className="text-xs font-medium text-neutral-400">Weld Time</div>
          <div className="text-lg font-semibold text-green-400 leading-snug">
            {weldTime.toFixed(1)} min
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/35 shadow-sm ring-1 ring-amber-500/20">
          <div className="text-xs font-medium text-neutral-400">Cool Down</div>
          <div className="text-lg font-semibold text-amber-400 leading-snug">
            {coolTime.toFixed(1)} min
          </div>
        </div>
      </div>
      <div className="h-4 rounded-full overflow-hidden bg-neutral-800 flex ring-1 ring-neutral-700">
        <div
          className="h-full bg-green-600 transition-all duration-500 ease-out"
          style={{ width: `${dutyCycle}%` }}
        />
        <div
          className="h-full bg-amber-400/60 transition-all duration-500 ease-out"
          style={{ width: `${100 - dutyCycle}%` }}
        />
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">
        At {amperage}A with {dutyCycle}% duty cycle, you can weld for{" "}
        {weldTime.toFixed(1)} minutes, then need {coolTime.toFixed(1)} minutes
        of cool-down in each 10-minute period.
      </p>
    </div>
  );
}

function ThermalRestCalculator() {
  const [dutyCycle, setDutyCycle] = useState(30);
  const cycleDuration = 10;
  const weldTime = (dutyCycle / 100) * cycleDuration;
  const coolTime = cycleDuration - weldTime;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400 leading-relaxed">
        Use this to think about how long the machine can run before it needs
        idle time to shed heat—always follow the duty cycle numbers from the
        manual for your amperage and input voltage.
      </p>
      <div>
        <label className="text-xs font-medium text-neutral-400 block mb-1">
          Duty cycle (example): {dutyCycle}%
        </label>
        <input
          type="range"
          min={10}
          max={60}
          step={5}
          value={dutyCycle}
          onChange={(e) => setDutyCycle(Number(e.target.value))}
          className="w-full accent-brand"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-600/30">
          <div className="text-xs font-medium text-neutral-400">Arc-on time</div>
          <div className="text-lg font-semibold text-sky-300 leading-snug">
            {weldTime.toFixed(1)} min
          </div>
        </div>
        <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-600/40">
          <div className="text-xs font-medium text-neutral-400">Rest / cool</div>
          <div className="text-lg font-semibold text-neutral-200 leading-snug">
            {coolTime.toFixed(1)} min
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">
        In each {cycleDuration}-minute window: about {weldTime.toFixed(1)} min
        under load, then about {coolTime.toFixed(1)} min without welding so
        the inverter can cool.
      </p>
    </div>
  );
}

function GasFlowCalculator() {
  const [cfh, setCfh] = useState(25);

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400 leading-relaxed">
        Shielding gas is measured in cubic feet per hour (CFH). The manual
        lists the flow rates to use—this slider is only for building intuition.
      </p>
      <div>
        <label className="text-xs font-medium text-neutral-400 block mb-1">
          Flow rate: {cfh} CFH
        </label>
        <input
          type="range"
          min={10}
          max={45}
          step={1}
          value={cfh}
          onChange={(e) => setCfh(Number(e.target.value))}
          className="w-full accent-brand"
        />
        <div className="flex justify-between text-xs text-neutral-500">
          <span>10 CFH</span>
          <span>45 CFH</span>
        </div>
      </div>
      <div className="p-3 rounded-xl border border-cyan-600/25 bg-cyan-950/30 ring-1 ring-cyan-500/15">
        <div className="text-xs font-medium text-neutral-400 mb-1">
          Rough reference
        </div>
        <p className="text-sm text-neutral-200 leading-snug">
          Many short-circuit MIG setups fall in roughly{" "}
          <strong className="text-cyan-200">18–30 CFH</strong> depending on
          nozzle size, draft, and joint—confirm on the chart in the manual.
        </p>
      </div>
    </div>
  );
}

function SettingsConfigurator() {
  const [process, setProcess] = useState("MIG");
  const [material, setMaterial] = useState("mild-steel");
  const [thickness, setThickness] = useState("1/8");

  const settingsMap: Record<string, Record<string, Record<string, string>>> = {
    MIG: {
      "mild-steel": {
        "1/16": "Voltage: 16-17V | Wire Speed: 200-250 IPM | Wire: 0.030\" ER70S-6",
        "1/8": "Voltage: 18-20V | Wire Speed: 280-320 IPM | Wire: 0.030\" ER70S-6",
        "3/16": "Voltage: 20-22V | Wire Speed: 320-380 IPM | Wire: 0.035\" ER70S-6",
        "1/4": "Voltage: 22-24V | Wire Speed: 350-420 IPM | Wire: 0.035\" ER70S-6",
      },
      "stainless": {
        "1/16": "Voltage: 16-17V | Wire Speed: 180-220 IPM | Wire: 0.030\" ER308L",
        "1/8": "Voltage: 18-20V | Wire Speed: 250-300 IPM | Wire: 0.030\" ER308L",
        "3/16": "Voltage: 20-22V | Wire Speed: 300-350 IPM | Wire: 0.035\" ER308L",
        "1/4": "Voltage: 22-25V | Wire Speed: 330-400 IPM | Wire: 0.035\" ER308L",
      },
      "aluminum": {
        "1/8": "Voltage: 19-21V | Wire Speed: 350-420 IPM | Wire: 0.035\" ER4043",
        "3/16": "Voltage: 21-23V | Wire Speed: 400-480 IPM | Wire: 0.035\" ER4043",
        "1/4": "Voltage: 23-25V | Wire Speed: 450-520 IPM | Wire: 0.035\" ER4043",
      },
    },
    "Flux-Cored": {
      "mild-steel": {
        "1/8": "Voltage: 18-20V | Wire Speed: 250-300 IPM | Wire: 0.030\" E71T-GS",
        "3/16": "Voltage: 20-22V | Wire Speed: 280-340 IPM | Wire: 0.035\" E71T-GS",
        "1/4": "Voltage: 22-24V | Wire Speed: 320-380 IPM | Wire: 0.035\" E71T-GS",
      },
    },
  };

  const setting =
    settingsMap[process]?.[material]?.[thickness] ??
    "Refer to the selection chart for specific settings.";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-400 block mb-1">
            Process
          </label>
          <select
            value={process}
            onChange={(e) => setProcess(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900/80 text-sm text-neutral-100 transition-colors duration-500 ease-out focus:bg-neutral-900 focus:border-neutral-600 focus:outline-none focus:ring-0"
          >
            <option value="MIG">MIG</option>
            <option value="Flux-Cored">Flux-Cored</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400 block mb-1">
            Material
          </label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900/80 text-sm text-neutral-100 transition-colors duration-500 ease-out focus:bg-neutral-900 focus:border-neutral-600 focus:outline-none focus:ring-0"
          >
            <option value="mild-steel">Mild Steel</option>
            <option value="stainless">Stainless Steel</option>
            {process === "MIG" && (
              <option value="aluminum">Aluminum</option>
            )}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400 block mb-1">
            Thickness
          </label>
          <select
            value={thickness}
            onChange={(e) => setThickness(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900/80 text-sm text-neutral-100 transition-colors duration-500 ease-out focus:bg-neutral-900 focus:border-neutral-600 focus:outline-none focus:ring-0"
          >
            {process !== "Flux-Cored" && (
              <option value="1/16">1/16&quot;</option>
            )}
            <option value="1/8">1/8&quot;</option>
            <option value="3/16">3/16&quot;</option>
            <option value="1/4">1/4&quot;</option>
          </select>
        </div>
      </div>
      <div className="p-3 rounded-xl border border-brand/30 bg-brand/10 shadow-sm ring-1 ring-brand/15">
        <div className="text-xs font-medium text-neutral-400 mb-1">
          Recommended Settings
        </div>
        <div className="text-sm font-medium text-neutral-100 leading-snug">{setting}</div>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">
        These are starting-point settings. Fine-tune based on your specific
        joint type and position. Always test on scrap material first.
      </p>
    </div>
  );
}

export default function CalculatorWidget({
  title,
  content,
}: CalculatorWidgetProps) {
  let calcType = "duty-cycle";
  let isValidPayload = true;
  try {
    const parsed = JSON.parse(content);
    calcType = parsed.type || "duty-cycle";
  } catch {
    isValidPayload = false;
  }

  let body: ReactNode;
  if (!isValidPayload) {
    body = (
      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
        {content}
      </pre>
    );
  } else {
    switch (calcType) {
      case "settings-configurator":
        body = <SettingsConfigurator />;
        break;
      case "gas-flow":
        body = <GasFlowCalculator />;
        break;
      case "thermal-rest":
        body = <ThermalRestCalculator />;
        break;
      case "duty-cycle":
      default:
        body = <DutyCycleCalculator />;
    }
  }

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <Calculator size={14} />
        {title}
      </div>
      <div className="p-4">{body}</div>
    </div>
  );
}
