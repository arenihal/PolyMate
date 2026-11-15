const STORAGE_KEY = "polymate_shared_material";

const MATERIAL_PATH =
  /^\/student\/materials\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export function rememberSharedMaterial(path: string) {
  if (typeof window === "undefined") return;

  if (!MATERIAL_PATH.test(path)) return;

  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        path,
        expiresAt: Date.now() + EXPIRY_MS,
      })
    );
  } catch {
    // Storage may be unavailable in some browsers.
  }
}

export function getSharedMaterialRedirect(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const data = JSON.parse(raw);

    if (
      typeof data.path !== "string" ||
      !MATERIAL_PATH.test(data.path) ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt < Date.now()
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data.path;
  } catch {
    return null;
  }
}

export function clearSharedMaterialRedirect() {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
}

export function getPostLoginPath(
  role: string,
  dashboardPath: string
): string {
  const destination = getSharedMaterialRedirect();

  clearSharedMaterialRedirect();

  if (role === "student" && destination) {
    return destination;
  }

  return dashboardPath;
}