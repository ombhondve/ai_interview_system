"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  User,
  Bell,
  Settings as SettingsIcon,
  Users,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Shield,
  Mail,
  Clock3,
  Save,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  CalendarDays,
  Loader2,
  Upload,
  Trash,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/client";
import { publishAdminSync } from "@/lib/adminDataSync";
import { TeamManagementSection } from "@/components/settings/TeamManagementSection";

type AdminRole = "Super Admin" | "Recruiter";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "Active" | "Inactive";
  lastActive: string;
  joined: string;
};

const initialAdmins: AdminUser[] = [
  {
    id: "ADM-001",
    name: "Om Bhondve",
    email: "admin@recruitai.com",
    role: "Super Admin",
    status: "Active",
    lastActive: "Just now",
    joined: "Jan 12, 2026",
  },
  {
    id: "ADM-002",
    name: "Priya Patil",
    email: "priya@recruitai.com",
    role: "Recruiter",
    status: "Active",
    lastActive: "12 min ago",
    joined: "Mar 08, 2026",
  },
  {
    id: "ADM-003",
    name: "Amit Joshi",
    email: "amit@recruitai.com",
    role: "Recruiter",
    status: "Active",
    lastActive: "1 hour ago",
    joined: "Apr 21, 2026",
  },
  {
    id: "ADM-004",
    name: "Sneha More",
    email: "sneha@recruitai.com",
    role: "Recruiter",
    status: "Inactive",
    lastActive: "Sep 10, 2026",
    joined: "May 14, 2026",
  },
];

