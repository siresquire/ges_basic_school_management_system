"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import Swal from "@/lib/swal";

// Closes the loading Swal as soon as the Server Action's pending state drops to false.
// Must live INSIDE the <form> so useFormStatus can see the form's submission state.
function SubmitWatcher() {
  const { pending } = useFormStatus();
  const prev = useRef(false);
  useEffect(() => {
    if (prev.current && !pending) Swal.close();
    prev.current = pending;
  }, [pending]);
  return null;
}

type Props = React.ComponentProps<"form"> & {
  loadingTitle?: string;
};

export function ProcessingForm({ loadingTitle = "Processing…", children, ...props }: Props) {
  function handleSubmit() {
    Swal.fire({
      title: loadingTitle,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  return (
    <form {...props} onSubmit={handleSubmit}>
      <SubmitWatcher />
      {children}
    </form>
  );
}
