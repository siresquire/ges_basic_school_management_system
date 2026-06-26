"use client";

import { useRef } from "react";
import Swal, { SwalConfirm } from "@/lib/swal";

type Props = React.ComponentProps<"form"> & {
  confirmTitle?: string;
  confirmText?: string;
  confirmButtonText?: string;
  loadingTitle?: string;
};

/**
 * Drop-in replacement for <form> on destructive actions.
 * Shows a SweetAlert2 confirmation dialog before submitting.
 */
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
      {children}
    </form>
  );
}
