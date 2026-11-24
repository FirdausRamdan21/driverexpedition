"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Plus,
  Trash2,
  Route,
  Lock,
  CheckCircle2,
  Package,
  Clock,
  Star,
  Loader2,
  Navigation,
  AlertTriangle,
} from "lucide-react";
import { Navbar, NavbarUser } from "@/components/Navbar";
import { MapWrapper } from "@/components/MapWrapper";
import {
  formatRupiah,
  ORDER_STATUS_META,
  STOP_STATUS_META,
  VEHICLE_LABELS,
} from "@/lib/format";

interface StopDraft {
  id: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  lat: number;
  lng: number;
  itemDesc: string;
  weightKg: number;
  volumeM3: number;
  sequenceOrder?: number;
}

interface VehicleQuote {
  vehicleType: "MOTOR" | "VAN" | "MOBIL_BOX";
  label: string;
  description: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  eligible: boolean;
  lockedReason: string | null;
  baseFare: number;
  distanceFee: number;
  multiDropFeeTotal: number;
  totalPrice: number;
  platformFee: number;
  driverEarning: number;
}

interface OrderRecord {
  id: string;
  orderCode: string;
  vehicleType: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  totalDistanceKm: number;
  totalPrice: number;
  status: string;
  rating: number | null;
  review: string | null;
  createdAt: string;
  driver: {
    id: string;
    name: string;
    phone: string;
    driverProfile: {
      plateNumber: string;
      currentLat: number | null;
      currentLng: number | null;
    } | null;
  } | null;
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

const PRESET_STOPS: Omit<StopDraft, "id">[] = [
  {
    recipientName: "Toko Elektronik Glodok",
    recipientPhone: "08121112222",
    address: "Jl. Hayam Wuruk, Glodok, Jakarta Barat",
    lat: -6.1456,
    lng: 106.8165,
    itemDesc: "2 Dus Komponen",
    weightKg: 8,
    volumeM3: 0.02,
  },
  {
    recipientName: "Butik Kemang",
    recipientPhone: "08123334444",
    address: "Jl. Kemang Raya, Jakarta Selatan",
    lat: -6.2607,
    lng: 106.8133,
    itemDesc: "4 Koli Pakaian",
    weightKg: 14,
    volumeM3: 0.05,
  },
  {
    recipientName: "Klinik Menteng",
    recipientPhone: "08125556666",
    address: "Jl. Teuku Umar, Menteng, Jakarta Pusat",
    lat: -6.1932,
    lng: 106.8336,
    itemDesc: "1 Box Alat Medis",
    weightKg: 5,
    volumeM3: 0.02,
  },
];

export default function UserDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<NavbarUser | null>(null);
  const [activeTab, setActiveTab] = useState<"CREATE" | "ORDERS">("CREATE");

  // Order creation state
  const [clickMode, setClickMode] = useState<"PICKUP" | "STOP">("STOP");
  const [pickup, setPickup] = useState({
    address: "Gudang Pusat Tanah Abang, Jakarta Pusat",
    lat: -6.1889,
    lng: 106.8148,
  });
  const [stops, setStops] = useState<StopDraft[]>([
    { id: "s-1", ...PRESET_STOPS[0] },
    { id: "s-2", ...PRESET_STOPS[1] },
  ]);

