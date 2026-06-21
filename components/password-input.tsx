"use client";

import { useState } from "react";
import Icon from "./icon";

function generate(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pool = upper + lower + digits;
  // Guarantee at least one of each character class
  let pw =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)];
  for (let i = 3; i < 8; i++) pw += pool[Math.floor(Math.random() * pool.length)];
  // Shuffle
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Controlled password input with a one-click generator and in-field copy button.
 * Use `compact` for table-cell contexts (narrower layout).
 */
export function PasswordInput({
  name,
  placeholder = "New password (min 6 chars)",
  required,
  minLength = 6,
  compact = false,
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  compact?: boolean;
}) {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setValue(generate());
    setCopied(false);
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            name={name}
            type="text"
            className="input w-32 pr-7 font-mono text-sm"
            placeholder="New password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setCopied(false); }}
            required={required}
            minLength={minLength}
          />
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs transition-colors"
              title={copied ? "Copied!" : "Copy"}
            >
              <Icon
                name={copied ? "check" : "copy"}
                className={copied ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"}
              />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="btn-secondary btn-sm"
          title="Generate random password"
        >
          <Icon name="key" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            name={name}
            type="text"
            className="input pr-10 font-mono"
            placeholder={placeholder}
            value={value}
            onChange={(e) => { setValue(e.target.value); setCopied(false); }}
            required={required}
            minLength={minLength}
          />
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              title={copied ? "Copied!" : "Copy password"}
            >
              <Icon
                name={copied ? "check" : "copy"}
                className={copied ? "text-emerald-600" : "text-gray-400 hover:text-emerald-600"}
              />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="btn-secondary btn-sm whitespace-nowrap"
          title="Generate a random 8-character password"
        >
          <Icon name="key" /> Generate
        </button>
      </div>
      {value && (
        <p className="text-xs text-gray-500">
          Password:{" "}
          <span className="font-mono font-semibold text-gray-800">{value}</span>
          {copied && (
            <span className="ml-2 text-emerald-600">
              <Icon name="check" className="mr-0.5" />
              Copied!
            </span>
          )}
        </p>
      )}
    </div>
  );
}
