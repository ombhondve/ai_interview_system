"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Search,
  MessageCircle,
  Mail,
  Smartphone,
  Monitor,
  CheckCircle2,
  Clock3,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

type Notification = {
  id: string;
  recipient: string;
  candidate: string;
  message: string;
  channel: "WhatsApp" | "Email" | "SMS" | "System";
  timestamp: string;
  status: "Pending" | "Sent" | "Delivered" | "Failed";
};

const notifications: Notification[] = [
  {
    id: "NTF-001",
    recipient: "Rahul Sharma",
    candidate: "Rahul Sharma",
    message: "Your interview report is ready for admin review.",
    channel: "WhatsApp",
    timestamp: "Today, 10:42 AM",
    status: "Delivered",
  },
  {
    id: "NTF-002",
    recipient: "Priya Patil",
    candidate: "Priya Patil",
    message: "Your interview has been scheduled for September 20.",
    channel: "Email",
    timestamp: "Today, 09:31 AM",
    status: "Sent",
  },
  {
    id: "NTF-003",
    recipient: "Amit Joshi",
    candidate: "Amit Joshi",
    message: "Please select an available interview slot.",
    channel: "WhatsApp",
    timestamp: "Yesterday, 05:18 PM",
    status: "Delivered",
  },
  {
    id: "NTF-004",
    recipient: "Sneha More",
    candidate: "Sneha More",
    message: "Interview reminder: your interview is tomorrow.",
    channel: "SMS",
    timestamp: "Yesterday, 04:05 PM",
    status: "Pending",
  },
  {
    id: "NTF-005",
    recipient: "Aditya Kulkarni",
    candidate: "Aditya Kulkarni",
    message: "Your resume could not be processed. Please contact support.",
    channel: "System",
    timestamp: "Sep 15, 2026",
    status: "Failed",
  },
  {
    id: "NTF-006",
    recipient: "Rahul Sharma",
    candidate: "Rahul Sharma",
    message: "Your application has been approved for the next stage.",
    channel: "WhatsApp",
    timestamp: "Sep 14, 2026",
    status: "Delivered",
  },
];

export default function NotificationsPage() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("All");
  const [status, setStatus] = useState("All");

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const query = search.toLowerCase();

      const matchesSearch =
        notification.recipient.toLowerCase().includes(query) ||
        notification.candidate.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query);

      const matchesChannel =
        channel === "All" || notification.channel === channel;

      const matchesStatus =
        status === "All" || notification.status === status;

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [search, channel, status]);

  const delivered = notifications.filter(
    (notification) => notification.status === "Delivered"
  ).length;

  const pending = notifications.filter(
    (notification) => notification.status === "Pending"
  ).length;

  const failed = notifications.filter(
    (notification) => notification.status === "Failed"
  ).length;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Bell size={16} />
              System
            </div>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Notifications
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track messages and system notifications sent to candidates.
            </p>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NotificationStat
            icon={<CheckCircle2 size={19} />}
            label="Delivered"
            value={delivered}
            type="success"
          />

          <NotificationStat
            icon={<Clock3 size={19} />}
            label="Pending"
            value={pending}
            type="warning"
          />

          <NotificationStat
            icon={<AlertCircle size={19} />}
            label="Failed"
            value={failed}
            type="danger"
          />
        </div>

        {/* Filters */}
        <section className="surface rounded-2xl border p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#10141d]"
              />
            </div>

            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option>All</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>SMS</option>
              <option>System</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#10141d]"
            >
              <option>All</option>
              <option>Pending</option>
              <option>Sent</option>
              <option>Delivered</option>
              <option>Failed</option>
            </select>
          </div>
        </section>

        {/* Notifications */}
        <section className="surface overflow-hidden rounded-2xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.02]">
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recipient
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Candidate
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Message
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Channel
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Timestamp
                  </th>
                  <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredNotifications.map((notification) => (
                  <tr
                    key={notification.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                          <Bell size={16} />
                        </div>

                        <span className="text-sm font-medium text-slate-800 dark:text-white">
                          {notification.recipient}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {notification.candidate}
                    </td>

                    <td className="max-w-[350px] px-4 py-4">
                      <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                        {notification.message}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <ChannelBadge channel={notification.channel} />
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-500">
                      {notification.timestamp}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={notification.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredNotifications.length === 0 && (
            <div className="p-12 text-center">
              <Bell className="mx-auto text-slate-400" size={35} />

              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                No notifications found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters or search query.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ChannelBadge({
  channel,
}: {
  channel: Notification["channel"];
}) {
  const config = {
    WhatsApp: {
      icon: <MessageCircle size={14} />,
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    Email: {
      icon: <Mail size={14} />,
      className:
        "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    },
    SMS: {
      icon: <Smartphone size={14} />,
      className:
        "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
    },
    System: {
      icon: <Monitor size={14} />,
      className:
        "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
    },
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config[channel].className}`}
    >
      {config[channel].icon}
      {channel}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: Notification["status"];
}) {
  const styles = {
    Pending:
      "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    Sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    Delivered:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    Failed: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function NotificationStat({
  icon,
  label,
  value,
  type,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  type: "success" | "warning" | "danger";
}) {
  const styles = {
    success:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    warning:
      "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    danger:
      "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  };

  return (
    <div className="surface rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[type]}`}
        >
          {icon}
        </div>

        <span className="text-2xl font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}