  const [optimizing, setOptimizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [routeMeta, setRouteMeta] = useState<{
    totalDistanceKm: number;
    durationMinutes: number;
    method: string;
    totalWeightKg: number;
    totalVolumeM3: number;
  } | null>(null);
  const [quotes, setQuotes] = useState<VehicleQuote[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<
    "MOTOR" | "VAN" | "MOBIL_BOX" | null
  >(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; msg: string } | null>(
    null
  );

  // Order history & tracking state
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [ratingMap, setRatingMap] = useState<Record<string, { rating: number; review: string }>>(
    {}
  );

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders || []);
      if (data.orders?.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data.orders[0].id);
      }
    }
  }, [selectedOrderId]);

  useEffect(() => {
    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "USER") {
        router.push(`/dashboard/${meData.user.role.toLowerCase()}`);
        return;
      }
      setUser(meData.user);
      loadOrders();
    }
    init();
  }, [router, loadOrders]);

  const liveTotalWeight = Number(
    stops.reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0).toFixed(2)
  );
  const liveTotalVolume = Number(
    stops.reduce((sum, s) => sum + (Number(s.volumeM3) || 0), 0).toFixed(3)
  );

  function handleMapClick(lat: number, lng: number) {
    if (clickMode === "PICKUP") {
      setPickup({
        address: `Titik Jemput (${lat}, ${lng})`,
        lat,
        lng,
      });
    } else {
      const idx = stops.length + 1;
      setStops((prev) => [
        ...prev,
        {
          id: `stop-${Date.now()}`,
          recipientName: `Penerima #${idx}`,
          recipientPhone: "08120000000",
          address: `Lokasi Antar (${lat}, ${lng})`,
          lat,
          lng,
          itemDesc: "Paket Ekspedisi",
          weightKg: 5,
          volumeM3: 0.015,
        },
      ]);
    }
    setRouteMeta(null);
    setQuotes([]);
    setPolyline([]);
  }

  function updateStop(id: string, patch: Partial<StopDraft>) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStop(id: string) {
    setStops((prev) => prev.filter((s) => s.id !== id));
    setRouteMeta(null);
    setQuotes([]);
    setPolyline([]);
  }

  async function handleOptimizeRoute() {
    if (stops.length === 0) {
      setFeedback({ type: "error", msg: "Tambahkan minimal 1 titik antar terlebih dahulu." });
      return;
    }
    setOptimizing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/osrm-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup, stops }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", msg: data.error || "Gagal optimasi rute" });
        setOptimizing(false);
        return;
      }

      // Reorder stops based on OSRM optimization
      setStops(
        data.orderedStops.map((s: StopDraft, i: number) => ({
          ...s,
          id: s.id || `opt-${i}`,
        }))
      );
      setPolyline(data.polyline || []);
      setRouteMeta({
        totalDistanceKm: data.totalDistanceKm,
        durationMinutes: data.durationMinutes,
        method: data.method,
        totalWeightKg: data.totalWeightKg,
        totalVolumeM3: data.totalVolumeM3,
      });
      setQuotes(data.quotes || []);

      // Auto-select first eligible vehicle
      const firstEligible = (data.quotes || []).find((q: VehicleQuote) => q.eligible);
      setSelectedVehicle(firstEligible ? firstEligible.vehicleType : null);
    } catch {
      setFeedback({ type: "error", msg: "Gagal menghubungi layanan optimasi rute." });
    } finally {
      setOptimizing(false);
    }
  }

  async function handleCreateOrder() {
    if (!selectedVehicle) {
      setFeedback({ type: "error", msg: "Pilih armada yang sesuai kapasitas terlebih dahulu." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleType: selectedVehicle,
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          stops,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", msg: data.error || "Gagal membuat pesanan" });
        setSubmitting(false);
        return;
      }

      setFeedback({
        type: "success",
        msg: `Pesanan ${data.order.orderCode} berhasil dibuat! Menunggu driver menerima.`,
      });
      await loadOrders();
      setSelectedOrderId(data.order.id);
      setActiveTab("ORDERS");
    } catch {
      setFeedback({ type: "error", msg: "Terjadi kesalahan saat mengirim pesanan." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRateOrder(orderId: string) {
    const entry = ratingMap[orderId] || { rating: 5, review: "" };
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "RATE",
        rating: entry.rating,
        review: entry.review,
      }),
    });
    if (res.ok) {
      loadOrders();
    }
  }

  async function handleCancelOrder(orderId: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CANCEL" }),
    });
    if (res.ok) {
      loadOrders();
    }
  }

  const trackedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Header + Tabs */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Pemesan</h1>
            <p className="text-xs text-slate-500">
              Buat pesanan ekspedisi multi-titik, optimasi rute terpendek, dan lacak driver secara
              langsung.
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("CREATE")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "CREATE"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              + Buat Pesanan Multi-Titik
            </button>
            <button
              onClick={() => {
                setActiveTab("ORDERS");
                loadOrders();
              }}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "ORDERS"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pelacakan & Riwayat ({orders.length})
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {activeTab === "CREATE" ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left: Interactive Map & Route Summary */}
            <div className="space-y-4 lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Peta Interaktif Multi-Drop (Leaflet + OSRM)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Klik di peta untuk menentukan titik jemput atau menambah titik tujuan baru.
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setClickMode("PICKUP")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        clickMode === "PICKUP"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      Set Jemput (J)
                    </button>
                    <button
                      type="button"
                      onClick={() => setClickMode("STOP")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        clickMode === "STOP"
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      + Tambah Tujuan
                    </button>
                  </div>
                </div>

                <MapWrapper
                  pickup={pickup}
                  stops={stops.map((s, i) => ({
                    id: s.id,
                    label: s.recipientName,
                    address: s.address,
                    lat: s.lat,
                    lng: s.lng,
                    sequenceOrder: s.sequenceOrder ?? i + 1,
                  }))}
                  polyline={polyline}
                  clickMode={clickMode}
                  onMapClick={handleMapClick}
                  heightClass="h-[420px]"
                />

                {/* Route stats bar */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-medium text-slate-500">Total Berat</p>
                    <p
                      className={`text-base font-bold ${
                        liveTotalWeight > 20 ? "text-amber-600" : "text-slate-900"
                      }`}
                    >
                      {liveTotalWeight} kg
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-medium text-slate-500">Total Volume</p>
                    <p className="text-base font-bold text-slate-900">{liveTotalVolume} m³</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-medium text-slate-500">Jarak Optimasi</p>
                    <p className="text-base font-bold text-indigo-700">
                      {routeMeta ? `${routeMeta.totalDistanceKm} km` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] font-medium text-slate-500">Estimasi Waktu</p>
                    <p className="text-base font-bold text-slate-900">
                      {routeMeta ? `${routeMeta.durationMinutes} mnt` : "—"}
                    </p>
                  </div>
                </div>

                {routeMeta && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Metode optimasi:{" "}
                    <span className="font-semibold text-indigo-700">
                      {routeMeta.method === "OSRM"
                        ? "OSRM Trip API (Rute Jalan Raya Terpendek)"
                        : "Nearest Neighbor + Haversine (Fallback)"}
                    </span>
                  </p>
                )}
              </div>

              {/* Vehicle Selection & Pricing */}
              {quotes.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-bold text-slate-900">
                    Pilih Armada & Estimasi Tarif Otomatis
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {quotes.map((q) => {
                      const isSelected = selectedVehicle === q.vehicleType;
                      return (
                        <button
                          key={q.vehicleType}
                          type="button"
                          disabled={!q.eligible}
                          onClick={() => setSelectedVehicle(q.vehicleType)}
                          className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                            !q.eligible
                              ? "cursor-not-allowed border-rose-200 bg-rose-50/50 opacity-75"
                              : isSelected
                              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20"
                              : "border-slate-200 bg-white hover:border-indigo-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{q.label}</span>
                              {!q.eligible ? (
                                <Lock className="h-4 w-4 text-rose-500" />
                              ) : isSelected ? (
                                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Maks {q.maxWeightKg} kg • {q.maxVolumeM3} m³
                            </p>
                            {q.lockedReason && (
                              <p className="mt-2 inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                <AlertTriangle className="h-3 w-3" />
                                {q.lockedReason}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 border-t border-slate-200/70 pt-2">
                            <p className="text-base font-extrabold text-indigo-700">
                              {formatRupiah(q.totalPrice)}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Dasar {formatRupiah(q.baseFare)} + Jarak{" "}
                              {formatRupiah(q.distanceFee)} + Multi-Drop{" "}
                              {formatRupiah(q.multiDropFeeTotal)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateOrder}
                    disabled={!selectedVehicle || submitting}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                    Buat Pesanan Sekarang
                  </button>
                </div>
              )}
            </div>

            {/* Right: Pickup & Multi-Drop Stops Form */}
            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <MapPin className="h-4 w-4" />
                  Titik Jemput (A)
                </h2>
                <input
                  type="text"
                  value={pickup.address}
                  onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  placeholder="Alamat penjemputan"
                />
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  Koordinat: {pickup.lat}, {pickup.lng}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Titik Antar ({stops.length} Titik)
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const preset = PRESET_STOPS[stops.length % PRESET_STOPS.length];
                      setStops((prev) => [
                        ...prev,
                        { id: `preset-${Date.now()}`, ...preset },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Contoh Titik
                  </button>
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {stops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">
                            {stop.sequenceOrder ?? idx + 1}
                          </span>
                          Titik Antar #{stop.sequenceOrder ?? idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeStop(stop.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={stop.recipientName}
                          onChange={(e) =>
                            updateStop(stop.id, { recipientName: e.target.value })
                          }
                          placeholder="Nama Penerima"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={stop.recipientPhone}
                          onChange={(e) =>
                            updateStop(stop.id, { recipientPhone: e.target.value })
                          }
                          placeholder="No. HP Penerima"
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={stop.address}
                          onChange={(e) => updateStop(stop.id, { address: e.target.value })}
                          placeholder="Alamat Tujuan"
                          className="col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={stop.itemDesc}
                          onChange={(e) => updateStop(stop.id, { itemDesc: e.target.value })}
                          placeholder="Deskripsi Barang"
                          className="col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500">
                            Berat (kg)
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={stop.weightKg}
                            onChange={(e) =>
                              updateStop(stop.id, { weightKg: Number(e.target.value) })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500">
                            Volume (m³)
                          </label>
                          <input
                            type="number"
                            min={0.005}
                            step={0.01}
                            value={stop.volumeM3}
                            onChange={(e) =>
                              updateStop(stop.id, { volumeM3: Number(e.target.value) })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleOptimizeRoute}
                  disabled={optimizing || stops.length === 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {optimizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Route className="h-4 w-4" />
                  )}
                  Optimasi Rute & Hitung Tarif
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ORDERS & LIVE TRACKING TAB */
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-5">
              {orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Belum ada pesanan. Silakan buat pesanan multi-titik pertama Anda.
                </div>
              ) : (
                orders.map((order) => {
                  const st = ORDER_STATUS_META[order.status] || {
                    label: order.status,
                    badgeClass: "bg-slate-100 text-slate-700",
                  };
                  const active = trackedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        active
                          ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {order.orderCode}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.badgeClass}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600">
                        {VEHICLE_LABELS[order.vehicleType]} • {order.stops.length} Titik •{" "}
                        {order.totalWeightKg} kg • {order.totalDistanceKm} km
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-sm font-extrabold text-indigo-700">
                          {formatRupiah(order.totalPrice)}
                        </p>
                        {order.status === "PENDING" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelOrder(order.id);
                            }}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:col-span-7">
              {trackedOrder ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Pelacakan {trackedOrder.orderCode}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {trackedOrder.driver
                          ? `Driver: ${trackedOrder.driver.name} (${trackedOrder.driver.driverProfile?.plateNumber || "-"}) • ${trackedOrder.driver.phone}`
                          : "Menunggu penugasan driver..."}
                      </p>
                    </div>
                    <button
                      onClick={loadOrders}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Segarkan Posisi
                    </button>
                  </div>

                  <MapWrapper
                    pickup={{
                      lat: trackedOrder.pickupLat,
                      lng: trackedOrder.pickupLng,
                      address: trackedOrder.pickupAddress,
                    }}
                    stops={trackedOrder.stops.map((s) => ({
                      id: s.id,
                      label: s.recipientName,
                      address: s.address,
                      lat: s.lat,
                      lng: s.lng,
                      sequenceOrder: s.sequenceOrder,
                      status: s.status,
                    }))}
                    driverLocation={
                      trackedOrder.driver?.driverProfile?.currentLat &&
                      trackedOrder.driver?.driverProfile?.currentLng
                        ? {
                            lat: trackedOrder.driver.driverProfile.currentLat,
                            lng: trackedOrder.driver.driverProfile.currentLng,
                            label: trackedOrder.driver.name,
                          }
                        : null
                    }
                    heightClass="h-[320px]"
                  />

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Progres Titik Pengantaran
                    </h3>
                    {trackedOrder.stops.map((stop) => {
                      const sm = STOP_STATUS_META[stop.status] || {
                        label: stop.status,
                        badgeClass: "bg-slate-100 text-slate-700",
                      };
                      return (
                        <div
                          key={stop.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">
                              #{stop.sequenceOrder} {stop.recipientName} — {stop.itemDesc} (
                              {stop.weightKg} kg)
                            </p>
                            <p className="text-slate-500">{stop.address}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {stop.proofPhotoUrl && (
                              <a
                                href={stop.proofPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-indigo-600 underline"
                              >
                                Bukti POD
                              </a>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${sm.badgeClass}`}
                            >
                              {sm.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Rating box for completed orders */}
                  {trackedOrder.status === "COMPLETED" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                      {trackedOrder.rating ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                          Rating Anda: {trackedOrder.rating}/5 — &ldquo;
                          {trackedOrder.review || "Terima kasih!"}&rdquo;
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-amber-900">
                            Beri Rating & Ulasan Pengiriman
                          </p>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() =>
                                  setRatingMap((prev) => ({
                                    ...prev,
                                    [trackedOrder.id]: {
                                      rating: star,
                                      review: prev[trackedOrder.id]?.review || "",
                                    },
                                  }))
                                }
                                className="p-1"
                              >
                                <Star
                                  className={`h-5 w-5 ${
                                    (ratingMap[trackedOrder.id]?.rating || 5) >= star
                                      ? "fill-amber-400 text-amber-500"
                                      : "text-slate-300"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={ratingMap[trackedOrder.id]?.review || ""}
                              onChange={(e) =>
                                setRatingMap((prev) => ({
                                  ...prev,
                                  [trackedOrder.id]: {
                                    rating: prev[trackedOrder.id]?.rating || 5,
                                    review: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Tulis ulasan singkat..."
                              className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleRateOrder(trackedOrder.id)}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                            >
                              Kirim Rating
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-400">
                  <Clock className="mr-2 h-4 w-4" />
                  Pilih pesanan di sebelah kiri untuk melacak rute.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
