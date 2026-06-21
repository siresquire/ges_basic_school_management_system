"use client";

import { useRef } from "react";

/**
 * A GET filter form whose linked menus react to each other: changing any
 * select or date input reloads the page with the new filters immediately —
 * no separate "Load" button needed. Text inputs still submit normally
 * (Enter key or a submit button) so typing isn't interrupted.
 */
export default function FilterForm({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      method="get"
      className={className}
      onChange={(e) => {
        const target = e.target as unknown as HTMLElement;
        if (
          target.tagName === "SELECT" ||
          (target instanceof HTMLInputElement && target.type === "date")
        ) {
          ref.current?.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}
