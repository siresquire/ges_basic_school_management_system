/** Initials avatar, e.g. "Akosua Boateng" → AB. */
export default function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials =
    name
      .split(/\s+/)
      .filter((w) => /[a-z]/i.test(w[0] ?? ""))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "U";

  const sizeCls =
    size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  return (
    <span
      className={`flex ${sizeCls} shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white select-none`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
