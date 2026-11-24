"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Wallet,
  Truck,
  Users,
  Save,
  Trash2,
  UserPlus,
  Star,
  BarChart3,
} from "lucide-react";
import { Navbar, NavbarUser } from "@/components/Navbar";
import { formatRupiah, VEHICLE_LABELS } from "@/lib/format";

interface AnalyticsData {
  summary: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    grossRevenue: number;
    platformRevenue: number;
    driverPayout: number;
  };
  byVehicle: Record<string, { count: number; revenue: number; distanceKm: number }>;
  driverPerformance: {
    driverId: string;
    name: string;
    vehicleType: string;
    completedCount: number;
    totalEarning: number;
    totalDistanceKm: number;
    avgRating: number | null;
  }[];
}

interface PricingConfigRow {
  id: string;
  vehicleType: string;
  baseFare: number;
  perKmRate: number;
  multiDropFee: number;
  platformCutPct: number;
  maxWeightKg: number;
  maxVolumeM3: number;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<NavbarUser | null>(null);
  const [tab, setTab] = useState<"ANALYTICS" | "PRICING" | "STAFF">("ANALYTICS");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [configs, setConfigs] = useState<PricingConfigRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    phone: "",
    password: "password123",
  });

  const loadAll = useCallback(async () => {
    const [meRes, anaRes, priceRes, staffRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/analytics"),
      fetch("/api/pricing"),
      fetch("/api/admin/staff"),
    ]);

    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    const meData = await meRes.json();
    if (meData.user.role !== "OWNER") {
      router.push(`/dashboard/${meData.user.role.toLowerCase()}`);
      return;
    }
    setUser(meData.user);

    if (anaRes.ok) setAnalytics(await anaRes.json());
    if (priceRes.ok) setConfigs((await priceRes.json()).configs || []);
    if (staffRes.ok) setStaff((await staffRes.json()).staff || []);
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSavePricing(cfg: PricingConfigRow) {
    const res = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleType: cfg.vehicleType,
        baseFare: Number(cfg.baseFare),
        perKmRate: Number(cfg.perKmRate),
        multiDropFee: Number(cfg.multiDropFee),
        platformCutPct: Number(cfg.platformCutPct),
      }),
    });
    if (res.ok) {
      showToast(`Kebijakan tarif ${VEHICLE_LABELS[cfg.vehicleType]} berhasil diperbarui!`);
      loadAll();
    }
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newStaff),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Gagal menambah karyawan");
      return;
    }
    setNewStaff({ name: "", email: "", phone: "", password: "password123" });
    showToast("Akun karyawan baru berhasil ditambahkan!");
    loadAll();
  }

  async function handleDeleteStaff(id: string) {
    const res = await fetch(`/api/admin/staff?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Akun karyawan dihapus.");
      loadAll();
    }
  }

  const maxVehicleRev = analytics
    ? Math.max(
        1,
        ...Object.values(analytics.byVehicle).map((v) => v.revenue)
      )
    : 1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard Eksekutif (Owner)
            </h1>
            <p className="text-xs text-slate-500">
              Analitik pendapatan kotor & bersih, kebijakan tarif multi-drop, performa armada, dan
              manajemen akun karyawan.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setTab("ANALYTICS")}
              className={`rounded-lg px-4 py-2 text-xs font-bold ${
                tab === "ANALYTICS" ? "bg-indigo-600 text-white" : "text-slate-600"
              }`}
            >
              Analitik & Keuangan
            </button>
            <button
              onClick={() => setTab("PRICING")}
              className={`rounded-lg px-4 py-2 text-xs font-bold ${
                tab === "PRICING" ? "bg-indigo-600 text-white" : "text-slate-600"
              }`}
            >
              Kebijakan Tarif
            </button>
            <button
              onClick={() => setTab("STAFF")}
              className={`rounded-lg px-4 py-2 text-xs font-bold ${
                tab === "STAFF" ? "bg-indigo-600 text-white" : "text-slate-600"
              }`}
            >
              Akun Karyawan ({staff.length})
            </button>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {toast}
          </div>
        )}

        {/* TAB 1: ANALYTICS & REVENUE */}
        {tab === "ANALYTICS" && analytics && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  Pendapatan Kotor (Gross)
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {formatRupiah(analytics.summary.grossRevenue)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {analytics.summary.totalOrders} total transaksi
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Komisi Platform (Owner)
                </p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                  {formatRupiah(analytics.summary.platformRevenue)}
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  Pendapatan bersih platform
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Truck className="h-4 w-4 text-amber-600" />
                  Bagi Hasil Driver
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {formatRupiah(analytics.summary.driverPayout)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Total pendapatan mitra driver</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  Order Selesai / Aktif
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {analytics.summary.completedOrders} / {analytics.summary.activeOrders}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Selesai vs sedang berjalan</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Fleet Revenue Chart */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold text-slate-900">
                  Performa Pendapatan per Jenis Armada
                </h2>
                <div className="space-y-4">
                  {Object.entries(analytics.byVehicle).map(([vType, stat]) => {
                    const pct = Math.round((stat.revenue / maxVehicleRev) * 100);
                    return (
                      <div key={vType} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">
                            {VEHICLE_LABELS[vType] || vType} ({stat.count} order •{" "}
                            {stat.distanceKm} km)
                          </span>
                          <span className="font-bold text-indigo-700">
                            {formatRupiah(stat.revenue)}
                          </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all"
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Driver Leaderboard */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold text-slate-900">
                  Peringkat Performa Mitra Driver
                </h2>
                {analytics.driverPerformance.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada data performa driver.</p>
                ) : (
                  <div className="space-y-2.5">
                    {analytics.driverPerformance.map((d) => (
                      <div
                        key={d.driverId}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{d.name}</p>
                          <p className="text-slate-500">
                            {VEHICLE_LABELS[d.vehicleType]} • {d.completedCount} selesai •{" "}
                            {d.totalDistanceKm} km
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-700">
                            {formatRupiah(d.totalEarning)}
                          </p>
                          {d.avgRating && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                              <Star className="h-3 w-3 fill-amber-400" />
                              {d.avgRating}/5
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRICING CONFIG */}
        {tab === "PRICING" && (
          <div className="grid gap-5 lg:grid-cols-3">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="mb-1 text-base font-bold text-slate-900">
                  {VEHICLE_LABELS[cfg.vehicleType]}
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Kapasitas: {cfg.maxWeightKg} kg • {cfg.maxVolumeM3} m³
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Tarif Dasar (Rp)
                    </label>
                    <input
                      type="number"
                      value={cfg.baseFare}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id ? { ...c, baseFare: Number(e.target.value) } : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Tarif per Kilometer (Rp/km)
                    </label>
                    <input
                      type="number"
                      value={cfg.perKmRate}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id ? { ...c, perKmRate: Number(e.target.value) } : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Biaya Multi-Drop per Titik Tambahan (Rp)
                    </label>
                    <input
                      type="number"
                      value={cfg.multiDropFee}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id
                              ? { ...c, multiDropFee: Number(e.target.value) }
                              : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Komisi Platform Owner (0.05 – 0.50, misal 0.15 = 15%)
                    </label>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={0.5}
                      value={cfg.platformCutPct}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id
                              ? { ...c, platformCutPct: Number(e.target.value) }
                              : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <button
                    onClick={() => handleSavePricing(cfg)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Kebijakan Tarif
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: STAFF MANAGEMENT */}
        {tab === "STAFF" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleCreateStaff}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5"
            >
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                Tambah Akun Karyawan Baru
              </h2>
              <input
                type="text"
                required
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                placeholder="Nama Lengkap Karyawan"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                required
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="Email Karyawan"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                placeholder="No. HP"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                value={newStaff.password}
                onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Buat Akun Karyawan
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Users className="h-4 w-4 text-indigo-600" />
                Daftar Karyawan Operasional ({staff.length})
              </h2>
              <div className="space-y-2.5">
                {staff.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-slate-500">
                        {s.email} • {s.phone}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteStaff(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
