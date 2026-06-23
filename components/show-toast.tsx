"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SwalToast } from "@/lib/swal";

export type ToastType = "success" | "error" | "warn";

const ICON: Record<ToastType, "success" | "error" | "warning"> = {
  success: "success",
  error: "error",
  warn: "warning",
};

export function ShowToast({
  message,
  type = "success",
}: {
  message: string;
  type?: ToastType;
}) {
  const router = useRouter();

  useEffect(() => {
    SwalToast.fire({ icon: ICON[type], title: message });
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.searchParams.delete("error");
    url.searchParams.delete("warn");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
