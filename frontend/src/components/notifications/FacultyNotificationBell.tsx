"use client";

import { useEffect, useState } from "react";
import { Bell, Flag, X, CheckCircle2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PDF_API_BASE } from "@/lib/secure-pdf";

type Report = {
  id: string;
  material_id: string;
  material_title: string;
  reason: string;
  details: string;
  status: "pending" | "resolved";
  faculty_response: string | null;
  faculty_read_at: string | null;
  created_at: string;
};

async function request(
  path: string,
  method = "GET",
  body?: object
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in again.");
  }

  const token = await user.getIdToken();

  const response = await fetch(
    `${PDF_API_BASE.replace(/\/$/, "")}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Unable to complete request."
    );
  }

  return data;
}

export default function FacultyNotificationBell() {
  const [reports, setReports] = useState<Report[]>([]);
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    const uid = auth.currentUser?.uid;

    if (!uid) return;

    try {
      const data = await request("/api/faculty/reports");

      if (auth.currentUser?.uid !== uid) return;

      setReports(data.reports ?? []);
      setPending(data.pending_count ?? 0);
      setError("");
    } catch {
      if (auth.currentUser?.uid === uid) {
        setError("Unable to load notifications.");
      }
    }
  }

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabase =
      url && key ? createClient(url, key) : null;

    let channel:
      ReturnType<NonNullable<typeof supabase>["channel"]>
      | null = null;

    let timer: number | undefined;

    function cleanup() {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }

      if (supabase && channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        cleanup();

        setReports([]);
        setPending(0);
        setSelected(null);
        setOpen(false);

        if (!user) return;

        void loadReports();

        if (supabase) {
          channel = supabase
            .channel("polymate-report-updates")
            .on(
              "broadcast",
              { event: "report_changed" },
              () => {
                void loadReports();
              }
            )
            .subscribe((status) => {
              if (status === "SUBSCRIBED") {
                void loadReports();
              }
            });
        }

        // Fallback if Realtime disconnects.
        timer = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            void loadReports();
          }
        }, 30000);
      }
    );

    function refreshOnFocus() {
      void loadReports();
    }

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      unsubscribe();
      cleanup();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  async function openReport(report: Report) {
    setSelected(report);
    setReply(report.faculty_response || "");
    setError("");
    setOpen(false);

    try {
      await request(
        `/api/faculty/reports/${report.id}/read`,
        "POST"
      );

      await loadReports();
    } catch {
      setError("Unable to mark report as read.");
    }
  }

  async function resolveReport() {
    if (!selected || !reply.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      await request(
        `/api/faculty/reports/${selected.id}/resolve`,
        "PATCH",
        { response: reply.trim() }
      );

      setSelected(null);
      setReply("");
      await loadReports();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to resolve report."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">

      <button
        type="button"
        aria-label={`Notifications, ${pending} pending reports`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void loadReports();
        }}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <Bell size={21} />

        {pending > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {pending > 99 ? "99+" : pending}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-20 z-50 w-[calc(100vw-24px)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:right-0 sm:top-12 sm:w-96">

          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-bold">
              Notifications
            </h3>

            <span className="text-xs font-medium text-slate-500">
              {pending} pending
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">

            {error && (
              <p className="p-4 text-sm text-red-500">
                {error}
              </p>
            )}

            {!error && reports.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                No notifications
              </p>
            )}

            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => void openReport(report)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                  !report.faculty_read_at
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : ""
                }`}
              >
                <div className="rounded-lg bg-red-50 p-2 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                  {report.status === "resolved" ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Flag size={20} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {report.status === "pending"
                      ? "New PDF Report"
                      : "Report Resolved"}
                  </p>

                  <p className="mt-1 break-words text-sm">
                    {report.material_title}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {report.reason}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(
                      report.created_at
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                {!report.faculty_read_at && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="View PDF report"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#0F1D38]">

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                View Report
              </h2>

              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
                aria-label="Close report"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={21} />
              </button>
            </div>

            <div className="mt-4 space-y-4">

              <div className="rounded-xl bg-slate-100 p-4 dark:bg-[#17243B]">
                <p className="text-xs text-slate-500">
                  Reported material
                </p>

                <p className="mt-1 break-words font-semibold">
                  {selected.material_title}
                </p>

                <a
                  href={`/faculty/materials?material=${encodeURIComponent(selected.material_id)}`}
                  className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Open Material
                </a>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Reason
                </p>
                <p className="mt-1 text-sm">
                  {selected.reason}
                </p>
              </div>

              {selected.details && (
                <div>
                  <p className="text-sm font-semibold">
                    Student Details
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500 dark:text-slate-400">
                    {selected.details}
                  </p>
                </div>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-semibold">
                  Faculty Response
                </span>

                <textarea
                  rows={4}
                  maxLength={2000}
                  value={reply}
                  disabled={
                    busy || selected.status === "resolved"
                  }
                  onChange={(event) =>
                    setReply(event.target.value)
                  }
                  placeholder="Explain how the issue was addressed..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>

              {error && (
                <p role="alert" className="text-sm text-red-500">
                  {error}
                </p>
              )}

              {selected.status === "pending" ? (
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => void resolveReport()}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Resolving..." : "Resolve Report"}
                </button>
              ) : (
                <p className="rounded-xl bg-green-50 p-3 text-center text-sm font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                  Report Resolved
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}