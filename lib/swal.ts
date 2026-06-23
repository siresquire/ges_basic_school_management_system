import Swal from "sweetalert2";

/** Themed toast for success / error / warning notifications. */
export const SwalToast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3500,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

/** Themed confirmation dialog for destructive actions. */
export const SwalConfirm = Swal.mixin({
  confirmButtonColor: "#15803d",
  cancelButtonColor: "#6b7280",
  showCancelButton: true,
  reverseButtons: true,
  focusCancel: true,
});

export default Swal;
