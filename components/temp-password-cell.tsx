"use client";

import { useState } from "react";
import Icon from "@/components/icon";

export function TempPasswordCell({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <span className="tracking-wide">{visible ? password : "••••••••"}</span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-gray-400 transition-colors hover:text-gray-600"
        title={visible ? "Hide" : "Reveal"}
      >
        <Icon name={visible ? "eye-slash" : "eye"} />
      </button>
      <button
        type="button"
        onClick={copy}
        className={`transition-colors ${copied ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}
        title="Copy password"
      >
        <Icon name={copied ? "check" : "copy"} />
      </button>
    </div>
  );
}
