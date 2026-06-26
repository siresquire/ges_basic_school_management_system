"use client";

import { useEffect, useRef, useTransition } from "react";
import { SwalConfirm } from "@/lib/swal";
import Swal from "@/lib/swal";

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
  const [isPending, startTransition] = useTransition();
  const wasLoading = useRef(false);
  const { action, ...rest } = props;

  useEffect(() => {
    if (!isPending && wasLoading.current) {
      wasLoading.current = false;
      Swal.close();
    }
  }, [isPending]);

  useEffect(() => {
    if (Swal.isLoading()) Swal.close();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget);
    if (submitter?.name && submitter?.value) {
      formData.set(submitter.name, submitter.value);
    }

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
      if (typeof action === "function") {
        startTransition(async () => {
          await (action as (fd: FormData) => Promise<void>)(formData);
        });
      }
    }
  }

  return (
    <form {...rest} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
