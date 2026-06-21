"use client";

import { useState } from "react";
import Icon from "@/components/icon";

export function FeatureToggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{description}</span>
      </span>
      <span className={checked ? "text-emerald-600" : "text-gray-400"}>
        <Icon name={checked ? "toggleOn" : "toggleOff"} className="text-2xl" />
      </span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only"
      />
    </label>
  );
}
