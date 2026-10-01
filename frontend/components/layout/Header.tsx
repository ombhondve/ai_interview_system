"use client";

import { useState } from "react";
import { Menu, Search, Bell, Moon, Sun, ChevronDown } from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [dark, setDark] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <>
      <header className="surface flex h-16 items-center gap-3 border-b px-4 sm:px-6">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative hidden flex-1 max-w-md sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates, interviews, projects..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:bg-white/10"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          <button
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white dark:ring-[#0f1117]" />
          </button>

          <Dropdown
            trigger={
              <div className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
                <Avatar name="Admin User" size="sm" />
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Admin User</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Super Admin</p>
                </div>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </div>
            }
          >
            <DropdownItem>Profile</DropdownItem>
            <DropdownItem>Settings</DropdownItem>
            <DropdownItem>Help</DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onClick={() => setLogoutOpen(true)}>
              Logout
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      <Modal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Log out?"
        description="You'll need to sign in again to access the admin dashboard."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm">
              Log Out
            </Button>
          </>
        }
      />
    </>
  );
}
