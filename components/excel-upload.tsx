"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ExcelActionState } from "@/app/(staff)/excel/actions";
import Swal from "@/lib/swal";
import Icon from "./icon";

/**
 * File upload form that shows the import result (and row-level problems)
 * inline. When the import is rejected because newer data exists, the chosen
 * file (captured at submit — React clears the input after an action) is put
 * back so it can be re-sent with explicit confirmation.
 */
export default function ExcelUpload({
  action,
  buttonLabel,
}: {
  action: (state: ExcelActionState, formData: FormData) => Promise<ExcelActionState>;
  buttonLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSubmission = useRef<FormData | null>(null);
  const [fileName, setFileName] = useState("");
  const inputId = useId();

  // Show / hide a loading popup while the upload is in flight.
  useEffect(() => {
    if (pending) {
      Swal.fire({
        title: "Uploading & processing…",
        text: "Please wait — this may take a moment for large files.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
    } else {
      Swal.close();
    }
  }, [pending]);

  // After a rejection, restore the chosen file into the (auto-reset) input.
  useEffect(() => {
    if (!state?.needsConfirm) return;
    const file = lastSubmission.current?.get("file");
    if (fileRef.current && file instanceof File) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileRef.current.files = dt.files;
      setFileName(file.name);
    }
  }, [state]);

  const setOverride = (value: string) => {
    const input = formRef.current?.elements.namedItem("override");
    if (input instanceof HTMLInputElement) input.value = value;
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        lastSubmission.current = new FormData(e.currentTarget);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="override" defaultValue="" />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="btn-secondary btn-sm cursor-pointer">
          <Icon name="attach" />
          Choose file
        </label>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        <span className={`max-w-48 truncate text-sm ${fileName ? "text-gray-700" : "text-gray-400"}`}>
          {fileName || "No file chosen"}
        </span>
        <button onClick={() => setOverride("")} disabled={pending} className="btn-primary btn-sm">
          <Icon name="upload" />
          {pending ? "Uploading…" : buttonLabel}
        </button>
      </div>
      {state && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          <p className="font-medium">{state.message}</p>
          {state.details.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {state.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {state.needsConfirm && (
            <button
              onClick={() => setOverride("1")}
              disabled={pending}
              className="btn-danger btn-sm mt-2"
              title="Overwrites the newer values listed above with the ones in your file"
            >
              {pending ? "Uploading…" : "Replace newer data with my file"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
