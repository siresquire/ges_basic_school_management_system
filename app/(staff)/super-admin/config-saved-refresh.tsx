"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast-provider";

export function ConfigSavedRefresh({ triggered }: { triggered: boolean }) {
  const { show } = useToast();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (triggered && !done.current) {
      done.current = true;
      show("Configuration saved.");
      router.refresh();
      const url = new URL(window.location.href);
      url.searchParams.delete("saved");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
  }, [triggered, router, show]);

  return null;
}
