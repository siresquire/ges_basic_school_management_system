"use client";

import { useId, useRef, useState } from "react";
import Icon from "./icon";

/**
 * A clear "Choose file" button with the picked filename beside it — replaces
 * the browser's default file input, which looks like an empty textbox.
 */
export default function FileInput({
  name,
  accept,
  required = false,
}: {
  name: string;
  accept?: string;
  required?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="btn-secondary btn-sm cursor-pointer">
        <Icon name="attach" />
        Choose file
      </label>
      <input
        ref={ref}
        id={id}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
      />
      <span className={`truncate text-sm ${fileName ? "text-gray-700" : "text-gray-400"}`}>
        {fileName || "No file chosen"}
      </span>
    </div>
  );
}
