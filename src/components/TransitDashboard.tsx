"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Bus,
  MapPin,
  Navigation,
  RefreshCw,
  Users,
  Crosshair,
  Radio,
  ArrowRight,
} from "lucide-react";
import {
  RouteDTO,
  findNearestHalte,
  getOccupancyInfo,
} from "@/lib/transit";

const TransitMap = dynamic(() => import("./TransitMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm text-slate-500">
      Memuat peta interaktif Leaflet...
    </div>
  ),
});

export function TransitDashboard() {
  const [routes, setRoutes] = useState<RouteDTO[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routePaths, setRoutePaths] = useState<
    Record<string, [number, number][]>
  >({});
  const [focusedPosition, setFocusedPosition] = useState<
    [number, number] | null
  >(null);
  const [userPin, setUserPin] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch("/api/routes", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil data rute");
      const data = (await res.json()) as { routes: RouteDTO[] };
      setRoutes(data.routes);
      setSelectedRouteId((prev) => prev || data.routes[0]?.id || "");
      setLastSync(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan memuat data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling setiap 3 detik untuk real-time tracking lokal
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void fetchRoutes(false);
    }, 0);
    const interval = setInterval(() => {
      void fetchRoutes(false);
    }, 3000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [fetchRoutes]);

  // Ambil garis rute jalan raya (OSRM) saat koridor berganti
  useEffect(() => {
    if (!selectedRouteId || routePaths[selectedRouteId]) return;

    let cancelled = false;
    fetch(`/api/osrm-route?routeId=${encodeURIComponent(selectedRouteId)}`)
      .then((res) => res.json())
      .then((data: { coordinates?: [number, number][] }) => {
        if (!cancelled && data.coordinates && data.coordinates.length > 0) {
          setRoutePaths((prev) => ({
            ...prev,
            [selectedRouteId]: data.coordinates!,
          }));
        }
      })
      .catch(() => {
        // Fallback otomatis ke garis antar halte di TransitMap
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRouteId, routePaths]);

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null,
    [routes, selectedRouteId]
  );

  const nearestHalte = useMemo(() => {
    if (!userPin || !selectedRoute) return null;
    return findNearestHalte(userPin[0], userPin[1], selectedRoute.stops);
  }, [userPin, selectedRoute]);

  const handleSelectRoute = (id: string) => {
    setSelectedRouteId(id);
    setFocusedPosition(null);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setUserPin([lat, lng]);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row">
      {/* Sidebar Panel */}
      <aside className="flex w-full flex-col gap-4 lg:w-[390px] lg:shrink-0">
        {/* Status Sync Bar */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            <span>Live Polling 3 dtk</span>
            {lastSync && (
              <span className="text-slate-400">• {lastSync}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fetchRoutes(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Pilihan Koridor */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pilih Koridor Angkutan Umum
          </h2>
          {loading && routes.length === 0 ? (
            <div className="space-y-2">
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-2">
              {routes.map((route) => {
                const isSelected = route.id === selectedRoute?.id;
                const activeCount = route.vehicles.filter(
                  (v) => v.isActive
                ).length;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => handleSelectRoute(route.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 min-w-[52px] items-center justify-center rounded-lg px-2 text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: route.colorHex }}
                      >
                        {route.code}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {route.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {route.stops.length} Halte • {activeCount} Armada aktif
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Armada Aktif & Indikator Kursi */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Armada &amp; Sisa Kursi
            </h2>
            <Link
              href="/driver-transit"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Simulasi Driver
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Legenda Kapasitas */}
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Lega (&lt;60%)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Padat (60–85%)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Penuh (&gt;85%)
            </span>
          </div>

          <div className="space-y-2.5">
            {selectedRoute?.vehicles.map((vehicle) => {
              const occ = getOccupancyInfo(
                vehicle.occupiedSeats,
                vehicle.maxSeats
              );
              const stopName =
                selectedRoute.stops[vehicle.currentStopIdx]?.name ??
                "Dalam perjalanan";

              return (
                <div
                  key={vehicle.id}
                  className="rounded-xl border border-slate-200 p-3 transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Bus className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {vehicle.plateNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vehicle.vehicleType} • {vehicle.driver.name}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        vehicle.isActive
                          ? occ.badgeClass
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          vehicle.isActive ? occ.dotClass : "bg-slate-400"
                        }`}
                      />
                      {vehicle.isActive ? occ.label : "Nonaktif"}
                    </span>
                  </div>

                  {/* Progress Kursi */}
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5" />
                        {vehicle.occupiedSeats}/{vehicle.maxSeats} kursi terisi
                      </span>
                      <span className="font-semibold text-slate-800">
                        Sisa {occ.availableSeats}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${occ.percentage}%`,
                          backgroundColor: vehicle.isActive
                            ? occ.colorHex
                            : "#94A3B8",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 truncate text-slate-500">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                      <span className="truncate">{stopName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFocusedPosition([
                          vehicle.currentLat,
                          vehicle.currentLng,
                        ])
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200"
                    >
                      <Crosshair className="h-3 w-3" />
                      Fokus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deteksi Halte Terdekat (Haversine Preview) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Navigation className="h-3.5 w-3.5 text-rose-500" />
            Deteksi Halte Terdekat (Haversine)
          </div>
          {nearestHalte ? (
            <div className="mt-2.5 space-y-2">
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs text-rose-600">Rekomendasi Halte:</p>
                <p className="text-sm font-bold text-slate-900">
                  {nearestHalte.halte.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Jarak lurus:{" "}
                  <strong>{nearestHalte.distanceKm.toFixed(2)} km</strong> •
                  Estimasi ojek feeder{" "}
                  <strong>
                    ~{Math.max(2, Math.round(nearestHalte.distanceKm * 3.5))}{" "}
                    menit
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserPin(null)}
                className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset Titik Lokasi
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Klik titik mana saja di peta untuk menandai lokasi rumah Anda.
              Sistem akan menghitung halte terdekat di koridor ini secara
              otomatis.
            </p>
          )}
        </div>
      </aside>

      {/* Main Map Area */}
      <section className="flex min-h-[520px] flex-1 flex-col lg:min-h-[calc(100vh-6rem)]">
        <TransitMap
          route={selectedRoute}
          routePath={selectedRoute ? routePaths[selectedRoute.id] ?? [] : []}
          focusedPosition={focusedPosition}
          userPin={userPin}
          nearestHalte={nearestHalte}
          onMapClick={handleMapClick}
        />
      </section>
    </div>
  );
}
