"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Saves what a teacher has typed into a form to the browser (localStorage) so
// a dropped connection, accidental refresh or closed tab never loses it.
// On reload, if the saved draft differs from what the server rendered, a
// banner offers to restore it; if they match (i.e. it was already saved) the
// draft is cleared silently.

type FieldMap = Record<string, string | boolean>;

const SKIP_TYPES = new Set(["file", "password", "hidden", "submit", "button"]);

function serialize(form: HTMLFormElement): FieldMap {
  const map: FieldMap = {};
  for (const el of Array.from(form.elements)) {
    const f = el as HTMLInputElement;
    if (!f.name) continue;
    if (f.type === "radio") {
      if (f.checked) map[f.name] = f.value;
    } else if (f.type === "checkbox") {
      map[`${f.name}::${f.value}`] = f.checked;
    } else if (!SKIP_TYPES.has(f.type)) {
      map[f.name] = f.value;
    }
  }
  return map;
}

function apply(form: HTMLFormElement, map: FieldMap) {
  for (const el of Array.from(form.elements)) {
    const f = el as HTMLInputElement;
    if (!f.name) continue;
    if (f.type === "radio") {
      if (f.name in map) f.checked = map[f.name] === f.value;
    } else if (f.type === "checkbox") {
      const key = `${f.name}::${f.value}`;
      if (key in map) f.checked = Boolean(map[key]);
    } else if (!SKIP_TYPES.has(f.type) && f.name in map) {
      f.value = String(map[f.name]);
    }
  }
}

export function useFormDraft(draftKey: string) {
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState<FieldMap | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof window === "undefined") return;
    initial.current = JSON.stringify(serialize(form));
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(draftKey);
    } catch {
      return;
    }
    if (!raw) return;
    if (raw === initial.current) {
      localStorage.removeItem(draftKey); // matches saved data — nothing pending
    } else {
      try {
        setPending(JSON.parse(raw) as FieldMap);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey]);

  const save = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const cur = JSON.stringify(serialize(form));
      if (cur === initial.current) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, cur);
    } catch {
      // storage full or blocked — ignore
    }
  }, [draftKey]);

  // Debounced autosave wired to the form's change/input events.
  const onChange = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 400);
  }, [save]);

  const restore = useCallback(() => {
    if (formRef.current && pending) apply(formRef.current, pending);
    setPending(null);
  }, [pending]);

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setPending(null);
  }, [draftKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  return { formRef, hasPendingDraft: pending !== null, onChange, save, restore, discard, clear };
}
