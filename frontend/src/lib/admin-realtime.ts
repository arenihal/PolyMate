import { realtimeSupabase } from "@/lib/pdf-realtime";

export function subscribeToFacultyApprovals(
  onUpdate: () => void
) {
  if (!realtimeSupabase) {
    return () => {};
  }

  const channel = realtimeSupabase
    .channel("polymate-admin-updates")
    .on(
      "broadcast",
      { event: "faculty_registered" },
      () => onUpdate()
    )
    .on(
      "broadcast",
      { event: "approval_updated" },
      () => onUpdate()
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onUpdate();
      }
    });

  return () => {
    void realtimeSupabase?.removeChannel(channel);
  };
}
