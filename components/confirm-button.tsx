"use client";

import { useRef } from "react";
import { SwalConfirm } from "@/lib/swal";

type Props = React.ComponentProps<"button"> & {
  confirmTitle?: string;
  confirmText?: string;
  confirmButtonText?: string;
};

/**
 * Drop-in replacement for <button formAction={...}> on destructive actions.
 * Intercepts the click, shows a SweetAlert2 confirmation, then re-fires
 * the click (allowing the formAction to submit) only if the user confirms.
 */
export function ConfirmButton({
  confirmTitle = "Are you sure?",
  confirmText = "This action cannot be undone.",
  confirmButtonText = "Yes, delete it",
  children,
  ...props
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmed = useRef(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      return;
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
      confirmed.current = true;
      buttonRef.current?.click();
    }
  }

  return (
    <button ref={buttonRef} onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
