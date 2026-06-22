"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import Avatar from "@/components/avatar";
import Icon, { type IconName } from "@/components/icon";

type NavItem = {
  href: string;
  label: string;
  roles: string[];
  icon: IconName;
  feature?: keyof SidebarFeatures;
};

export type SidebarFeatures = {
  feesEnabled: boolean;
  timetableEnabled: boolean;
  analyticsEnabled: boolean;
  attendanceEnabled: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "dashboard" },
  { href: "/students", label: "Students", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "students" },
  { href: "/classes", label: "Classes", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "classes" },
  { href: "/attendance", label: "Attendance", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "attendance", feature: "attendanceEnabled" },
  { href: "/scores", label: "Scores", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "scores" },
  { href: "/excel", label: "Excel Sheets", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "excel" },
  { href: "/reports", label: "Report Cards", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "reports" },
  { href: "/analytics", label: "Analytics", roles: ["SUPER_ADMIN", "ADMIN"], icon: "analytics", feature: "analyticsEnabled" },
  { href: "/fees", label: "Fees", roles: ["SUPER_ADMIN", "ADMIN"], icon: "fees", feature: "feesEnabled" },
  { href: "/staff", label: "Staff", roles: ["SUPER_ADMIN", "ADMIN"], icon: "staff" },
  { href: "/timetable", label: "Timetable", roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"], icon: "timetable", feature: "timetableEnabled" },
  { href: "/settings", label: "Settings", roles: ["SUPER_ADMIN", "ADMIN"], icon: "settings" },
  { href: "/super-admin", label: "System", roles: ["SUPER_ADMIN"], icon: "shield" },
];

export default function Sidebar({
  role,
  userName,
  schoolName,
  showLogo = false,
  features,
}: {
  role: string;
  userName: string;
  schoolName: string;
  showLogo?: boolean;
  features?: SidebarFeatures;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.feature && features && !features[item.feature]) return false;
    return true;
  });

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-700 text-white"
                : "text-emerald-50/80 hover:bg-emerald-800 hover:text-white"
            }`}
          >
            <Icon name={item.icon} fixedWidth className="text-emerald-200/90" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="shrink-0 border-t border-emerald-800 px-3 py-3">
      <Link
        href="/account"
        onClick={() => setOpen(false)}
        title="My account — change your name, password and signature"
        className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${
          pathname === "/account" ? "bg-emerald-700" : "hover:bg-emerald-800"
        }`}
      >
        <Avatar name={userName} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white">{userName}</span>
          <span className="block text-xs text-emerald-200/70">
            {role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Administrator" : "Teacher"} · My account
          </span>
        </span>
      </Link>
      <form action={logout} className="mt-1 px-2">
        <button className="flex cursor-pointer items-center gap-1.5 text-xs text-emerald-200 underline-offset-2 hover:underline">
          <Icon name="signout" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-20 flex items-center justify-between bg-emerald-900 px-4 py-3 lg:hidden">
        <span className="flex min-w-0 items-center gap-2">
          {showLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo" alt="" className="h-7 w-7 shrink-0 rounded-full bg-white object-contain" />
          )}
          <span className="truncate text-sm font-semibold text-white">{schoolName}</span>
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="cursor-pointer rounded-md px-2 py-1 text-lg text-emerald-100 hover:bg-emerald-800"
          aria-label="Toggle menu"
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>

      {/* Mobile menu — fixed overlay so it covers the full viewport regardless of scroll position */}
      {open && (
        <>
          {/* Backdrop — tap to close */}
          <div
            className="no-print fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="no-print fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-hidden bg-emerald-900 shadow-2xl lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-emerald-800 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2">
                {showLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo" alt="" className="h-7 w-7 shrink-0 rounded-full bg-white object-contain" />
                )}
                <span className="truncate text-sm font-semibold text-white">{schoolName}</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-md px-2 py-1 text-lg text-emerald-100 hover:bg-emerald-800"
                aria-label="Close menu"
              >
                <Icon name="close" />
              </button>
            </div>
            {nav}
            {footer}
          </div>
        </>
      )}

      {/* Desktop sidebar — pinned to the viewport; only the nav scrolls. */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-emerald-900 lg:flex">
        <div className="flex shrink-0 items-center gap-3 px-4 py-5">
          {showLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo" alt="" className="h-10 w-10 shrink-0 rounded-full bg-white object-contain" />
          )}
          <div>
            <p className="text-sm leading-snug font-semibold text-white">{schoolName}</p>
            <p className="mt-0.5 text-xs text-emerald-200/70">Management System</p>
          </div>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
