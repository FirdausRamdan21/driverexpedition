"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Truck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { Navbar, NavbarUser } from "@/components/Navbar";
import {
  formatRupiah,
  ORDER_STATUS_META,
  STOP_STATUS_META,
  VEHICLE_LABELS,
} from "@/lib/format";

interface DriverRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  driverProfile: {
    id: string;
    vehicleType: string;
    plateNumber: string;
    maxWeightKg: number;
    maxVolumeM3: number;
    isOnline: boolean;
    isVerified: boolean;
  } | null;
  ordersAsDriver: { id: string; status: string }[];
}

interface OrderRow {
  id: string;
  orderCode: string;
  vehicleType: string;
  pickupAddress: string;
  totalWeightKg: number;
  totalDistanceKm: number;
  totalPrice: number;
  status: string;
  issueNote: string | null;
  customer: { name: string; phone: string };
  driver: { id: string; name: string } | null;
  stops: {
    id: string;
    sequenceOrder: number;
    recipientName: string;
    address: string;
    status: string;
  }[];
}

interface PricingRow {
  id: string;
  vehicleType: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  baseFare: number;
}

export default function KaryawanDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<NavbarUser | null>(null);
  const [tab, setTab] = useState<"ORDERS" | "DRIVERS" | "VEHICLES">("ORDERS");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [configs, setConfigs] = useState<PricingRow[]>([]);
  const [dispatchSelection, setDispatchSelection] = useState<Record<string, string>>({});
  const [issueDraft, setIssueDraft] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [meRes, ordersRes, driversRes, pricingRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/orders"),
      fetch("/api/admin/drivers"),
      fetch("/api/pricing"),
    ]);

    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    const meData = await meRes.json();
    if (meData.user.role !== "KARYAWAN" && meData.user.role !== "OWNER") {
      router.push(`/dashboard/${meData.user.role.toLowerCase()}`);
      return;
    }
    setUser(meData.user);

    if (ordersRes.ok) setOrders((await ordersRes.json()).orders || []);
    if (driversRes.ok) setDrivers((await driversRes.json()).drivers || []);
    if (pricingRes.ok) setConfigs((await pricingRes.json()).configs || []);
  }, [router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function toggleVerifyDriver(driverProfileId: string, nextVerified: boolean) {
    const res = await fetch("/api/admin/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverProfileId, isVerified: nextVerified }),
    });
    if (res.ok) {
      showToast(
        nextVerified ? "Akun driver berhasil diverifikasi!" : "Verifikasi driver dicabut."
      );
      loadAll();
    }
  }

  async function handleManualDispatch(orderId: string) {
    const driverId = dispatchSelection[orderId];
    if (!driverId) return;
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MANUAL_DISPATCH", driverId }),
    });
    if (res.ok) {
      showToast("Manual dispatch berhasil ditugaskan ke driver!");
      loadAll();
    }
  }

  async function handleResolveIssue(orderId: string, resetStopId?: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_ISSUE",
        issueNote: issueDraft[orderId] || "Ditangani oleh admin operasional",
        resetStopId,
      }),
    });
    if (res.ok) {
      showToast("Catatan kendala & status titik diperbarui.");
      loadAll();
    }
  }

  async function handleSaveVehicleLimit(cfg: PricingRow) {
    const res = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleType: cfg.vehicleType,
        maxWeightKg: Number(cfg.maxWeightKg),
        maxVolumeM3: Number(cfg.maxVolumeM3),
      }),
    });
    if (res.ok) {
      showToast(`Batas muatan ${VEHICLE_LABELS[cfg.vehicleType]} disimpan.`);
      loadAll();
    }
  }

  const verifiedDrivers = drivers.filter((d) => d.driverProfile?.isVerified);
  const unverifiedCount = drivers.filter((d) => !d.driverProfile?.isVerified).length;
  const activeOrdersCount = orders.filter(
    (o) => o.status === "PENDING" || o.status === "ACCEPTED" || o.status === "IN_DELIVERY"
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard Operasional (Karyawan)
            </h1>
            <p className="text-xs text-slate-500">
              Monitoring order aktif, manual dispatch, verifikasi driver baru, dan batas muatan
              armada.
            </p>
          </div>
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Muat Ulang
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Order Aktif Berjalan</p>
            <p className="mt-1 text-2xl font-extrabold text-indigo-700">{activeOrdersCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Driver Terverifikasi</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">
              {verifiedDrivers.length} / {drivers.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Menunggu Verifikasi Driver</p>
            <p className="mt-1 text-2xl font-extrabold text-amber-600">{unverifiedCount}</p>
          </div>
        </div>

        {toast && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {toast}
          </div>
        )}

        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab("ORDERS")}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${
              tab === "ORDERS" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Monitoring Order & Dispatch ({orders.length})
          </button>
          <button
            onClick={() => setTab("DRIVERS")}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${
              tab === "DRIVERS" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Verifikasi Driver ({unverifiedCount} Pending)
          </button>
          <button
            onClick={() => setTab("VEHICLES")}
            className={`rounded-lg px-4 py-2 text-xs font-bold ${
              tab === "VEHICLES" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Batas Muatan Armada
          </button>
        </div>

        {/* TAB 1: ORDERS & MANUAL DISPATCH */}
        {tab === "ORDERS" && (
          <div className="space-y-4">
            {orders.map((order) => {
              const st = ORDER_STATUS_META[order.status] || {
                label: order.status,
                badgeClass: "bg-slate-100 text-slate-700",
              };
              const failedStop = order.stops.find((s) => s.status === "FAILED");
              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {order.orderCode}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                        {failedStop && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            Ada Titik Gagal
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Pemesan: <strong>{order.customer.name}</strong> • Armada:{" "}
                        <strong>{VEHICLE_LABELS[order.vehicleType]}</strong> •{" "}
                        {order.totalWeightKg} kg • {order.totalDistanceKm} km •{" "}
                        <strong className="text-indigo-700">{formatRupiah(order.totalPrice)}</strong>
                      </p>
                      <p className="text-xs text-slate-500">
                        Driver:{" "}
                        <strong>{order.driver ? order.driver.name : "Belum ditugaskan"}</strong>
                      </p>
                    </div>

                    {/* Manual Dispatch */}
                    {(order.status === "PENDING" || order.status === "ACCEPTED") && (
                      <div className="flex items-center gap-2">
                        <select
                          value={dispatchSelection[order.id] || ""}
                          onChange={(e) =>
                            setDispatchSelection((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="">Pilih Driver (Manual Dispatch)</option>
                          {verifiedDrivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.driverProfile?.vehicleType})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleManualDispatch(order.id)}
                          disabled={!dispatchSelection[order.id]}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Tugaskan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stops summary */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {order.stops.map((s) => {
                      const sm = STOP_STATUS_META[s.status] || {
                        label: s.status,
                        badgeClass: "bg-slate-100 text-slate-700",
                      };
                      return (
                        <div
                          key={s.id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              #{s.sequenceOrder} {s.recipientName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sm.badgeClass}`}
                            >
                              {sm.label}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{s.address}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Issue / Complaint Handling */}
                  {(failedStop || order.issueNote) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <input
                        type="text"
                        value={issueDraft[order.id] ?? order.issueNote ?? ""}
                        onChange={(e) =>
                          setIssueDraft((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                        placeholder="Catatan penanganan komplain / kendala..."
                        className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs"
                      />
                      <button
                        onClick={() => handleResolveIssue(order.id, failedStop?.id)}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                      >
                        {failedStop ? "Reset Titik Gagal & Simpan" : "Simpan Catatan"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: DRIVER VERIFICATION */}
        {tab === "DRIVERS" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {drivers.map((d) => {
              const p = d.driverProfile;
              if (!p) return null;
              return (
                <div
                  key={d.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
                        <Truck className="h-4 w-4" />
                        {VEHICLE_LABELS[p.vehicleType]}
                      </span>
                      {p.isVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Terverifikasi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          <XCircle className="h-3 w-3" />
                          Menunggu Verifikasi
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-bold text-slate-900">{d.name}</h3>
                    <p className="text-xs text-slate-500">
                      {d.email} • {d.phone}
                    </p>
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                      <p>
                        Plat Nomor: <strong className="font-mono">{p.plateNumber}</strong>
                      </p>
                      <p>
                        Kapasitas: <strong>{p.maxWeightKg} kg</strong> /{" "}
                        <strong>{p.maxVolumeM3} m³</strong>
                      </p>
                      <p>
                        Status:{" "}
                        <strong className={p.isOnline ? "text-emerald-600" : "text-slate-500"}>
                          {p.isOnline ? "ONLINE" : "OFFLINE"}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleVerifyDriver(p.id, !p.isVerified)}
                    className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white ${
                      p.isVerified
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {p.isVerified ? (
                      <>
                        <ShieldCheck className="h-4 w-4" />
                        Cabut Verifikasi
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Verifikasi Dokumen & Aktifkan
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: VEHICLE CAPACITY LIMITS */}
        {tab === "VEHICLES" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {VEHICLE_LABELS[cfg.vehicleType]}
                  </h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Batas Maksimal Berat (kg)
                    </label>
                    <input
                      type="number"
                      value={cfg.maxWeightKg}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id
                              ? { ...c, maxWeightKg: Number(e.target.value) }
                              : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Batas Maksimal Volume (m³)
                    </label>
                    <input
                      type="number"
                      step={0.01}
                      value={cfg.maxVolumeM3}
                      onChange={(e) =>
                        setConfigs((prev) =>
                          prev.map((c) =>
                            c.id === cfg.id
                              ? { ...c, maxVolumeM3: Number(e.target.value) }
                              : c
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => handleSaveVehicleLimit(cfg)}
                    className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Simpan Batas Muatan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
