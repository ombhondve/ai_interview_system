// =====================================================
// API CONFIGURATION
// =====================================================

const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";


// =====================================================
// API URL
// =====================================================

export function apiUrl(
  path: string
): string {
  /*
   * If an absolute URL is provided,
   * use it directly.
   */

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  /*
   * All application API requests now go
   * through the existing Express backend.
   *
   * Examples:
   *
   * /api/projects
   *      ↓
   * http://localhost:5000/api/projects
   *
   * /api/candidates
   *      ↓
   * http://localhost:5000/api/candidates
   *
   * /api/candidates/123/project
   *      ↓
   * http://localhost:5000/api/candidates/123/project
   */

  return `${BACKEND_API_URL}${path}`;
}


// =====================================================
// REQUEST
// =====================================================

export async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {

  const response =
    await fetch(
      apiUrl(url),
      {
        ...options,

        /*
         * Send cookies with requests.
         *
         * This is important if your backend
         * authentication uses cookies.
         */

        credentials:
          "include",

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {}),
        },

        /*
         * Always request fresh API data.
         */

        cache:
          "no-store",
      }
    );


  // ===================================================
  // READ RESPONSE
  // ===================================================

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );


  // ===================================================
  // HANDLE ERROR
  // ===================================================

  if (!response.ok) {

    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }


  // ===================================================
  // RETURN DATA
  // ===================================================

  return data as T;
}