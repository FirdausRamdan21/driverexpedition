"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
  MapPin,
  ShieldCheck,
  BarChart3,
  Package,
  Route,
  Scale,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";

const DEMO_ACCOUNTS = [
  {
    role: "USER",
    title: "User (Pemesan)",
    email: "user@expedition.id",
    desc: "Buat pesanan multi-titik di peta Leaflet, cek kapasitas, lacak driver & rating.",
    badge: "bg-sky-100 text-sky-800",
    icon: Package,
  },
  {
    role: "DRIVER",
    title: "Driver (Motor / Van)",
    email: "driver.van@expedition.id",
    desc: "Toggle ONLINE, terima order sesuai muatan, jalankan checklist rute + bukti POD.",
    badge: "bg-emerald-100 text-emerald-800",
    icon: Truck,
  },
  {
    role: "KARYAWAN",
    title: "Karyawan (Admin)",
    email: "admin@expedition.id",
    desc: "Pantau order aktif, verifikasi driver baru, manual dispatch & batas muatan.",
    badge: "bg-amber-100 text-amber-800",
    icon: ShieldCheck,
  },
  {
    role: "OWNER",
    title: "Owner (Pemilik)",
    email: "owner@expedition.id",
    desc: "Laporan pendapatan kotor/bersih, atur tarif dasar/km/multi-drop & kelola karyawan.",
    badge: "bg-purple-100 text-purple-800",
    icon: BarChart3,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickDemoLogin(email: string) {
    setLoadingEmail(email);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal masuk akun demo");
        setLoadingEmail(null);
        return;
      }
      router.push(data.redirectTo);
    } catch {
      setError("Gagal terhubung ke server");
      setLoadingEmail(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar user={null} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6">
        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-8 text-white shadow-xl sm:p-12">
          <div className="max-w-3xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-white/20">
              <Route className="h-3.5 w-3.5" />
              Ekspedisi & Pengantaran Multi-Titik (Multi-Drop)
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Optimasi Rute Terpendek & Kapasitas Armada dalam Satu Platform
            </h1>
            <p className="text-sm leading-relaxed text-indigo-100 sm:text-base">
              Sistem <strong>Driver Expedition</strong> memisahkan operasional ke dalam 4 peran
              (User, Driver, Karyawan, Owner) dengan kalkulasi otomatis berat & volume (Motor vs
              Van vs Mobil Box) serta optimasi urutan rute menggunakan OSRM Trip API & Leaflet.js.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-indigo-950 shadow hover:bg-indigo-50"
              >
                Masuk ke Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Daftar Akun Baru
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <Scale className="mb-2 h-5 w-5 text-emerald-300" />
              <p className="text-sm font-bold">Anti-Overload Armada</p>
              <p className="mt-1 text-xs text-indigo-100">
                Total &gt; 20 kg otomatis mengunci Motor dan mengarahkan ke Van (600 kg) atau Mobil
                Box (1.500 kg).
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <MapPin className="mb-2 h-5 w-5 text-sky-300" />
              <p className="text-sm font-bold">OSRM Multi-Drop Routing</p>
              <p className="mt-1 text-xs text-indigo-100">
                Urutan titik antar disusun otomatis terpendek lengkap dengan garis rute jalan raya
                di peta Leaflet.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <BarChart3 className="mb-2 h-5 w-5 text-amber-300" />
              <p className="text-sm font-bold">Bagi Hasil Transparan</p>
              <p className="mt-1 text-xs text-indigo-100">
                Kalkulasi tarif dasar, tarif per km, biaya multi-drop, komisi platform & pendapatan
                bersih driver.
              </p>
            </div>
          </div>
        </section>

        {/* Quick 1-click Demo Login */}
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Coba Langsung 4 Peran (Akun Demo)
              </h2>
              <p className="text-sm text-slate-600">
                Klik salah satu kartu di bawah untuk langsung masuk dan mencoba alur end-to-end
                (password default: <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">password123</code>).
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              const isLoading = loadingEmail === acc.email;
              return (
                <button
                  key={acc.email}
                  onClick={() => quickDemoLogin(acc.email)}
                  disabled={loadingEmail !== null}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md disabled:opacity-60"
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${acc.badge}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {acc.role}
                      </span>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900">{acc.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {acc.desc}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-3 font-mono text-[11px] text-slate-500">
                    {acc.email}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
