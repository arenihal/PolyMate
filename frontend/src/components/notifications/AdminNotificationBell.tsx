"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, UserPlus, CheckCircle2, ArrowRight } from "lucide-react";

type Props = {
  pending: number;
};

export default function AdminNotificationBell({
  pending,
}: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (
        container.current &&
        !container.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeEscape);

    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  return (
    <div ref={container} className="relative shrink-0">

      <button
        type="button"
        aria-label={`Notifications, ${pending} pending approvals`}
        aria-expanded={open}
        title="Notifications"
        onClick={() => setOpen(!open)}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <Bell size={21} strokeWidth={1.8} />

        {pending > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {pending > 99 ? "99+" : pending}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-20 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-96">

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div>
              <h3 className="text-base font-bold">
                Notifications
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Faculty approval requests
              </p>
            </div>

            {pending > 0 && (
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {pending} pending
              </span>
            )}
          </div>

          {pending > 0 ? (
            <div className="p-4">

              <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">

                <div className="shrink-0 rounded-lg bg-blue-100 p-2.5 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <UserPlus size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold">
                    New Faculty Approval Requests
                  </h4>

                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    {pending} faculty {pending === 1 ? "member is" : "members are"} awaiting your approval.
                  </p>

                  <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                    Pending Approval
                  </span>
                </div>
              </div>

              <Link
                href="/admin/faculty"
                onClick={() => setOpen(false)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Review Approval Requests
                <ArrowRight size={16} />
              </Link>

            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">

              <div className="rounded-full bg-slate-100 p-4 text-slate-400 dark:bg-slate-800">
                <CheckCircle2 size={30} />
              </div>

              <h4 className="mt-4 text-sm font-semibold">
                You are all caught up
              </h4>

              <p className="mt-2 text-xs text-slate-500">
                No pending faculty approval requests.
              </p>
            </div>
          )}

          <div className="border-t border-slate-200 px-5 py-3 text-center text-xs text-slate-400 dark:border-slate-700">
            PolyMate Admin Notifications
          </div>
        </div>
      )}
    </div>
  );
}
