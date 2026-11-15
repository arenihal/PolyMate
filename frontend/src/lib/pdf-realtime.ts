import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realtimeSupabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export function subscribeToNewPDF(
  onNewPDF: () => void
) {
  if (!realtimeSupabase) {
    return () => {};
  }

  const channel = realtimeSupabase
    .channel("polymate-pdf-updates")
    .on(
      "broadcast",
      { event: "new_pdf" },
      () => {
        onNewPDF();
      }
    )
    .subscribe();

  return () => {
    void realtimeSupabase?.removeChannel(channel);
  };
}