type Section =
  | "profile"
  | "notifications"
  | "preferences"
  | "team"
  | "calendar";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; googleAccountEmail?: string; calendarId?: string; connectedAt?: string; lastValidatedAt?: string }>({ connected: false });
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState("");

  const [admins, setAdmins] = useState(initialAdmins);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null);

  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    role: "Recruiter" as AdminRole,
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [notifications, setNotifications] = useState({
    newCandidate: true,
    interviewScheduled: true,
    reportReady: true,
    candidateUpdates: true,
    emailNotifications: true,
    browserNotifications: false,
  });

  const [preferences, setPreferences] = useState({
    timezone: "Asia/Kolkata",
    dateFormat: "DD MMM YYYY",
    firstDay: "Monday",
    compactTables: false,
  });

  const [saved, setSaved] = useState(false);

  const activeAdmins = admins.filter(
    (admin) => admin.status === "Active"
  ).length;

  const recruiterCount = admins.filter(
    (admin) => admin.role === "Recruiter"
  ).length;

  const openAddAdminModal = () => {
    setEditingAdmin(null);

    setAdminForm({
      name: "",
      email: "",
      role: "Recruiter",
      password: "",
    });

    setShowPassword(false);
    setShowAdminModal(true);
  };

  const openEditAdminModal = (admin: AdminUser) => {
    setEditingAdmin(admin);

    setAdminForm({
      name: admin.name,
      email: admin.email,
      role: admin.role,
      password: "",
    });

    setShowPassword(false);
    setShowAdminModal(true);
  };

  const handleSaveAdmin = () => {
    if (!adminForm.name.trim() || !adminForm.email.trim()) {
      return;
    }

    if (editingAdmin) {
      setAdmins((current) =>
        current.map((admin) =>
          admin.id === editingAdmin.id
            ? {
                ...admin,
                name: adminForm.name,
                email: adminForm.email,
                role: adminForm.role,
              }
            : admin
        )
      );
    } else {
      const newAdmin: AdminUser = {
        id: `ADM-${String(admins.length + 1).padStart(3, "0")}`,
        name: adminForm.name,
        email: adminForm.email,
        role: adminForm.role,
        status: "Active",
        lastActive: "Never",
        joined: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };

      setAdmins((current) => [...current, newAdmin]);
    }

    setShowAdminModal(false);
  };

  const toggleAdminStatus = (adminId: string) => {
    setAdmins((current) =>
      current.map((admin) =>
        admin.id === adminId
          ? {
              ...admin,
              status:
                admin.status === "Active" ? "Inactive" : "Active",
            }
          : admin
      )
    );
  };

  const handleDeleteAdmin = () => {
    if (!deleteAdmin) return;

    setAdmins((current) =>
      current.filter((admin) => admin.id !== deleteAdmin.id)
    );

    setDeleteAdmin(null);
  };

  const loadCalendarStatus = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/admin/google-calendar/status"), { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load Google Calendar status.");
      setCalendarStatus(data);
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calendar") === "connected") setCalendarNotice(data.connected ? "Google Calendar connected successfully." : "The connection could not be confirmed. Please retry.");
    } catch (error) {
      setCalendarNotice(error instanceof Error ? error.message : "Unable to load Google Calendar status.");
    }
  }, []);

  useEffect(() => { void loadCalendarStatus(); }, [loadCalendarStatus]);
  useEffect(() => {
    const outcome = searchParams.get("calendar");
    const reason = searchParams.get("reason");
    if (outcome === "connected") {
      setActiveSection("calendar");
      setCalendarNotice("Calendar authorization completed. Checking the saved connection…");
      void loadCalendarStatus();
    } else if (outcome === "error") {
      setActiveSection("calendar");
      setCalendarNotice(reason === "authorization_denied" ? "Google Calendar access was not granted." : "Calendar connection could not be verified. Please retry.");
    }
  }, [searchParams, loadCalendarStatus]);

  const connectCalendar = async () => {
    setCalendarBusy(true); setCalendarNotice("");
    try {
      const response = await fetch(apiUrl("/api/admin/google-calendar/connect"), { credentials: "include", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.authorizationUrl) throw new Error(data.message || "Unable to start Google Calendar connection.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setCalendarNotice(error instanceof Error ? error.message : "Unable to start Google Calendar connection.");
      setCalendarBusy(false);
    }
  };

  const disconnectCalendar = async () => {
    setCalendarBusy(true); setCalendarNotice("");
    try {
      const response = await fetch(apiUrl("/api/admin/google-calendar/disconnect"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to disconnect Google Calendar.");
      setCalendarStatus({ connected: false });
      setCalendarNotice(data.revocationPending ? "Disconnected locally. Google token revocation could not be confirmed." : "Google Calendar disconnected.");
    } catch (error) {
      setCalendarNotice(error instanceof Error ? error.message : "Unable to disconnect Google Calendar.");
    } finally { setCalendarBusy(false); }
  };

  const handleSaveSettings = () => {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <SettingsIcon size={16} />
            Administration
          </div>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your account, team access, notifications and application
            preferences.
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          {/* Settings Navigation */}
          <aside className="h-fit rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-sm">
            <SettingsNav
              icon={<User size={17} />}
              label="Profile"
              active={activeSection === "profile"}
              onClick={() => setActiveSection("profile")}
            />

            <SettingsNav
              icon={<CalendarDays size={17} />}
              label="Google Calendar"
              active={activeSection === "calendar"}
              onClick={() => setActiveSection("calendar")}
            />

            <SettingsNav
              icon={<Users size={17} />}
              label="Team & Admins"
              active={activeSection === "team"}
              onClick={() => setActiveSection("team")}
            />

            <SettingsNav
              icon={<Bell size={17} />}
              label="Notifications"
              active={activeSection === "notifications"}
              onClick={() => setActiveSection("notifications")}
            />

            <SettingsNav
              icon={<SettingsIcon size={17} />}
              label="Preferences"
              active={activeSection === "preferences"}
              onClick={() => setActiveSection("preferences")}
            />
          </aside>

          {/* Content */}
          <div className="space-y-6">
            {activeSection === "calendar" && (
              <SettingsCard title="Google Calendar" description="Connect the company calendar used to create interview events and Google Meet links.">
                {calendarNotice && <p role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{calendarNotice}</p>}
                <div className="flex flex-col gap-4 rounded-lg border border-[#E2E8F0] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={`flex items-center gap-2 font-semibold text-xs ${calendarStatus.connected ? "text-emerald-700" : "text-[#111F33]"}`}><span aria-hidden className={`h-2 w-2 rounded-full ${calendarStatus.connected ? "bg-emerald-500" : "bg-slate-400"}`} />{calendarStatus.connected ? "Connected" : "Not connected"}</p>
                    {calendarStatus.connected ? <div className="mt-2 space-y-1 text-xs text-[#64748B]"><p>Account: {calendarStatus.googleAccountEmail}</p><p>Calendar: {calendarStatus.calendarId === "primary" ? "Primary calendar" : calendarStatus.calendarId}</p><p>Connected: {calendarStatus.connectedAt ? new Date(calendarStatus.connectedAt).toLocaleString() : "—"}</p></div> : <p className="mt-2 max-w-xl text-xs text-[#64748B]">Connect an authorized Google account so verified candidates can book calendar events and Meet conferences.</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2"><button disabled={calendarBusy} onClick={() => void connectCalendar()} className="rounded-md bg-[#1976D2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50">{calendarBusy ? "Working…" : calendarStatus.connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}</button>{calendarStatus.connected && <button disabled={calendarBusy} onClick={() => void disconnectCalendar()} className="rounded-md border border-[#E2E8F0] px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-[#F5F7FA] disabled:opacity-50">Disconnect</button>}</div>
                </div>
                <p className="mt-3 text-xs text-[#64748B]">Google Calendar creates the event and Google Meet room. The AI meeting bot joins this room to conduct the interview directly with the candidate.</p>
              </SettingsCard>
            )}

            {activeSection === "profile" && (
              <ProfileSection />
            )}

            {activeSection === "team" && (
              <TeamManagementSection />
            )}

            {activeSection === "notifications" && (
              <NotificationsSection
                notifications={notifications}
                setNotifications={setNotifications}
              />
            )}

            {activeSection === "preferences" && (
              <PreferencesSection
                preferences={preferences}
                setPreferences={setPreferences}
              />
            )}

            <div className="flex items-center justify-end gap-3">
              {saved && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={17} />
                  Changes saved
                </div>
              )}

              <button
                onClick={handleSaveSettings}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
              >
                <Save size={17} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Admin Modal */}
      {showAdminModal && (
        <AdminModal
          editingAdmin={editingAdmin}
          form={adminForm}
          setForm={setAdminForm}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          onClose={() => setShowAdminModal(false)}
          onSave={handleSaveAdmin}
        />
      )}

      {/* Delete Confirmation */}
      {deleteAdmin && (
        <DeleteAdminModal
          admin={deleteAdmin}
          onClose={() => setDeleteAdmin(null)}
          onConfirm={handleDeleteAdmin}
        />
      )}
    </main>
  );
}

/* =========================================================
   SETTINGS NAVIGATION
========================================================= */

function SettingsNav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-blue-50 text-[#1976D2] font-semibold border border-blue-200/60"
          : "text-[#64748B] hover:bg-[#F5F7FA] hover:text-[#111F33]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* =========================================================
   PROFILE
========================================================= */

function ProfileSection() {
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar: string | null;
  }>({
    name: "",
    email: "",
    phone: "",
    role: "Super Admin",
    avatar: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        setErrorNotice(null);
        const res = await fetch(apiUrl("/api/admin/profile"), {
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const user = data.admin || data.user || {};
          if (!cancelled) {
            setProfile({
              name: user.name || "Administrator",
              email: user.email || "",
              phone: user.phone || "",
              role: user.role === "admin" ? "Super Admin" : (user.role || "Super Admin"),
              avatar: user.avatar || null,
            });
          }
        } else {
          // Fallback to /api/auth/me
          const meRes = await fetch(apiUrl("/api/auth/me"), {
            credentials: "include",
            cache: "no-store",
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const u = meData.user || {};
            if (!cancelled) {
              setProfile({
                name: u.name || "Administrator",
                email: u.email || "",
                phone: u.phone || "",
                role: u.role === "admin" ? "Super Admin" : (u.role || "Super Admin"),
                avatar: u.avatar || null,
              });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setErrorNotice("Failed to load administrator profile from server.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => {
    if (!profile.name.trim()) return "AD";
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile.name]);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorNotice("Please select a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorNotice("Profile image must be smaller than 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfile((prev) => ({ ...prev, avatar: reader.result as string }));
        setErrorNotice(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setProfile((prev) => ({ ...prev, avatar: null }));
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorNotice(null);
    setSuccessNotice(null);

    const trimmedName = profile.name.trim();
    const trimmedEmail = profile.email.trim();

    if (!trimmedName) {
      setErrorNotice("Administrator full name is required.");
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorNotice("A valid email address is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(apiUrl("/api/admin/profile"), {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: profile.phone.trim(),
          avatar: profile.avatar,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || `Failed to update profile (${res.status})`);
      }

      const updatedUser = data.user || {
        name: trimmedName,
        email: trimmedEmail,
        phone: profile.phone.trim(),
        role: profile.role,
        avatar: profile.avatar,
      };

      setProfile((prev) => ({
        ...prev,
        name: updatedUser.name || trimmedName,
        email: updatedUser.email || trimmedEmail,
        phone: updatedUser.phone || "",
        avatar: updatedUser.avatar || null,
        role: updatedUser.role || prev.role,
      }));

      // Broadcast profile update to Header and all subscribers
      publishAdminSync("admin:profile:updated", updatedUser);

      setSuccessNotice("Profile updated successfully.");
      window.setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SettingsCard title="Profile" description="Manage your administrator profile information.">
        <div className="flex items-center justify-center py-12 text-[#64748B]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#1976D2]" />
          <span className="text-sm">Loading administrator profile…</span>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Profile"
      description="Manage your administrator profile information."
    >
      <form onSubmit={handleSaveProfile} className="space-y-6">
        {errorNotice && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorNotice}</span>
          </div>
        )}

        {successNotice && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="h-20 w-20 shrink-0 rounded-2xl border border-[#E2E8F0] object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-[#1976D2] border border-blue-200">
                {initials}
              </div>
            )}
          </div>

          <div>
            <p className="font-semibold text-[#111F33]">
              {profile.name || "Administrator"}
            </p>

            <p className="mt-0.5 text-xs text-[#64748B]">
              {profile.role}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#F5F7FA]">
                <Upload size={14} className="text-[#64748B]" />
                Change profile photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
              </label>

              {profile.avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  <Trash size={14} />
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <FormInput
            label="Full Name"
            value={profile.name}
            onChange={(value) => setProfile((prev) => ({ ...prev, name: value }))}
            placeholder="Administrator Name"
          />

          <FormInput
            label="Email Address"
            type="email"
            value={profile.email}
            onChange={(value) => setProfile((prev) => ({ ...prev, email: value }))}
            placeholder="admin@recruitai.com"
          />

          <FormInput
            label="Phone"
            value={profile.phone}
            onChange={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
            placeholder="+91 98765 43210"
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Role
            </label>

            <div className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              <ShieldCheck size={16} className="text-[#1976D2]" />
              {profile.role}
            </div>
            <p className="mt-1 text-xs text-[#64748B]">
              Role permissions are managed in the Team & Admins section.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#1976D2] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1565C0] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving Profile…
              </>
            ) : (
              <>
                <Save size={15} />
                Save Profile Changes
              </>
            )}
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}

/* =========================================================
   TEAM / ADMIN MANAGEMENT
========================================================= */

function TeamSection({
  admins,
  activeAdmins,
  recruiterCount,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  admins: AdminUser[];
  activeAdmins: number;
  recruiterCount: number;
  onAdd: () => void;
  onEdit: (admin: AdminUser) => void;
  onToggle: (id: string) => void;
  onDelete: (admin: AdminUser) => void;
}) {
  return (
    <>
      {/* Team Header */}
      <SettingsCard
        title="Team & Admin Management"
        description="Add, edit, activate, deactivate and remove administrators."
        headerAction={
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            <Plus size={17} />
            Add Admin
          </button>
        }
      >
        {/* Security Notice */}
        <div className="mb-6 flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
          <ShieldCheck className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" size={19} />

          <div>
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
              Administrator access
            </p>

            <p className="mt-1 text-xs leading-5 text-indigo-700 dark:text-indigo-400">
              Only authorized administrators should have access to this
              dashboard. Admin account creation is managed from this protected
              settings area.
            </p>
          </div>
        </div>

        {/* Team Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStat
            icon={<Users size={17} />}
            label="Total Admins"
            value={admins.length}
          />

          <MiniStat
            icon={<CheckCircle2 size={17} />}
            label="Active Admins"
            value={activeAdmins}
          />

          <MiniStat
            icon={<Shield size={17} />}
            label="Recruiters"
            value={recruiterCount}
          />
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Administrator
                </th>

                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>

                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>

                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last Active
                </th>

                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {admins.map((admin) => (
                <AdminRow
                  key={admin.id}
                  admin={admin}
                  onEdit={onEdit}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 md:hidden">
          {admins.map((admin) => (
            <AdminMobileCard
              key={admin.id}
              admin={admin}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SettingsCard>

      {/* Permissions */}
      <SettingsCard
        title="Role Permissions"
        description="Understand the access level associated with each administrator role."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PermissionCard
            icon={<ShieldCheck size={20} />}
            title="Super Admin"
            description="Full access to recruitment operations and administrator management."
            permissions={[
              "Manage administrators",
              "Manage candidates",
              "Approve or reject candidates",
              "Manage interview slots",
              "Manage projects",
              "Review AI reports",
              "Make final hiring decisions",
              "View analytics",
              "Manage settings",
            ]}
          />

          <PermissionCard
            icon={<Shield size={20} />}
            title="Recruiter"
            description="Recruitment operations without administrator-management privileges."
            permissions={[
              "View candidates",
              "Review candidate profiles",
              "Manage interview slots",
              "View interviews",
              "View projects",
              "Review performance reports",
              "View analytics",
            ]}
          />
        </div>
      </SettingsCard>
    </>
  );
}

function AdminRow({
  admin,
  onEdit,
  onToggle,
  onDelete,
}: {
  admin: AdminUser;
  onEdit: (admin: AdminUser) => void;
  onToggle: (id: string) => void;
  onDelete: (admin: AdminUser) => void;
}) {
  const initials = admin.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr className="border-b border-slate-100 dark:border-white/5">
      <td className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
            {initials}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {admin.name}
            </p>

            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <Mail size={12} />
              {admin.email}
            </p>
          </div>
        </div>
      </td>

      <td className="px-3 py-4">
        <RoleBadge role={admin.role} />
      </td>

      <td className="px-3 py-4">
        <StatusBadge status={admin.status} />
      </td>

      <td className="px-3 py-4 text-sm text-slate-500">
        {admin.lastActive}
      </td>

      <td className="px-3 py-4">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onEdit(admin)}
            title="Edit administrator"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <Pencil size={15} />
          </button>

          <button
            onClick={() => onToggle(admin.id)}
            title={
              admin.status === "Active"
                ? "Deactivate administrator"
                : "Activate administrator"
            }
            className={`rounded-lg border p-2 transition ${
              admin.status === "Active"
                ? "border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-500/20 dark:hover:bg-amber-500/10"
                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/20 dark:hover:bg-emerald-500/10"
            }`}
          >
            {admin.status === "Active" ? (
              <XCircle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
          </button>

          {admin.role !== "Super Admin" && (
            <button
              onClick={() => onDelete(admin)}
              title="Remove administrator"
              className="rounded-lg border border-red-200 p-2 text-red-500 transition hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AdminMobileCard({
  admin,
  onEdit,
  onToggle,
  onDelete,
}: {
  admin: AdminUser;
  onEdit: (admin: AdminUser) => void;
  onToggle: (id: string) => void;
  onDelete: (admin: AdminUser) => void;
}) {
  const initials = admin.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">
            {initials}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {admin.name}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {admin.email}
            </p>
          </div>
        </div>

        <button className="rounded-lg p-2 text-slate-400">
          <MoreHorizontal size={17} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <RoleBadge role={admin.role} />
        <StatusBadge status={admin.status} />
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs text-slate-400">
        <Clock3 size={12} />
        Last active: {admin.lastActive}
      </p>

      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
        <button
          onClick={() => onEdit(admin)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium dark:border-white/10"
        >
          <Pencil size={14} />
          Edit
        </button>

        <button
          onClick={() => onToggle(admin.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium dark:border-white/10"
        >
          {admin.status === "Active" ? (
            <>
              <XCircle size={14} />
              Disable
            </>
          ) : (
            <>
              <CheckCircle2 size={14} />
              Activate
            </>
          )}
        </button>

        {admin.role !== "Super Admin" && (
          <button
            onClick={() => onDelete(admin)}
            className="flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-500 dark:border-red-500/20"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function NotificationsSection({
  notifications,
  setNotifications,
}: {
  notifications: {
    newCandidate: boolean;
    interviewScheduled: boolean;
    reportReady: boolean;
    candidateUpdates: boolean;
    emailNotifications: boolean;
    browserNotifications: boolean;
  };
  setNotifications: React.Dispatch<
    React.SetStateAction<{
      newCandidate: boolean;
      interviewScheduled: boolean;
      reportReady: boolean;
      candidateUpdates: boolean;
      emailNotifications: boolean;
      browserNotifications: boolean;
    }>
  >;
}) {
  return (
    <SettingsCard
      title="Notifications"
      description="Choose which recruitment events should notify you."
    >
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        <ToggleRow
          title="New candidate received"
          description="Notify when a new candidate resume enters the system."
          checked={notifications.newCandidate}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              newCandidate: checked,
            }))
          }
        />

        <ToggleRow
          title="Interview scheduled"
          description="Notify when an interview is scheduled or changed."
          checked={notifications.interviewScheduled}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              interviewScheduled: checked,
            }))
          }
        />

        <ToggleRow
          title="AI report ready"
          description="Notify when an interview performance report is ready."
          checked={notifications.reportReady}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              reportReady: checked,
            }))
          }
        />

        <ToggleRow
          title="Candidate updates"
          description="Receive important candidate workflow updates."
          checked={notifications.candidateUpdates}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              candidateUpdates: checked,
            }))
          }
        />

        <ToggleRow
          title="Email notifications"
          description="Receive important alerts through email."
          checked={notifications.emailNotifications}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              emailNotifications: checked,
            }))
          }
        />

        <ToggleRow
          title="Browser notifications"
          description="Show notifications directly in your browser."
          checked={notifications.browserNotifications}
          onChange={(checked) =>
            setNotifications((current) => ({
              ...current,
              browserNotifications: checked,
            }))
          }
        />
      </div>
    </SettingsCard>
  );
}

