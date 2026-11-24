"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Power,
  CheckCircle2,
  Truck,
  Camera,
  AlertCircle,
  Wallet,
  MapPin,
  ShieldAlert,
  Loader2,
  Navigation,
} from "lucide-react";
import { Navbar, NavbarUser } from "@/components/Navbar";
import { MapWrapper } from "@/components/MapWrapper";
import {
  formatRupiah,
  ORDER_STATUS_META,
  STOP_STATUS_META,
  VEHICLE_LABELS,
} from "@/lib/format";

interface DriverUser extends NavbarUser {
  driverProfile: {
    id: string;
    vehicleType: string;
    plateNumber: string;
    maxWeightKg: number;
    maxVolumeM3: number;
    isOnline: boolean;
    isVerified: boolean;
    currentLat: number | null;
    currentLng: number | null;
  } | null;
}

interface OrderItem {
  id: string;
  orderCode: string;
  vehicleType: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  totalWeightKg: number;
  totalDistanceKm: number;
  totalPrice: number;
  driverEarning: number;
  status: string;
  createdAt: string;
  customer: { name: string; phone: string };
  stops: {
    id: string;
    sequenceOrder: number;
    recipientName: string;
    recipientPhone: string;
    address: string;
    lat: number;
    lng: number;
    itemDesc: string;
    weightKg: number;
    status: string;
    proofPhotoUrl: string | null;
  }[];
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DriverUser | null>(null);
  const [myOrders, setMyOrders] = useState<OrderItem[]>([]);
  const [availableOrders, setAvailableOrders] = useState<OrderItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null
  );

  const loadData = useCallback(async () => {
    const [meRes, ordersRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/orders"),
    ]);
    if (!meRes.ok) {
      router.push("/login");
      return;
    }
    const meData = await meRes.json();
    if (meData.user.role !== "DRIVER") {
      router.push(`/dashboard/${meData.user.role.toLowerCase()}`);
      return;
    }
    setUser(meData.user);

    if (ordersRes.ok) {
      const oData = await ordersRes.json();
      setMyOrders(oData.orders || []);
      setAvailableOrders(oData.availableOrders || []);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function toggleOnline() {
    if (!user?.driverProfile) return;
    setBusyId("toggle");
    setMessage(null);
    const nextOnline = !user.driverProfile.isOnline;
    const res = await fetch("/api/driver/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOnline: nextOnline }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Gagal mengubah status" });
    } else {
      await loadData();
    }
    setBusyId(null);
  }

  async function handleAcceptOrder(orderId: string) {
    setBusyId(orderId);
    setMessage(null);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ACCEPT" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Gagal menerima order" });
    } else {
      setMessage({ type: "success", text: "Order diterima! Silakan menuju titik jemput." });
      await loadData();
    }
    setBusyId(null);
  }

  async function handleStartDelivery(orderId: string) {
    setBusyId(orderId);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "START_DELIVERY" }),
    });
    if (res.ok) {
      setMessage({ type: "success", text: "Pengantaran multi-titik dimulai!" });
      await loadData();
    }
    setBusyId(null);
  }

  async function handleUpdateStop(
    orderId: string,
    stopId: string,
    status: "ARRIVED" | "DELIVERED" | "FAILED"
  ) {
    setBusyId(stopId);
    setMessage(null);
    const proofPhotoUrl =
      status === "DELIVERED"
        ? proofMap[stopId] || `https://placehold.co/400x300/png?text=POD+${stopId.slice(-4)}`
        : undefined;

    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPDATE_STOP",
        stopId,
        status,
        proofPhotoUrl,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Gagal memperbarui titik" });
    } else {
      setMessage({
        type: "success",
        text:
          status === "DELIVERED"
            ? "Titik selesai diantar & bukti POD tersimpan!"
            : `Status titik diperbarui menjadi ${status}.`,
      });
      await loadData();
    }
    setBusyId(null);
  }

  function handleFileUpload(stopId: string, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProofMap((prev) => ({ ...prev, [stopId]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  const activeOrder = myOrders.find(
    (o) => o.status === "ACCEPTED" || o.status === "IN_DELIVERY"
  );
  const completedOrders = myOrders.filter((o) => o.status === "COMPLETED");
  const totalCommission = completedOrders.reduce((sum, o) => sum + o.driverEarning, 0);
  const profile = user?.driverProfile;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Top Driver Status Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900">Dashboard Mitra Driver</h1>
            {profile && (
              <p className="text-xs text-slate-600">
                Armada: <strong>{VEHICLE_LABELS[profile.vehicleType]}</strong> • Plat{" "}
                <strong className="font-mono">{profile.plateNumber}</strong> • Batas Muatan{" "}
                <strong>
                  {profile.maxWeightKg} kg / {profile.maxVolumeM3} m³
                </strong>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-emerald-700">
                Total Komisi Selesai
              </p>
              <p className="flex items-center gap-1 text-base font-extrabold text-emerald-800">
                <Wallet className="h-4 w-4" />
                {formatRupiah(totalCommission)}
              </p>
            </div>

            <button
              onClick={toggleOnline}
              disabled={!profile?.isVerified || busyId === "toggle"}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 ${
                profile?.isOnline
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-600 hover:bg-slate-700"
              }`}
            >
              <Power className="h-4 w-4" />
              {profile?.isOnline ? "STATUS: ONLINE" : "STATUS: OFFLINE"}
            </button>
          </div>
        </div>

        {profile && !profile.isVerified && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>
              Akun driver Anda <strong>menunggu verifikasi Karyawan (Admin)</strong>. Anda dapat
              mulai ONLINE dan menerima pesanan setelah diverifikasi.
            </span>
          </div>
        )}

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              message.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Active Delivery Execution */}
        {activeOrder && (
          <section className="grid gap-6 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">
                    PENGANTARAN AKTIF
                  </span>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {activeOrder.orderCode}
                  </h2>
                </div>
                <p className="text-right text-sm font-extrabold text-emerald-700">
                  Komisi: {formatRupiah(activeOrder.driverEarning)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-bold text-emerald-700">Titik Jemput (A):</p>
                <p>{activeOrder.pickupAddress}</p>
                <p className="mt-1 text-slate-500">
                  Pemesan: {activeOrder.customer.name} ({activeOrder.customer.phone}) •{" "}
                  {activeOrder.totalWeightKg} kg • {activeOrder.totalDistanceKm} km
                </p>
              </div>

              <MapWrapper
                pickup={{
                  lat: activeOrder.pickupLat,
                  lng: activeOrder.pickupLng,
                  address: activeOrder.pickupAddress,
                }}
                stops={activeOrder.stops.map((s) => ({
                  id: s.id,
                  label: s.recipientName,
                  address: s.address,
                  lat: s.lat,
                  lng: s.lng,
                  sequenceOrder: s.sequenceOrder,
                  status: s.status,
                }))}
                driverLocation={
                  profile?.currentLat && profile?.currentLng
                    ? { lat: profile.currentLat, lng: profile.currentLng, label: "Posisi Anda" }
                    : null
                }
                heightClass="h-[310px]"
              />
            </div>

            <div className="space-y-3 lg:col-span-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Checklist Urutan Titik Antar (Optimized)
                </h3>
                {activeOrder.status === "ACCEPTED" && (
                  <button
                    onClick={() => handleStartDelivery(activeOrder.id)}
                    disabled={busyId === activeOrder.id}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Barang Diambil — Mulai Antar
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {activeOrder.stops.map((stop) => {
                  const sm = STOP_STATUS_META[stop.status] || {
                    label: stop.status,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  const isDone = stop.status === "DELIVERED";
                  return (
                    <div
                      key={stop.id}
                      className={`rounded-xl border p-3.5 ${
                        isDone
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-slate-200 bg-slate-50/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                              {stop.sequenceOrder}
                            </span>
                            {stop.recipientName} ({stop.recipientPhone})
                          </p>
                          <p className="mt-1 text-xs text-slate-600">{stop.address}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                            Barang: {stop.itemDesc} ({stop.weightKg} kg)
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${sm.badgeClass}`}
                        >
                          {sm.label}
                        </span>
                      </div>

                      {!isDone && activeOrder.status === "IN_DELIVERY" && (
                        <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                              <Camera className="h-3.5 w-3.5 text-indigo-600" />
                              {proofMap[stop.id] ? "Foto POD Siap ✓" : "Unggah Foto POD"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileUpload(stop.id, e.target.files?.[0] || null)
                                }
                              />
                            </label>
                            <button
                              onClick={() =>
                                handleUpdateStop(activeOrder.id, stop.id, "ARRIVED")
                              }
                              disabled={busyId === stop.id}
                              className="rounded-lg bg-blue-100 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-200"
                            >
                              Tiba di Lokasi
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateStop(activeOrder.id, stop.id, "DELIVERED")
                              }
                              disabled={busyId === stop.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                              {busyId === stop.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Selesai Antar
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateStop(activeOrder.id, stop.id, "FAILED")
                              }
                              disabled={busyId === stop.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-200"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              Kendala
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Incoming Orders + Commission History */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Available Orders */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Truck className="h-4 w-4 text-indigo-600" />
              Order Masuk Sesuai Armada ({availableOrders.length})
            </h2>
            {!profile?.isOnline ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                Aktifkan status <strong>ONLINE</strong> di kanan atas untuk melihat dan menerima
                pesanan masuk.
              </p>
            ) : availableOrders.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                Belum ada order baru yang sesuai kapasitas armada Anda saat ini.
              </p>
            ) : (
              <div className="space-y-3">
                {availableOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {order.orderCode}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-700">
                        +{formatRupiah(order.driverEarning)}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      Jemput: {order.pickupAddress}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {order.stops.length} Titik Antar • {order.totalWeightKg} kg •{" "}
                      {order.totalDistanceKm} km
                    </p>
                    <button
                      onClick={() => handleAcceptOrder(order.id)}
                      disabled={busyId === order.id}
                      className="mt-3 w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busyId === order.id ? "Memproses..." : "Terima Order Ini"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Commission History */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Riwayat Pengantaran & Komisi ({myOrders.length})
            </h2>
            {myOrders.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                Belum ada riwayat pengantaran.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myOrders.map((order) => {
                  const st = ORDER_STATUS_META[order.status] || {
                    label: order.status,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-bold text-slate-900">{order.orderCode}</p>
                        <p className="text-slate-500">
                          {order.stops.length} titik • {order.totalDistanceKm} km •{" "}
                          {order.totalWeightKg} kg
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">
                          {formatRupiah(order.driverEarning)}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
