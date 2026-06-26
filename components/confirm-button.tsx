"use client";

import { useEffect, useRef, useTransition } from "react";
import { SwalConfirm } from "@/lib/swal";
import Swal from "@/lib/swal";

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
  const [isPending, startTransition] = useTransition();
  const wasLoading = useRef(false);
  const { formAction, ...rest } = props;

  useEffect(() => {
    if (!isPending && wasLoading.current) {
      wasLoading.current = false;
      Swal.close();
    }
  }, [isPending]);

  useEffect(() => {
    if (Swal.isLoading()) Swal.close();
  }, []);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();

    const result = await SwalConfirm.fire({
      title: confirmTitle,
      text: confirmText,
      icon: "warning",
      confirmButtonText,
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      wasLoading.current = true;
      Swal.fire({
        title: loadingTitle,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      const form = buttonRef.current?.form;
      const formData = form ? new FormData(form) : new FormData();
      if (typeof formAction === "function") {
        startTransition(async () => {
          await (formAction as (fd: FormData) => Promise<void>)(formData);
        });
      }
    }
  }

  return (
    <button ref={buttonRef} onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}
