import { dataUrl } from "@/lib/images";
import { uploadTeacherSignature, removeTeacherSignature } from "@/app/(staff)/staff/actions";
import FileInput from "@/components/file-input";
import { ConfirmForm } from "@/components/confirm-form";

/** Upload/preview/remove a teacher's scanned signature (admin or the teacher themself). */
export default function SignatureCard({
  teacherId,
  asset,
}: {
  teacherId: string;
  asset: { bytes: Uint8Array; mime: string } | null;
}) {
  const url = dataUrl(asset);

  return (
    <div className="card p-6">
      <h2 className="mb-1 font-semibold text-gray-900">Scanned signature</h2>
      <p className="mb-4 text-xs text-gray-500">
        Appears above the “Class Teacher” line on report cards for this teacher&apos;s class.
        PNG, JPEG or WebP — a photo of the signature on white paper works fine.
      </p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Signature"
          className="mb-3 h-16 rounded-md border border-gray-200 bg-white object-contain p-1"
        />
      ) : (
        <p className="mb-3 text-sm text-gray-500">No signature uploaded yet.</p>
      )}
      <form action={uploadTeacherSignature.bind(null, teacherId)} className="space-y-2">
        <FileInput name="file" accept="image/png,image/jpeg,image/webp" />
        <button className="btn-primary btn-sm w-full">
          {url ? "Replace signature" : "Upload signature"}
        </button>
      </form>
      {url && (
        <ConfirmForm
          action={removeTeacherSignature.bind(null, teacherId)}
          className="mt-2"
          confirmTitle="Remove signature?"
          confirmText="The signature will no longer appear on report cards."
          confirmButtonText="Yes, remove it"
        >
          <button className="text-xs text-red-600 hover:underline cursor-pointer">
            Remove signature
          </button>
        </ConfirmForm>
      )}
    </div>
  );
}
