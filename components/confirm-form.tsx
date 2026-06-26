"use client";

import { useEffect, useRef } from "react";
import { SwalConfirm } from "@/lib/swal";
import Swal from "@/lib/swal";

// Module-level flag: true while we're waiting for the server action's redirect
// to cause a re-render so we can close the loading popup.
// Module scope survives both re-renders AND component remounts.
let pendingClose = false;

function SubmitWatcher() {
  function check() {
    if (pendingClose && Swal.isLoading()) {
      pendingClose = false;
      Swal.close();
    }
  }
  useEffect(check, []); // fires on mount — handles remount-after-redirect
  useEffect(check);     // fires after every render — handles in-place re-render
  return null;
}

type Props = React.ComponentProps<"form"> & {
  confirmTitle?: string;
  confirmText?: string;
  confirmButtonText?: string;
  loadingTitle?: string;
};

export function ConfirmForm({
  confirmTitle = "Are you sure?",
  confirmText = "This action cannot be undone.",
  confirmButtonText = "Yes, proceed",
  loadingTitle = "Processing…",
  children,
  ...props
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const submitterRef = useRef<HTMLElement | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    e.preventDefault();
    submitterRef.current = (e.nativeEvent as SubmitEvent).submitter;

    const result = await SwalConfirm.fire({
      title: confirmTitle,
      text: confirmText,
      icon: "warning",
      confirmButtonText,
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      pendingClose = true;
      Swal.fire({
        title: loadingTitle,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      confirmed.current = true;
      formRef.current?.requestSubmit(submitterRef.current as HTMLButtonElement | null);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} {...props}>
      <SubmitWatcher />
      {children}
    </form>
  );
}
