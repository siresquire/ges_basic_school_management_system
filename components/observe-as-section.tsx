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

export function ObserveAsSection({ users }: { users: UserRow[] }) {
  const [active, setActive] = useState<Filter>("All");

  const roleValue = ROLE_MAP[active];
  const filtered = roleValue ? users.filter((u) => u.role === roleValue) : users;

  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Role filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f === "All" ? users.length : (counts[ROLE_MAP[f] as string] ?? 0);
          const isActive = active === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setActive(f)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">No accounts in this category yet.</p>
      ) : (
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
              {filtered.map((u) => (
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
      )}
    </div>
  );
}
