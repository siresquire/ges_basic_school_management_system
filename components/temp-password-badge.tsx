"use client";
import { useState } from "react";
import Icon from "@/components/icon";

export function TempPasswordBadge({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
      <Icon name="key" />
      <span>
        Temp password:{" "}
        <span className="font-mono font-semibold tracking-wide">{password}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        className={`ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
          copied
            ? "bg-emerald-100 text-emerald-700"
            : "text-amber-700 hover:bg-amber-100"
        }`}
      >
        <Icon name={copied ? "check" : "copy"} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
