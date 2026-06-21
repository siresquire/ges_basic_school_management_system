"use client";

/** "Recovered unsaved entries" prompt shown when a device draft is found. */
export default function DraftBanner({
  onRestore,
  onDiscard,
}: {
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <span className="flex-1">
        We found entries you typed here earlier but didn&apos;t save (perhaps the connection
        dropped). Restore them?
      </span>
      <button type="button" onClick={onRestore} className="btn-primary btn-sm">
        Restore my entries
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="text-xs text-amber-700 underline-offset-2 hover:underline"
      >
        Discard
      </button>
    </div>
  );
}
