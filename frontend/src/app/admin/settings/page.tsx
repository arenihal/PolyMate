import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SettingsClient from "./SettingsClient";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link
          href="/admin/dashboard"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
      </div>

      <SettingsClient />
    </div>
  );
}
