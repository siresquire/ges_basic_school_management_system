"use client";

import Swal from "@/lib/swal";

type Props = React.ComponentProps<"form"> & {
  loadingTitle?: string;
};

/**
 * Drop-in replacement for <form> on slow server actions that redirect.
 * Shows a SweetAlert2 loading spinner on submit so users know work is happening.
 * The popup closes automatically when the page navigates after the action.
 */
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
      {children}
    </form>
  );
}
