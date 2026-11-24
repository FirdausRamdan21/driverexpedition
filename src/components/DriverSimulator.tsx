"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bus,
  Plus,
  Minus,
  Play,
  Square,
  SkipForward,
  SkipBack,
  Power,
  MapPin,
  Users,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { HalteDTO, getOccupancyInfo } from "@/lib/transit";

interface VehicleWithRoute {
  id: string;
  plateNumber: string;
  vehicleType: string;
  maxSeats: number;
  occupiedSeats: number;
  currentLat: number;
  currentLng: number;
  currentStopIdx: number;
  isActive: boolean;
  updatedAt: string;
  driver: {
    id: string;
    name: string;
    email: string;
    isOnline: boolean;
  };
  route: {
    id: string;
    code: string;
    name: string;
    colorHex: string;
    stops: HalteDTO[];
  };
}

export function DriverSimulator() {
  const [vehicles, setVehicles] = useState<VehicleWithRoute[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [autoDrive, setAutoDrive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/vehicles", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat daftar armada");
      const data = (await res.json()) as { vehicles: VehicleWithRoute[] };
      setVehicles(data.vehicles);
      setSelectedId((prev) => prev || data.vehicles[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const activeVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedId) ?? vehicles[0] ?? null,
    [vehicles, selectedId]
  );

  const sendAction = useCallback(
    async (
      vehicleId: string,
      payload: Record<string, unknown>,
      label?: string
    ) => {
      try {
        setBusyAction(String(payload.action ?? "update"));
        const res = await fetch(`/api/vehicles/${vehicleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Gagal memperbarui armada");
        const data = (await res.json()) as { vehicle: VehicleWithRoute };
        setVehicles((prev) =>
          prev.map((v) => (v.id === data.vehicle.id ? data.vehicle : v))
        );
        if (label) showToast(label);
      } finally {
        setBusyAction(null);
      }
    },
    []
  );

  // Mode Auto-Jalan: gerakkan armada ke halte berikutnya setiap 4 detik
  useEffect(() => {
    if (!autoDrive || !activeVehicle) return;
    const timer = setInterval(() => {
      sendAction(activeVehicle.id, { action: "move_next_stop" });
    }, 4000);
    return () => clearInterval(timer);
  }, [autoDrive, activeVehicle, sendAction]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-500">
        Memuat panel simulator driver angkutan umum...
      </div>
    );
  }

  if (!activeVehicle) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-slate-500">
        Belum ada armada terdaftar di database.
      </div>
    );
  }

  const occ = getOccupancyInfo(
    activeVehicle.occupiedSeats,
    activeVehicle.maxSeats
  );
  const stops = activeVehicle.route.stops;
  const currentStop = stops[activeVehicle.currentStopIdx];
  const nextStop =
    stops.length > 0
      ? stops[(activeVehicle.currentStopIdx + 1) % stops.length]
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Simulator Driver Angkutan Umum
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ubah jumlah penumpang (+1 / -1) dan gerakkan armada antar-halte dari
            laptop Anda. Peta Penumpang akan otomatis sinkron setiap 3 detik.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          Buka Peta di Tab Baru
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {toast}
        </div>
      )}

      {/* Pilih Armada */}
      <div className="grid gap-3 sm:grid-cols-3">
        {vehicles.map((v) => {
          const vOcc = getOccupancyInfo(v.occupiedSeats, v.maxSeats);
          const selected = v.id === activeVehicle.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setAutoDrive(false);
                setSelectedId(v.id);
              }}
              className={`rounded-2xl border p-4 text-left transition-all ${
                selected
                  ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: v.route.colorHex }}
                >
                  {v.route.code}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    v.isActive
                      ? vOcc.badgeClass
                      : "border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  {v.isActive ? vOcc.label : "Nonaktif"}
                </span>
              </div>
              <p className="mt-2 text-base font-bold text-slate-900">
                {v.plateNumber}
              </p>
              <p className="text-xs text-slate-500">
                {v.vehicleType} • {v.driver.name}
              </p>
              <p className="mt-1.5 text-xs font-medium text-slate-700">
                Kursi: {v.occupiedSeats}/{v.maxSeats}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Control Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Panel Kapasitas Kursi & Mode Bertugas */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: activeVehicle.route.colorHex }}
                >
                  <Bus className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {activeVehicle.plateNumber}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {activeVehicle.route.code} • {activeVehicle.route.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  sendAction(
                    activeVehicle.id,
                    { action: "toggle_active" },
                    activeVehicle.isActive
                      ? "Armada dinonaktifkan"
                      : "Mode Bertugas diaktifkan"
                  )
                }
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  activeVehicle.isActive
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                <Power className="h-3.5 w-3.5" />
                {activeVehicle.isActive ? "Sedang Bertugas" : "Nonaktif"}
              </button>
            </div>

            {/* Display Kursi Besar */}
            <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Users className="h-4 w-4" />
                Kapasitas Kursi Saat Ini
              </div>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold tracking-tight text-slate-900">
                  {activeVehicle.occupiedSeats}
                </span>
                <span className="text-xl font-semibold text-slate-400">
                  / {activeVehicle.maxSeats}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${occ.badgeClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${occ.dotClass}`} />
                  {occ.label} ({occ.percentage}%)
                </span>
                <span className="text-xs text-slate-500">
                  Sisa {occ.availableSeats} kursi kosong
                </span>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${occ.percentage}%`,
                    backgroundColor: occ.colorHex,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tombol Cepat +1 / -1 */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busyAction !== null || activeVehicle.occupiedSeats <= 0}
              onClick={() =>
                sendAction(
                  activeVehicle.id,
                  { action: "decrement_seat" },
                  "Penumpang turun (-1)"
                )
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-4 text-base font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus className="h-5 w-5" />
              -1 Turun
            </button>

            <button
              type="button"
              disabled={
                busyAction !== null ||
                activeVehicle.occupiedSeats >= activeVehicle.maxSeats
              }
              onClick={() =>
                sendAction(
                  activeVehicle.id,
                  { action: "increment_seat" },
                  "Penumpang naik (+1)"
                )
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              +1 Naik
            </button>
          </div>
        </div>

        {/* Panel Simulasi Pergerakan Halte */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Simulasi Pergerakan GPS Armada
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Pindahkan armada ke halte berikutnya atau nyalakan mode
              Auto-Simulasi untuk melihat bus bergerak di peta.
            </p>

            {/* Info Halte Sekarang & Berikutnya */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase text-blue-600">
                  Posisi Saat Ini
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {currentStop?.name ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  Halte Berikutnya
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {nextStop?.name ?? "-"}
                </p>
              </div>
            </div>

            {/* Daftar Halte Interaktif */}
            <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {stops.map((stop, idx) => {
                const isCurrent = idx === activeVehicle.currentStopIdx;
                return (
                  <button
                    key={stop.id}
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      sendAction(
                        activeVehicle.id,
                        { action: "move_to_stop", stopIndex: idx },
                        `Armada dipindahkan ke ${stop.name}`
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                      isCurrent
                        ? "bg-blue-600 font-semibold text-white shadow-sm"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          isCurrent
                            ? "bg-white text-blue-600"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {stop.orderIndex}
                      </span>
                      <span>{stop.name}</span>
                    </span>
                    {isCurrent && <MapPin className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tombol Kontrol Pergerakan */}
          <div className="mt-5 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  sendAction(
                    activeVehicle.id,
                    { action: "move_prev_stop" },
                    "Mundur ke halte sebelumnya"
                  )
                }
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <SkipBack className="h-4 w-4" />
                Sebelumnya
              </button>

              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() =>
                  sendAction(
                    activeVehicle.id,
                    { action: "move_next_stop" },
                    "Bergerak ke halte berikutnya"
                  )
                }
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" />
                Gerakkan ke Halte Berikutnya
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoDrive((prev) => !prev)}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                autoDrive
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {autoDrive ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Hentikan Auto-Simulasi (Aktif tiap 4 dtk)
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Mulai Auto-Simulasi Pergerakan (tiap 4 dtk)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
