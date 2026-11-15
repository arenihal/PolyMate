"use client";

import { useState } from "react";
import { Flag, X, Loader2, CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { PDF_API_BASE } from "@/lib/secure-pdf";

const REASONS = [
  "Wrong PDF",
  "Incorrect subject or semester",
  "Incomplete notes",
  "PDF not opening",
  "Poor quality",
  "Other",
];

type Props = {
  materialId: string;
  title: string;
};

export default function ReportMaterialButton({
  materialId,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function openDialog() {
    setReason("");
    setDetails("");
    setError("");
    setSuccess(false);
    setOpen(true);
  }

  async function submitReport() {
    if (!reason || busy) return;

    setBusy(true);
    setError("");

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `${PDF_API_BASE.replace(/\/$/, "")}/api/student/materials/${encodeURIComponent(materialId)}/report`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason, details }),
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to submit report."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit report."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`Report ${title}`}
        className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Flag size={19} />
        <span className="text-[10px] font-medium sm:text-[11px]">
          Report
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report PDF"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#30415D] dark:bg-[#0F1D38]">

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-3 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  <Flag size={23} />
                </div>

                <div>
                  <h2 className="text-lg font-bold">
                    Report PDF
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send an issue to the uploading faculty.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                aria-label="Close report"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <CheckCircle2
                  size={44}
                  className="mx-auto mb-4 text-green-600"
                />
                <h3 className="font-semibold">
                  Report submitted successfully
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Your report has been sent to the uploading
                  faculty. You will receive their response
                  after the report is resolved.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitReport();
                }}
              >
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#17243B]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selected material
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {title}
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    Reason for reporting
                  </span>

                  <select
                    required
                    value={reason}
                    disabled={busy}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Select a reason</option>

                    {REASONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">
                    Additional details (optional)
                  </span>

                  <textarea
                    value={details}
                    disabled={busy}
                    maxLength={1000}
                    rows={4}
                    onChange={(event) =>
                      setDetails(event.target.value)
                    }
                    placeholder="Describe the issue..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />

                  <span className="block text-right text-xs text-slate-400">
                    {details.length}/1000
                  </span>
                </label>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only the uploading faculty will receive
                  your report.
                </p>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium dark:border-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!reason || busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    {busy ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}