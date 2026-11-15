import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SettingsClient from "./SettingsClient";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex justify-start">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 text-base font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>
      </div>

      <SettingsClient />
    </div>
  );
}

