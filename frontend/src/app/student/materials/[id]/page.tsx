"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import {
  ArrowLeft,
  FileText,
  Eye,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import {
  fetchSecurePDF,
  PDF_API_BASE,
} from "@/lib/secure-pdf";

import PDFViewer from "@/components/shared/PDFViewerDynamic";

type Material = {
  id: string;
  title: string;
  subject_name: string;
  branch: string;
  semester: number;
  material_type: string;
};

export default function SharedMaterialPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");

  const [preview, setPreview] = useState<{
    title: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    const controller = new AbortController();

    async function loadMaterial() {
      setLoading(true);
      setError("");

      try {
        const user = auth.currentUser;

        if (!user) {
          throw new Error("Please sign in to view this material.");
        }

        const token = await user.getIdToken();

        const response = await fetch(
          `${PDF_API_BASE.replace(/\/$/, "")}/api/student/materials/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Material unavailable.");
        }

        if (active) {
          setMaterial(data.material);
        }

      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load material."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMaterial();

    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  async function openPDF() {
    if (!material || opening) return;

    setOpening(true);
    setError("");

    try {
      const result = await fetchSecurePDF(
        `/api/student/materials/${encodeURIComponent(material.id)}/preview`,
        material.title,
        PDF_API_BASE
      );

      setPreview(result);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open PDF."
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">

      <div className="mx-auto max-w-3xl space-y-6">

        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <ShieldCheck size={18} className="text-blue-600" />
          Secure Shared Material
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <Loader2 className="animate-spin text-blue-600" />
            Loading material...
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {!loading && material && (
          <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#30415D] dark:bg-[#0F1D38]">

            <div className="flex items-start gap-4">

              <span className="rounded-xl bg-red-50 p-4 text-red-500 dark:bg-red-950/40">
                <FileText size={30} />
              </span>

              <div className="min-w-0 flex-1">
                <h1 className="break-words text-xl font-bold">
                  {material.title}
                </h1>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {material.subject_name}
                </p>
              </div>

            </div>

            <div className="flex flex-wrap gap-2">

              <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {material.branch}
              </span>

              <span className="rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-[#17243B] dark:text-slate-300">
                Semester {material.semester}
              </span>

              <span className="rounded-md bg-slate-100 px-3 py-1 text-xs capitalize text-slate-600 dark:bg-[#17243B] dark:text-slate-300">
                {material.material_type.replace(/-/g, " ")}
              </span>

            </div>

            <button
              type="button"
              disabled={opening}
              onClick={() => void openPDF()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {opening
                ? <Loader2 size={20} className="animate-spin" />
                : <Eye size={20} />
              }

              {opening ? "Opening..." : "View PDF"}
            </button>

          </article>
        )}

        {preview && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950">

            <header className="flex items-center justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">

              <h2 className="truncate text-sm font-semibold">
                {preview.title}
              </h2>

              <button
                type="button"
                aria-label="Close PDF"
                onClick={() => setPreview(null)}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={22} />
              </button>

            </header>

            <div className="min-h-0 flex-1 overflow-auto">
              <PDFViewer
                url={preview.url}
                title={preview.title}
              />
            </div>

          </div>
        )}

      </div>

    </main>
  );
}