/* =========================================================
   PREFERENCES
========================================================= */

function PreferencesSection({
  preferences,
  setPreferences,
}: {
  preferences: {
    timezone: string;
    dateFormat: string;
    firstDay: string;
    compactTables: boolean;
  };
  setPreferences: React.Dispatch<
    React.SetStateAction<{
      timezone: string;
      dateFormat: string;
      firstDay: string;
      compactTables: boolean;
    }>
  >;
}) {
  return (
    <SettingsCard
      title="Preferences"
      description="Configure date, time and interface preferences."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <SelectInput
          label="Timezone"
          value={preferences.timezone}
          options={[
            "Asia/Kolkata",
            "Asia/Dubai",
            "Europe/London",
            "America/New_York",
          ]}
          onChange={(value) =>
            setPreferences((current) => ({
              ...current,
              timezone: value,
            }))
          }
        />

        <SelectInput
          label="Date Format"
          value={preferences.dateFormat}
          options={[
            "DD MMM YYYY",
            "MMM DD, YYYY",
            "YYYY-MM-DD",
          ]}
          onChange={(value) =>
            setPreferences((current) => ({
              ...current,
              dateFormat: value,
            }))
          }
        />

        <SelectInput
          label="First Day of Week"
          value={preferences.firstDay}
          options={["Monday", "Sunday"]}
          onChange={(value) =>
            setPreferences((current) => ({
              ...current,
              firstDay: value,
            }))
          }
        />
      </div>

      <div className="mt-5">
        <ToggleRow
          title="Compact tables"
          description="Use smaller row spacing in large candidate and report tables."
          checked={preferences.compactTables}
          onChange={(checked) =>
            setPreferences((current) => ({
              ...current,
              compactTables: checked,
            }))
          }
        />
      </div>
    </SettingsCard>
  );
}

