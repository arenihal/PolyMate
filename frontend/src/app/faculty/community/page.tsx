"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  CheckCircle2,
  Clock,
  RefreshCw,
  Upload,
  Bell,
  XCircle,
} from "lucide-react";

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://polymate-1.onrender.com"
).replace(/\/+$/, "");

type RequestItem = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  branch: string;
  semester: number;
  subject_name: string;
  material_type: string;
  status: string;
  offer_status: string;
  forwarded_at: string;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type Material = {
  id: string;
  title: string;
  branch: string;
  semester: number;
  subject_name: string;
  material_type: string;
};

export default function FacultyCommunityPage() {

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState(0);
  const [tab, setTab] = useState("offered");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  const api = useCallback(async (
    path: string,
    options: RequestInit = {}
  ) => {

    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please sign in again.");
    }

    const token = await user.getIdToken();

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;

  }, []);

  const load = useCallback(async () => {

    try {

      const [requestData, notificationData, materialData] =
        await Promise.all([
          api("/api/faculty/community/requests"),
          api("/api/faculty/community/notifications"),
          api("/api/faculty/materials"),
        ]);

      setRequests(requestData.requests || []);
      setNotifications(notificationData.notifications || []);
      setUnread(notificationData.unread_count || 0);
      setMaterials(materialData.materials || []);

    } catch (err) {

      setError(
        err instanceof Error ? err.message : "Unable to load requests."
      );

    } finally {

      setLoading(false);

    }

  }, [api]);

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) void load();
      else setLoading(false);
    });

    const timer = window.setInterval(() => {
      if (auth.currentUser && !document.hidden) {
        void load();
      }
    }, 30000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };

  }, [load]);

  async function respond(id: string, action: string) {

    setBusy(id);
    setError("");
    setSuccess("");

    try {

      await api(
        `/api/faculty/community/requests/${id}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ action }),
        }
      );

      setSuccess(
        action === "accept"
          ? "Request accepted successfully."
          : "Request declined."
      );

      if (action === "accept") {
        setTab("accepted");
      }

      await load();

    } catch (err) {

      setError(
        err instanceof Error ? err.message : "Unable to respond."
      );

      await load();

    } finally {

      setBusy("");

    }

  }

  async function complete(id: string) {

    const materialId = selected[id];

    if (!materialId) return;

    setBusy(id);
    setError("");
    setSuccess("");

    try {

      await api(
        `/api/faculty/community/requests/${id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            material_id: materialId,
          }),
        }
      );

      setSuccess("Request completed successfully.");
      setTab("completed");

      await load();

    } catch (err) {

      setError(
        err instanceof Error ? err.message : "Unable to complete request."
      );

    } finally {

      setBusy("");

    }

  }

  async function markAllRead() {

    try {

      await api(
        "/api/faculty/community/notifications/read-all",
        { method: "PATCH" }
      );

      await load();

    } catch (err) {

      setError(
        err instanceof Error ? err.message : "Unable to mark notifications."
      );

    }

  }

  const tabs = [
    { id: "offered", label: "New Requests" },
    { id: "accepted", label: "Accepted" },
    { id: "completed", label: "Completed" },
    { id: "closed", label: "Closed" },
  ];

  const visible = requests.filter((item) =>
    tab === "closed"
      ? ["declined", "withdrawn"].includes(item.offer_status)
      : item.offer_status === tab
  );

  return (

    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-[#101827] dark:text-white">

      <div className="mx-auto max-w-6xl space-y-6">

        <header className="flex flex-wrap items-center justify-between gap-4">

          <div>

            <Link
              href="/faculty/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm text-blue-600"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </Link>

            <h1 className="text-2xl font-bold">
              Student Requests
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage material requests forwarded by Admin.
            </p>

          </div>

          <div className="flex gap-2">

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#1C2739]"
            >
              <Bell size={21} />

              {unread > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
                  {unread}
                </span>
              )}

            </button>

            <button
              onClick={() => void load()}
              className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#1C2739]"
            >
              <RefreshCw size={21} />
            </button>

          </div>

        </header>

        {error && (
          <p role="alert" className="rounded-xl bg-red-100 p-4 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="rounded-xl bg-green-100 p-4 text-sm text-green-700">
            {success}
          </p>
        )}

        {showNotifications && (

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1C2739]">

            <div className="flex items-center justify-between">

              <h2 className="font-bold">Notifications</h2>

              <button
                onClick={() => void markAllRead()}
                className="text-sm text-blue-600"
              >
                Mark all as read
              </button>

            </div>

            {notifications.length === 0 && (
              <p className="text-sm text-slate-500">
                No notifications.
              </p>
            )}

            {notifications.map((item) => (

              <div
                key={item.id}
                className={`rounded-xl border border-slate-200 p-3 dark:border-slate-700 ${
                  item.is_read ? "" : "bg-blue-50 dark:bg-blue-950"
                }`}
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm">{item.message}</p>
              </div>

            ))}

          </section>

        )}

        <div className="grid grid-cols-3 gap-3">

          {[
            {
              label: "New",
              value: requests.filter(r => r.offer_status === "offered").length,
              icon: ClipboardList,
            },
            {
              label: "Accepted",
              value: requests.filter(r => r.offer_status === "accepted").length,
              icon: Clock,
            },
            {
              label: "Completed",
              value: requests.filter(r => r.offer_status === "completed").length,
              icon: CheckCircle2,
            },
          ].map((item) => (

            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1C2739]"
            >
              <item.icon size={21} className="mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>

          ))}

        </div>

        <div className="flex flex-wrap gap-2">

          {tabs.map((item) => (

            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                tab === item.id
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1C2739]"
              }`}
            >
              {item.label}
            </button>

          ))}

        </div>

        {loading ? (

          <p className="py-12 text-center text-slate-500">
            Loading requests...
          </p>

        ) : visible.length === 0 ? (

          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-[#1C2739]">
            <ClipboardList size={38} className="mx-auto mb-3 text-slate-400" />
            <h2 className="font-semibold">No requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Requests forwarded by Admin will appear here.
            </p>
          </div>

        ) : visible.map((item) => {

          const matching = materials.filter((material) =>
            material.branch === item.branch &&
            Number(material.semester) === Number(item.semester) &&
            material.subject_name === item.subject_name &&
            material.material_type === item.material_type
          );

          return (

            <article
              key={item.id}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1C2739]"
            >

              <div className="flex flex-wrap justify-between gap-2">

                <div>

                  <p className="text-xs font-medium text-blue-600">
                    {item.ticket_number}
                  </p>

                  <h2 className="mt-1 text-lg font-bold">
                    {item.title}
                  </h2>

                </div>

                <span className="h-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                  {item.offer_status === "offered" ? "New" : item.offer_status}
                </span>

              </div>

              <p className="text-sm text-slate-500">
                {item.branch} | Semester {item.semester} | {item.material_type}
              </p>

              <p className="text-sm font-medium">
                Subject: {item.subject_name}
              </p>

              <p className="whitespace-pre-wrap text-sm">
                {item.description}
              </p>

              {item.offer_status === "offered" && (

                <div className="flex flex-wrap gap-3">

                  <button
                    disabled={!!busy}
                    onClick={() => void respond(item.id, "accept")}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 size={17} />
                    Accept Request
                  </button>

                  <button
                    disabled={!!busy}
                    onClick={() => void respond(item.id, "decline")}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm text-red-600 disabled:opacity-50"
                  >
                    <XCircle size={17} />
                    Decline
                  </button>

                </div>

              )}

              {item.offer_status === "accepted" && (

                <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-[#172B4C]">

                  <h3 className="font-semibold">
                    Fulfil Material Request
                  </h3>

                  <Link
                    href="/faculty/upload"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    <Upload size={17} />
                    Upload PDF
                  </Link>

                  <p className="text-xs text-slate-500">
                    Upload the requested material, return here and refresh.
                    Select the matching material to complete this request.
                  </p>

                  <select
                    value={selected[item.id] || ""}
                    onChange={(event) =>
                      setSelected(current => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-[#17243B]"
                  >

                    <option value="">
                      Select matching material
                    </option>

                    {matching.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.title}
                      </option>
                    ))}

                  </select>

                  <button
                    disabled={!!busy || !selected[item.id]}
                    onClick={() => void complete(item.id)}
                    className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Complete Request
                  </button>

                </div>

              )}

            </article>

          );

        })}

      </div>

    </main>

  );

}

