"use client";

import Icon from "./icon";

export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-secondary no-print">
      <Icon name="print" />
      {label}
    </button>
  );
}
