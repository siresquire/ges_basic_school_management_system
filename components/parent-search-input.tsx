"use client";

import { useState, useTransition, useRef } from "react";
import { searchParentAccounts } from "@/app/(staff)/students/actions";

type ParentResult = { username: string; name: string; children: string[] };

export default function ParentSearchInput({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentResult[]>([]);
  const [selected, setSelected] = useState<ParentResult | null>(null);
  const [, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchParentAccounts(q);
        setResults(res);
      });
    }, 300);
  }

  function pick(p: ParentResult) {
    setSelected(p);
    setQuery(p.username);
    setResults([]);
  }

  return (
    <form action={action} className="mt-3 border-t border-gray-100 pt-3">
      <p className="mb-2 text-xs text-gray-500">Or link a sibling&apos;s existing parent account:</p>
      <div className="relative">
        <input
          name="parentUsername"
          className="input"
          placeholder="Type parent username…"
          value={query}
          onChange={handleChange}
          autoComplete="off"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            {results.map((p) => (
              <li
                key={p.username}
                className="cursor-pointer px-3 py-2 hover:bg-gray-50"
                onMouseDown={() => pick(p)}
              >
                <p className="text-sm font-medium text-gray-900">{p.username}</p>
                <p className="text-xs text-gray-500">
                  {p.name}
                  {p.children.length > 0 ? ` · ${p.children.join(", ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <p className="mt-1 text-xs text-emerald-700">
          Parent of: {selected.children.join(", ") || "no linked students yet"}
        </p>
      )}
      <button
        type="submit"
        className="btn-secondary btn-sm mt-2 w-full"
        disabled={query.trim().length < 2}
      >
        Link
      </button>
    </form>
  );
}
