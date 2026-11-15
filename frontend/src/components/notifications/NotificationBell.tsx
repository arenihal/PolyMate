"use client";

import { useEffect, useState } from "react";
import { Bell, FileText } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PDF_API_BASE } from "@/lib/secure-pdf";
import { subscribeToNewPDF } from "@/lib/pdf-realtime";

type Notification = {
  id: string;
  title: string;
  subject_name: string;
  branch: string;
  semester: number;
  material_type: string;
  created_at: string;
  is_read: boolean;
};

type Props = {
  onOpenPDF: (material: Notification) => void;
  onNewPDF: () => void;
};

async function request(path: string, method = "GET") {
  const user = auth.currentUser;

  if (!user) throw new Error("Please sign in.");

  const token = await user.getIdToken();

  const response = await fetch(
    `${PDF_API_BASE.replace(/\/$/, "")}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Notification API: ${response.status}`);
  }

  return response.json();
}

export default function NotificationBell({
  onOpenPDF,
  onNewPDF,
}: Props) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      const data = await request(
        "/api/student/notifications"
      );

      setItems(data.notifications ?? []);
      setUnread(data.unread_count ?? 0);
      setError("");
    } catch {
      setError("Unable to load notifications.");
    }
  }

  useEffect(() => {
    let unsubscribeRealtime = () => {};

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribeRealtime();

        if (!user) {
          setItems([]);
          setUnread(0);
          return;
        }

        void loadNotifications();

        unsubscribeRealtime = subscribeToNewPDF(
          () => {
            void loadNotifications();
            onNewPDF();
          }
        );
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeRealtime();
    };
  }, [onNewPDF]);

  async function markAllRead() {
    try {
      await request(
        "/api/student/notifications/read-all",
        "POST"
      );

      await loadNotifications();
    } catch {
      setError("Unable to mark notifications as read.");
    }
  }

  async function openNotification(item: Notification) {
    try {
      await request(
        `/api/student/notifications/${item.id}/read`,
        "POST"
      );

      setOpen(false);
      onOpenPDF(item);
      await loadNotifications();
    } catch {
      setError("Unable to open notification.");
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
          if (!open) void loadNotifications();
        }}
        className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      >
        <Bell size={21} />

        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-20 z-50 w-[calc(100vw-24px)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:right-0 sm:top-12 sm:w-96">

          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
            <h3 className="font-bold">
              Notifications
            </h3>

            <button
              onClick={markAllRead}
              className="text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">

            {error && (
              <p className="p-4 text-sm text-red-500">
                {error}
              </p>
            )}

            {!error && items.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-500">
                No new notifications
              </p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => openNotification(item)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left dark:border-slate-800 ${
                  item.is_read
                    ? ""
                    : "bg-blue-50 dark:bg-blue-950/30"
                }`}
              >
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <FileText size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    New PDF Uploaded
                  </p>

                  <p className="mt-1 text-sm">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.branch} · Semester {item.semester}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(item.created_at).toLocaleString("en-IN")}
                  </p>
                </div>

                {!item.is_read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
