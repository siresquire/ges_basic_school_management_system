"use client";

import { useState } from "react";
import { impersonateUser } from "@/app/(staff)/super-admin/actions";

type UserRow = { id: string; name: string; username: string; role: string };

const FILTERS = ["All", "Admin", "Teacher", "Student", "Parent"] as const;
type Filter = (typeof FILTERS)[number];

const ROLE_MAP: Record<Filter, string | null> = {
  All: null,
  Admin: "ADMIN",
  Teacher: "TEACHER",
  Student: "STUDENT",
  Parent: "PARENT",
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "badge-purple",
  TEACHER: "badge-gray",
  STUDENT: "badge-green",
  PARENT: "badge-amber",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

const PER_PAGE_OPTIONS = [10, 25, 50];

export function ObserveAsSection({ users }: { users: UserRow[] }) {
  const [active, setActive] = useState<Filter>("All");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  function resetPage() { setPage(1); }

  const roleValue = ROLE_MAP[active];
  const filtered = users.filter((u) => {
    if (roleValue && u.role !== roleValue) return false;
    if (q) {
      const lq = q.toLowerCase();
      if (!u.name.toLowerCase().includes(lq) && !u.username.toLowerCase().includes(lq)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Role filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f === "All" ? users.length : (counts[ROLE_MAP[f] as string] ?? 0);
          const isActive = active === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => { setActive(f); resetPage(); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isActive ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          className="input max-w-sm"
          placeholder="Search by name or username…"
          value={q}
          onChange={(e) => { setQ(e.target.value); resetPage(); }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No accounts match.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="font-mono text-xs text-gray-500">{u.username}</td>
                    <td>
                      <span className={ROLE_BADGE[u.role] ?? "badge-gray"}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td>
                      <form action={impersonateUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <button className="btn-secondary btn-sm">View as</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: count + per-page + pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <p className="text-gray-500">
              {filtered.length} account{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== users.length && ` (filtered from ${users.length})`}
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
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
              <div className="flex items-center gap-1">
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
        </>
      )}
    </div>
  );
}
