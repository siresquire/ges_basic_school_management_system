"use client";

import { useEffect, useRef, useTransition } from "react";
import Swal from "@/lib/swal";

type Props = React.ComponentProps<"form"> & {
  loadingTitle?: string;
};

export function ProcessingForm({ loadingTitle = "Processing…", children, ...props }: Props) {
  const [isPending, startTransition] = useTransition();
  const wasLoading = useRef(false);
  // Extract action so we can call it directly inside startTransition.
  const { action, ...rest } = props;

  // Primary close: isPending flips false when the transition (+ redirect) resolves.
  useEffect(() => {
    if (!isPending && wasLoading.current) {
      wasLoading.current = false;
      Swal.close();
    }
  }, [isPending]);

  // Fallback close: if the page re-rendered while Swal was loading, close it now.
  useEffect(() => {
    if (Swal.isLoading()) Swal.close();
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    wasLoading.current = true;
    Swal.fire({
      title: loadingTitle,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
    if (typeof action === "function") {
      startTransition(async () => {
        await (action as (fd: FormData) => Promise<void>)(formData);
      });
    }
  }

  return (
    <form {...rest} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
