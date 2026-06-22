"use client";

import { useState } from "react";
import { adminResetPassword, toggleUserActive } from "@/app/(staff)/settings/actions";
import { TempPasswordCell } from "@/components/temp-password-cell";
import { PasswordInput } from "@/components/password-input";

export type AccountRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  tempPassword: string | null;
};

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "TEACHER", label: "Teacher" },
  { value: "STUDENT", label: "Student" },
  { value: "PARENT", label: "Parent" },
];

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: "badge-purple",
  ADMIN: "badge-purple",
  TEACHER: "badge-gray",
  STUDENT: "badge-green",
  PARENT: "badge-amber",
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

const PER_PAGE_OPTIONS = [10, 25, 50];

export function AccountsTable({
  users,
  sessionUserId,
  sessionRole,
}: {
  users: AccountRow[];
  sessionUserId: string;
  sessionRole: string;
}) {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  function resetPage() {
    setPage(1);
  }

  const filtered = users.filter((u) => {
    if (q) {
      const lq = q.toLowerCase();
      if (!u.name.toLowerCase().includes(lq) && !u.username.toLowerCase().includes(lq)) return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter === "active" && !u.active) return false;
    if (statusFilter === "inactive" && u.active) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-5 py-3">
        <div className="min-w-48 flex-1">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="Name or username…"
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage(); }}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); resetPage(); }}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Temp password</th>
              <th>Reset password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No accounts match the filter.
                </td>
              </tr>
            )}
            {paged.map((u) => {
              const isSuperAdmin = u.role === "SUPER_ADMIN";
              const viewerCanManage = !isSuperAdmin || sessionRole === "SUPER_ADMIN";
              return (
                <tr key={u.id}>
                  <td className="font-mono text-xs">{u.username}</td>
                  <td>{u.name}</td>
                  <td>
                    <span className={ROLE_BADGE[u.role] ?? "badge-gray"}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td>
                    <span className={u.active ? "badge-green" : "badge-red"}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td>
                    {u.tempPassword ? (
                      <TempPasswordCell password={u.tempPassword} />
                    ) : (
                      <span className="badge-green text-xs">Changed</span>
                    )}
                  </td>
                  <td>
                    {viewerCanManage ? (
                      <form action={adminResetPassword.bind(null, u.id)} className="flex gap-2">
                        <PasswordInput name="password" compact minLength={6} />
                        <button className="btn-secondary btn-sm">Set</button>
                      </form>
                    ) : (
                      <span className="text-xs text-gray-400">Managed via System page</span>
                    )}
                  </td>
                  <td className="text-right">
                    {viewerCanManage && u.id !== sessionUserId && (
                      <form action={toggleUserActive.bind(null, u.id)}>
                        <button type="submit" className="cursor-pointer text-xs text-red-600 hover:underline">
                          {u.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: count + per-page + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
        <p className="text-xs text-gray-500">
          {filtered.length} account{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== users.length && ` (filtered from ${users.length})`}
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Rows per page:
            <select
              className="input py-1 text-xs"
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              ‹ Prev
            </button>
            <span className="px-1">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
