"use client";

import { useFormDraft } from "./use-form-draft";
import DraftBanner from "./draft-banner";

/**
 * A <form> that autosaves what's typed to the device and offers to restore it
 * after a dropped connection or refresh. For ordinary server-action forms that
 * redirect on success (student, teacher, attendance, remarks). The draft is
 * cleared automatically once the server re-renders with the saved values.
 */
export default function DraftForm({
  draftKey,
  action,
  className,
  children,
}: {
  draftKey: string;
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const { formRef, hasPendingDraft, onChange, restore, discard } = useFormDraft(draftKey);

  return (
    <div className="space-y-3">
      {hasPendingDraft && <DraftBanner onRestore={restore} onDiscard={discard} />}
      <form
        ref={formRef}
        action={action}
        onChange={onChange}
        onInput={onChange}
        className={className}
      >
        {children}
      </form>
    </div>
  );
}
