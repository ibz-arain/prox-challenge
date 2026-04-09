"use client";

import { Table } from "lucide-react";

interface TableArtifactProps {
  title: string;
  content: string;
}

function parseMarkdownTable(md: string) {
  const lines = md
    .trim()
    .split("\n")
    .filter((l) => l.trim());
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell && !cell.match(/^[-:]+$/));

  const headers = parseRow(lines[0]);
  const separatorIdx = lines.findIndex((l) => l.match(/^\|?\s*[-:]+/));
  const dataStart = separatorIdx >= 0 ? separatorIdx + 1 : 1;
  const rows = lines.slice(dataStart).map(parseRow);

  return { headers, rows };
}

export default function TableArtifact({ title, content }: TableArtifactProps) {
  const table = parseMarkdownTable(content);

  if (!table || table.headers.length === 0) {
    return (
      <div className="artifact-card my-4">
        <div className="artifact-card-header">
          <Table size={14} />
          {title}
        </div>
        <div className="p-4">
          <pre className="text-sm whitespace-pre-wrap text-neutral-400 leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-card my-4">
      <div className="artifact-card-header">
        <Table size={14} />
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left font-semibold bg-neutral-800/80 border-b border-neutral-700 text-neutral-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors duration-500 ease-out"
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="px-4 py-2 text-neutral-400 leading-relaxed"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
