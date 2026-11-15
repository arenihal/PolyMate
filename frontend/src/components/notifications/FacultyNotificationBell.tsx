"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://polymate-1.onrender.com"
).replace(/\/+$/, "");

type Notification = {
  id: string;
  request_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function FacultyNotificationBell() {

  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {

    const user = auth.currentUser;

    if (!user) return;

    try {

      const token = await user.getIdToken();

      const response = await fetch(
        `${API}/api/faculty/community/notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load notifications."
        );
      }

      if (auth.currentUser?.uid !== user.uid) return;

      setItems(data.notifications || []);
      setUnread(data.unread_count || 0);
      setError("");

    } catch (err) {

      if (auth.currentUser?.uid === user.uid) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load notifications."
        );
      }

    } finally {

      if (auth.currentUser?.uid === user.uid) {
        setLoading(false);
      }

    }

  }, []);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, (user) => {

      setItems([]);
      setUnread(0);
      setError("");

      if (user) {
        setLoading(true);
        void load();
      } else {
        setLoading(false);
      }

    });

    const timer = window.setInterval(() => {
      if (auth.currentUser && !document.hidden) {
        void load();
      }
    }, 30000);

    const refresh = () => {
      if (!document.hidden) void load();
    };

    window.addEventListener("focus", refresh);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };

  }, [load]);

  async function markRead(id?: string) {

    const user = auth.currentUser;

    if (!user) return;

    try {

      const token = await user.getIdToken();

      const path = id
        ? `/api/faculty/community/notifications/${encodeURIComponent(id)}/read`
        : "/api/faculty/community/notifications/read-all";

      const response = await fetch(`${API}${path}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to update notification.");
      }

      await load();

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update notification."
      );

    }

  }

  return (

    <div className="relative">

      <button
        type="button"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#17243B] dark:text-white"
      >

        <Bell size={21} />

        {unread > 0 && (

          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>

        )}

      </button>

      {open && (

        <>

          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <section className="fixed inset-x-3 top-20 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#17243B] sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-96">

            <header className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">

              <div>
                <h2 className="font-bold">
                  Notifications
                </h2>

                <p className="text-xs text-slate-500">
                  {unread} unread notifications
                </p>
              </div>

              <button
                type="button"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>

            </header>

            <div className="max-h-80 overflow-y-auto">

              {error && (
                <p role="alert" className="p-4 text-sm text-red-600">
                  {error}
                </p>
              )}

              {loading && (
                <p className="p-6 text-center text-sm text-slate-500">
                  Loading notifications...
                </p>
              )}

              {!loading && !error && items.length === 0 && (

                <div className="p-8 text-center">

                  <Bell
                    size={32}
                    className="mx-auto mb-3 text-slate-400"
                  />

                  <p className="font-medium">
                    No notifications
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Requests forwarded by Admin will appear here.
                  </p>

                </div>

              )}

              {items.map((item) => (

                <button
                  type="button"
                  key={item.id}
                  onClick={() => void markRead(item.id)}
                  className={`block w-full border-b border-slate-100 p-4 text-left dark:border-slate-700 ${
                    item.is_read
                      ? ""
                      : "bg-blue-50 dark:bg-blue-950"
                  }`}
                >

                  <div className="flex items-start gap-2">

                    {!item.is_read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}

                    <div className="min-w-0">

                      <p className="text-sm font-semibold">
                        {item.title}
                      </p>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.message}
                      </p>

                      <p className="mt-2 text-[11px] text-slate-400">
                        {new Date(item.created_at).toLocaleString("en-IN")}
                      </p>

                    </div>

                  </div>

                </button>

              ))}

            </div>

            <footer className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">

              {unread > 0 && (

                <button
                  type="button"
                  onClick={() => void markRead()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 p-2.5 text-sm font-medium text-blue-600 dark:border-blue-800"
                >
                  <CheckCheck size={17} />
                  Mark all as read
                </button>

              )}

              <Link
                href="/faculty/community"
                onClick={() => setOpen(false)}
                className="block w-full rounded-xl bg-[#1746A2] p-3 text-center text-sm font-semibold text-white"
              >
                Open Student Requests
              </Link>

            </footer>

          </section>

        </>

      )}

    </div>

  );

}

