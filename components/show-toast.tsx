"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast, type ToastType } from "@/components/toast-provider";

export function ShowToast({
  message,
  type = "success",
}: {
  message: string;
  type?: ToastType;
}) {
  const { show } = useToast();
  const router = useRouter();

  useEffect(() => {
    show(message, type);
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.searchParams.delete("error");
    url.searchParams.delete("warn");
    router.replace(url.pathname + (url.search || ""), { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
