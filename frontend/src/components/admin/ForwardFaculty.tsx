"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Send, Users, Loader2 } from "lucide-react";

const API = (
  process.env.NEXT_PUBLIC_API_URL ||
  "https://polymate-1.onrender.com"
).replace(/\/+$/, "");

type Faculty = {
  uid: string;
  full_name: string;
  branch: string;
  institution_name: string;
  approval_status: string;
  status: string;
  email_verified: boolean;
  material_branches?: string[];
};

type Props = {
  requestId: string;
  branch: string | null;
  onForwarded: () => void;
};

export default function ForwardFaculty({
  requestId,
  branch,
  onForwarded,
}: Props) {

  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [sameBranch, setSameBranch] = useState(true);

  useEffect(() => {
    setSelected([]);
    setOpen(false);
    setError("");
    setSuccess("");
    setSearch("");
  }, [requestId]);

  async function loadFaculty() {

    setOpen(true);
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `${API}/api/admin/faculty`,
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
          data.error || "Unable to load faculty."
        );
      }

      const rows: Faculty[] = Array.isArray(data.faculty)
        ? data.faculty
        : [];

      setFaculty(
        rows.filter(
          (item) =>
            item.approval_status === "approved" &&
            item.status === "active" &&
            item.email_verified === true
        )
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load faculty."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleFaculty(uid: string) {

    setSelected((current) =>
      current.includes(uid)
        ? current.filter((item) => item !== uid)
        : current.length < 50
          ? [...current, uid]
          : current
    );
  }

  async function forwardRequest() {

    if (!selected.length || sending) return;

    setSending(true);
    setError("");
    setSuccess("");

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `${API}/api/admin/community/requests/${encodeURIComponent(requestId)}/forward`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            faculty_uids: selected,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to forward request."
        );
      }

      setSuccess(
        data.forwarded_count > 0
          ? `Request forwarded to ${data.forwarded_count} faculty member(s).`
          : "Request was already forwarded to the selected faculty."
      );

      setSelected([]);
      setOpen(false);

      onForwarded();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to forward request."
      );
    } finally {
      setSending(false);
    }
  }

  const requestedBranch = (branch || "").toUpperCase();

  const visibleFaculty = faculty.filter((item) => {

    const branches = [
      item.branch,
      ...(item.material_branches || []),
    ].map((value) => (value || "").toUpperCase());

    const matchesBranch =
      !sameBranch ||
      !requestedBranch ||
      branches.includes(requestedBranch);

    const matchesSearch = [
      item.full_name,
      item.branch,
      item.institution_name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesBranch && matchesSearch;
  });

  return (
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-[#172B4C]">

      <div className="flex items-center gap-2">
        <Users size={20} className="text-blue-600" />

        <h3 className="font-semibold">
          Forward to Faculty
        </h3>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Send this material request to approved faculty members.
        The first faculty member who accepts will be assigned
        to complete it.
      </p>

      {!open && (
        <button
          type="button"
          disabled={sending}
          onClick={() => void loadFaculty()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={17} />
          Select Faculty
        </button>
      )}

      {success && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {success}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {open && (
        <div className="space-y-3">

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search faculty or college..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-600 dark:bg-[#17243B]"
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sameBranch}
              onChange={(event) =>
                setSameBranch(event.target.checked)
              }
            />
            Show matching branch faculty
          </label>

          <div className="max-h-72 space-y-2 overflow-y-auto">

            {loading ? (

              <div className="flex items-center justify-center gap-2 p-6 text-sm">
                <Loader2 size={20} className="animate-spin" />
                Loading faculty...
              </div>

            ) : visibleFaculty.length === 0 ? (

              <p className="p-4 text-center text-sm text-slate-500">
                No matching approved faculty found.
              </p>

            ) : (

              visibleFaculty.map((item) => (

                <label
                  key={item.uid}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#17243B]"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item.uid)}
                    disabled={sending}
                    onChange={() => toggleFaculty(item.uid)}
                    className="mt-1"
                  />

                  <div className="min-w-0 flex-1">

                    <p className="font-medium">
                      {item.full_name || "Faculty member"}
                    </p>

                    <p className="text-xs text-slate-500">
                      {item.branch || "Branch unavailable"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.institution_name}
                    </p>

                  </div>

                </label>

              ))

            )}

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <button
              type="button"
              disabled={
                sending || loading || selected.length === 0
              }
              onClick={() => void forwardRequest()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Send size={17} />
              )}

              {sending
                ? "Forwarding..."
                : `Approve & Forward (${selected.length})`}
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setOpen(false);
                setSelected([]);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-600"
            >
              Cancel
            </button>

          </div>

        </div>
      )}

    </section>
  );
}

