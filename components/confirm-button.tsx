"use client";

import { useEffect, useRef } from "react";
import { SwalConfirm } from "@/lib/swal";
import Swal from "@/lib/swal";

// Module-level flag — same pattern as ConfirmForm.
// Survives re-renders and remounts so useEffect can close the popup
// after the server action's redirect causes a re-render.
let pendingClose = false;

type Props = React.ComponentProps<"button"> & {
  confirmTitle?: string;
  confirmText?: string;
  confirmButtonText?: string;
  loadingTitle?: string;
};

export function ConfirmButton({
  confirmTitle = "Are you sure?",
  confirmText = "This action cannot be undone.",
  confirmButtonText = "Yes, delete it",
  loadingTitle = "Processing…",
  children,
  ...props
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);

  function check() {
    if (pendingClose && Swal.isLoading()) {
      pendingClose = false;
      Swal.close();
    }
  }
  useEffect(check, []); // on mount — handles remount-after-redirect
  useEffect(check);     // after every render — handles in-place re-render

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return; // let native form submission proceed
    }
    e.preventDefault();

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
      buttonRef.current?.click(); // second click skips confirm, submits form with formAction
    }
  }

  return (
    <button ref={buttonRef} onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
