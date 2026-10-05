/**
 * Build an absolute backend API URL.
 *
 * WHY THIS EXISTS
 * ---------------
 * The student portal authenticates with an HttpOnly `candidate_session` cookie
 * that is SET BY THE BACKEND DOMAIN (ai-interview-system-eewl.vercel.app) with
 * SameSite=None; Secure.
 *
 * A relative request (e.g. `/api/student/me`) is sent to the FRONTEND origin
 * (ai-interview-system-dqc9.vercel.app). The browser does NOT attach the
 * backend-domain cookie to that request, and the Next.js rewrite proxy is
 * server-side, so the backend never receives it -> 401.
 *
 * This is exactly why every working student call in this app uses the
 * ABSOLUTE backend URL. Interview scheduling must do the same.
 *
 * In local development there is no cross-origin problem, so a relative URL is
 * used there to keep cookies working through the Next.js rewrite.
 */
export function backendApiUrl(path: string): string {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "https://ai-interview-system-eewl.vercel.app";

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${backendUrl.replace(/\/+$/, "")}${normalizedPath}`;
}

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
