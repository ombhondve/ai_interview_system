const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||process.env.BACKEND_URL ||
  "/api";

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = BACKEND_API_URL.replace(/\/+$/, "");
  const target = path.startsWith("/") ? path : "/" + path;
  if (base.endsWith("/api") && target.startsWith("/api/")) {
    return base + target.slice(4);
  }
  return base + target;
}

export async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(apiUrl(url), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.message || "Request failed (" + response.status + ")"
    );
  }
  return data as T;
}