/* =========================================================
   ADMIN MODAL
========================================================= */

function AdminModal({
  editingAdmin,
  form,
  setForm,
  showPassword,
  setShowPassword,
  onClose,
  onSave,
}: {
  editingAdmin: AdminUser | null;
  form: {
    name: string;
    email: string;
    role: AdminRole;
    password: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      role: AdminRole;
      password: string;
    }>
  >;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {editingAdmin ? "Edit Administrator" : "Add Administrator"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {editingAdmin
                ? "Update administrator account details and role."
                : "Create an administrator account for the recruitment dashboard."}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <FormInput
            label="Full Name"
            value={form.name}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                name: value,
              }))
            }
            placeholder="Enter administrator name"
          />

          <FormInput
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                email: value,
              }))
            }
            placeholder="admin@example.com"
          />

          <SelectInput
            label="Role"
            value={form.role}
            options={["Super Admin", "Recruiter"]}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                role: value as AdminRole,
              }))
            }
          />

          {!editingAdmin && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Temporary Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Enter temporary password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>

              <p className="mt-1.5 text-xs text-slate-400">
                This is frontend mock data for now. Real password handling
                belongs in the backend.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            onClick={onSave}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {editingAdmin ? "Save Changes" : "Add Admin"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   DELETE ADMIN MODAL
========================================================= */

function DeleteAdminModal({
  admin,
  onClose,
  onConfirm,
}: {
  admin: AdminUser;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-[#151922]">
        <div className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={21} />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Remove administrator?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            You are about to remove{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {admin.name}
            </span>{" "}
            from the admin team.
          </p>

          <p className="mt-2 text-xs text-slate-400">
            This is a frontend mock operation. Backend account deletion will
            be implemented later.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5 dark:border-white/10">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium dark:border-white/10"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Remove Admin
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function SettingsCard({
  title,
  description,
  children,
  headerAction,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#111F33]">
            {title}
          </h2>

          <p className="mt-0.5 text-xs text-[#64748B]">
            {description}
          </p>
        </div>

        {headerAction}
      </div>

      <div className="pt-6">{children}</div>
    </section>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#10141d] dark:text-white"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-white/10 dark:bg-[#10141d] dark:text-white"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-white">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? "bg-indigo-600"
            : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          {icon}
        </div>

        <span className="text-xl font-semibold text-slate-900 dark:text-white">
          {value}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        role === "Super Admin"
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
          : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400"
      }`}
    >
      {role === "Super Admin" ? (
        <ShieldCheck size={13} />
      ) : (
        <Shield size={13} />
      )}
      {role}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: AdminUser["status"];
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "Active"
            ? "bg-emerald-500"
            : "bg-slate-400"
        }`}
      />

      {status}
    </span>
  );
}

function PermissionCard({
  icon,
  title,
  description,
  permissions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  permissions: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 dark:border-white/10">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        {icon}
      </div>

      <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

      <div className="mt-4 space-y-2">
        {permissions.map((permission) => (
          <div
            key={permission}
            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
          >
            <CheckCircle2
              size={14}
              className="shrink-0 text-emerald-500"
            />
            {permission}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
