const API_BASE_URL = "/api";

export function apiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const target = path.startsWith("/")
    ? path
    : `/${path}`;

  if (target === "/api" || target.startsWith("/api/")) {
    return target;
  }

  return `${API_BASE_URL}${target}`;
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
      data?.message || `Request failed (${response.status})`
    );
  }

  return data as T;
}