"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { fetchSecurePDF, PDF_API_BASE } from "@/lib/secure-pdf";
import PDFViewer from "@/components/shared/PDFViewerDynamic";
import { notifySmartSync } from "@/lib/smart-sync";

type TrashMaterial = {
  id: string;
  title: string;
  branch: string;
  semester: number;
  subject_name: string;
  material_type: string;
  created_at: string;
  deleted_at: string | null;
};

const API =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:5000";

const typeLabels: Record<string, string> = {
  notes: "Subject Notes",
  "question-paper": "Question Paper",
  syllabus: "Syllabus",
  "lab-manual": "Lab Manual",
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export default function FacultyTrashPage() {
  const [materials, setMaterials] = useState<TrashMaterial[]>([]);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [semester, setSemester] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Please sign in again.");
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `${API}/api/faculty/materials/trash`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load Trash.");
      }

      if (auth.currentUser?.uid !== user.uid) return;

      setMaterials(
        Array.isArray(data.materials) ? data.materials : []
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load Trash."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        void loadTrash();
      } else {
        setMaterials([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [loadTrash]);

  const branches = useMemo(
    () => [...new Set(materials.map((m) => m.branch))].sort(),
    [materials]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return materials
      .filter((m) => {
        const matchesSearch = [
          m.title,
          m.subject_name,
          m.branch,
        ].join(" ").toLowerCase().includes(query);

        return (
          matchesSearch &&
          (branch === "all" || m.branch === branch) &&
          (semester === "all" || String(m.semester) === semester) &&
          (type === "all" || m.material_type === type)
        );
      })
      .sort((a, b) => {
        const aTime = new Date(a.deleted_at || 0).getTime();
        const bTime = new Date(b.deleted_at || 0).getTime();

        return sort === "newest"
          ? bTime - aTime
          : aTime - bTime;
      });
  }, [materials, search, branch, semester, type, sort]);

  async function restoreMaterial(material: TrashMaterial) {
    if (busyId) return;

    const confirmed = window.confirm(
      `Restore "${material.title}"?\n\n` +
      "This PDF will become available to students again."
    );

    if (!confirmed) return;

    setBusyId(material.id);
    setError("");
    setMessage("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Please sign in again.");

      const token = await user.getIdToken();

      const response = await fetch(
        `${API}/api/faculty/materials/${encodeURIComponent(material.id)}/restore`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to restore PDF.");
      }

      setMaterials((current) =>
        current.filter((item) => item.id !== material.id)
      );

      setMessage(`Restored "${material.title}" successfully.`);
      notifySmartSync();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Restore failed."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function previewMaterial(material: TrashMaterial) {
    if (busyId) return;

    setBusyId(material.id);
    setError("");

    try {
      const result = await fetchSecurePDF(
        `/api/faculty/materials/${encodeURIComponent(material.id)}/trash/preview`,
        material.title,
        PDF_API_BASE
      );

      setPreview(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to preview PDF."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/faculty/materials"
            aria-label="Back to My Materials"
            className="rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
              <Trash2 size={25} />
            </div>

            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Trash
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                View and restore removed study materials.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadTrash()}
          disabled={loading || busyId !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </header>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300">
        Trashed materials are hidden from students until restored.
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search trashed materials..."
            aria-label="Search trashed materials"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <select
          value={branch}
          onChange={(event) => setBranch(event.target.value)}
          aria-label="Filter branch"
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">All Branches</option>
          {branches.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <select
          value={semester}
          onChange={(event) => setSemester(event.target.value)}
          aria-label="Filter semester"
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">All Semesters</option>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <option key={item} value={String(item)}>
              Semester {item}
            </option>
          ))}
        </select>

        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Filter material type"
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="all">All Types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-500">
          {filtered.length} of {materials.length} trashed materials
        </span>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label="Sort trashed materials"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="newest">Newest removed first</option>
          <option value="oldest">Oldest removed first</option>
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={30} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Trash2 size={42} className="mx-auto mb-4 text-slate-400" />
          <h2 className="font-semibold">
            {materials.length === 0 ? "Trash is empty" : "No matching materials"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {materials.length === 0
              ? "No materials have been moved to Trash."
              : "Try changing your search or filters."}
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          {filtered.map((material) => (
            <article
              key={material.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="rounded-xl bg-red-50 p-3 text-red-600">
                  <FileText size={25} />
                </div>

                <div className="min-w-0">
                  <h2 className="break-words font-semibold">
                    {material.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {material.branch} · Semester {material.semester}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {material.subject_name} ·{" "}
                    {typeLabels[material.material_type] || material.material_type}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Moved to Trash: {formatDate(material.deleted_at)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Trashed
                </span>

                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void previewMaterial(material)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
                >
                  <Eye size={16} />
                  Preview
                </button>

                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void restoreMaterial(material)}
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300"
                >
                  {busyId === material.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Restore
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trashed PDF preview"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 sm:p-6"
        >
          <div className="flex h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-900 sm:h-[90dvh]">
            <header className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="min-w-0 truncate font-semibold">
                {preview.title}
              </h2>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </header>
            <PDFViewer url={preview.url} title={preview.title} />
          </div>
        </div>
      )}
    </main>
  );
}
