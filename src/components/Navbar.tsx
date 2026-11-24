"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, LogOut, User as UserIcon } from "lucide-react";
import { ROLE_META } from "@/lib/format";

export interface NavbarUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function Navbar({ user }: { user: NavbarUser | null }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const roleInfo = user ? ROLE_META[user.role] : null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">
              Driver Expedition
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              Multi-Drop Logistics & Routing
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-800">
                    {user.name}
                  </p>
                  {roleInfo && (
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.color}`}
                    >
                      {roleInfo.label}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Daftar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
