"use client";

import { useState } from "react";
import Icon from "./icon";

export function CopyContactsButton({
  contacts,
}: {
  contacts: { name: string; phone: string; relation: string }[];
}) {
  const [copied, setCopied] = useState(false);

  const filled = contacts.filter((c) => c.name || c.phone);
  if (filled.length === 0) return null;

  const text = filled
    .map((c) => `${c.name}${c.relation ? ` (${c.relation})` : ""}: ${c.phone}`)
    .join("\n");

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      className={`btn-secondary btn-sm transition-colors ${copied ? "border-emerald-400 text-emerald-700" : ""}`}
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Icon name="check" className="text-emerald-600" /> Copied!
        </>
      ) : (
        <>
          <Icon name="copy" /> Copy contacts
        </>
      )}
    </button>
  );
}
