import { apiUrl } from "@/lib/client";

export interface NotificationItem {
  _id: string;
  recipientId: string;
  recipientRole?: string;
  type: string;
  title: string;
  message: string;
  entityType?: "interview" | "candidate" | "project" | "team" | "system" | null;
  entityId?: string | null;
  actionUrl?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationFilterOptions {
  read?: boolean | "all";
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export async function fetchNotifications(
  options: NotificationFilterOptions = {}
): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (options.read !== undefined && options.read !== "all") {
    query.set("read", String(options.read));
  }
  if (options.type && options.type !== "all" && options.type !== "All") {
    query.set("type", options.type);
  }
  if (options.search) {
    query.set("search", options.search.trim());
  }
  if (options.page) {
    query.set("page", String(options.page));
  }
  if (options.limit) {
    query.set("limit", String(options.limit));
  }

  const res = await fetch(apiUrl(`/api/notifications?${query.toString()}`), {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load notifications.");
  }

  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(apiUrl("/api/notifications/unread-count"), {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    return 0;
  }

  const data = await res.json().catch(() => ({ unreadCount: 0 }));
  return data.unreadCount || 0;
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; notification?: NotificationItem }> {
  const res = await fetch(apiUrl(`/api/notifications/${notificationId}/read`), {
    method: "PATCH",
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to update notification.");
  }

  return res.json();
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; modifiedCount: number }> {
  const res = await fetch(apiUrl("/api/notifications/read-all"), {
    method: "PATCH",
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to mark all as read.");
  }

  return res.json();
}

export async function deleteNotification(
  notificationId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(apiUrl(`/api/notifications/${notificationId}`), {
    method: "DELETE",
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete notification.");
  }

  return res.json();
}
