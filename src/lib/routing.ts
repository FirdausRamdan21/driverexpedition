import { PricingConfig, VehicleType } from "@prisma/client";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StopInput extends GeoPoint {
  id?: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  itemDesc: string;
  weightKg: number;
  volumeM3?: number;
}

export interface OptimizedStop extends StopInput {
  sequenceOrder: number;
}

export interface RouteOptimizationResult {
  orderedStops: OptimizedStop[];
  totalDistanceKm: number;
  durationMinutes: number;
  polyline: [number, number][]; // [lat, lng]
  method: "OSRM" | "HAVERSINE_FALLBACK";
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function optimizeStopsNearestNeighbor(
  pickup: GeoPoint,
  stops: StopInput[]
): RouteOptimizationResult {
  const remaining = [...stops];
  const ordered: OptimizedStop[] = [];
  let current: GeoPoint = pickup;
  let totalDist = 0;
  const polyline: [number, number][] = [[pickup.lat, pickup.lng]];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(current, remaining[i]);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    const nextStop = remaining.splice(bestIdx, 1)[0];
    // Road factor approximation (~1.25x straight line)
    totalDist += bestDist * 1.25;
    ordered.push({
      ...nextStop,
      sequenceOrder: ordered.length + 1,
    });
    polyline.push([nextStop.lat, nextStop.lng]);
    current = nextStop;
  }

  const roundedKm = Math.max(0.5, Number(totalDist.toFixed(2)));
  return {
    orderedStops: ordered,
    totalDistanceKm: roundedKm,
    durationMinutes: Math.max(5, Math.round((roundedKm / 28) * 60)),
    polyline,
    method: "HAVERSINE_FALLBACK",
  };
}

export async function optimizeMultiDropRoute(
  pickup: GeoPoint,
  stops: StopInput[]
): Promise<RouteOptimizationResult> {
  if (stops.length === 0) {
    return {
      orderedStops: [],
      totalDistanceKm: 0,
      durationMinutes: 0,
      polyline: [[pickup.lat, pickup.lng]],
      method: "HAVERSINE_FALLBACK",
    };
  }

  try {
    const allPoints = [pickup, ...stops];
    const coordStr = allPoints.map((p) => `${p.lng},${p.lat}`).join(";");

    // Use /route if only 1 stop, or /trip for multi-drop TSP optimization
    const url =
      stops.length === 1
        ? `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
        : `https://router.project-osrm.org/trip/v1/driving/${coordStr}?source=first&roundtrip=false&overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return optimizeStopsNearestNeighbor(pickup, stops);
    }

    const data = await res.json();

    if (stops.length === 1 && data.code === "Ok" && data.routes?.[0]) {
      const route = data.routes[0];
      const polyline: [number, number][] = (
        route.geometry?.coordinates || []
      ).map(([lng, lat]: [number, number]) => [lat, lng]);

      return {
        orderedStops: [{ ...stops[0], sequenceOrder: 1 }],
        totalDistanceKm: Math.max(0.5, Number((route.distance / 1000).toFixed(2))),
        durationMinutes: Math.max(3, Math.round(route.duration / 60)),
        polyline: polyline.length > 0 ? polyline : [[pickup.lat, pickup.lng], [stops[0].lat, stops[0].lng]],
        method: "OSRM",
      };
    }

    if (data.code === "Ok" && data.trips?.[0] && Array.isArray(data.waypoints)) {
      const trip = data.trips[0];
      // waypoints[0] is pickup (index 0), waypoints[1..n] correspond to stops[0..n-1]
      const stopWithOrder = stops.map((stop, idx) => {
        const wp = data.waypoints[idx + 1];
        return {
          stop,
          orderIndex: typeof wp?.waypoint_index === "number" ? wp.waypoint_index : idx + 1,
        };
      });

      stopWithOrder.sort((a, b) => a.orderIndex - b.orderIndex);

      const orderedStops: OptimizedStop[] = stopWithOrder.map((item, i) => ({
        ...item.stop,
        sequenceOrder: i + 1,
      }));

      const polyline: [number, number][] = (
        trip.geometry?.coordinates || []
      ).map(([lng, lat]: [number, number]) => [lat, lng]);

      return {
        orderedStops,
        totalDistanceKm: Math.max(0.5, Number((trip.distance / 1000).toFixed(2))),
        durationMinutes: Math.max(5, Math.round(trip.duration / 60)),
        polyline:
          polyline.length > 0
            ? polyline
            : [[pickup.lat, pickup.lng], ...orderedStops.map((s) => [s.lat, s.lng] as [number, number])],
        method: "OSRM",
      };
    }
  } catch {
    // Fallback gracefully to Nearest Neighbor + Haversine
  }

  return optimizeStopsNearestNeighbor(pickup, stops);
}

export interface VehicleQuote {
  vehicleType: VehicleType;
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

const VEHICLE_META: Record<VehicleType, { label: string; description: string }> = {
  MOTOR: {
    label: "Motor (Ekspedisi Kilat)",
    description: "Dokumen, makanan, dan paket kecil",
  },
  VAN: {
    label: "Mobil Van / Blind Van",
    description: "Paket menengah atau distribusi UMKM",
  },
  MOBIL_BOX: {
    label: "Mobil Box / Pick-up",
    description: "Barang grosir atau pindahan multi-titik",
  },
};

export function calculateVehicleQuotes(
  configs: PricingConfig[],
  totalDistanceKm: number,
  stopCount: number,
  totalWeightKg: number,
  totalVolumeM3: number
): VehicleQuote[] {
  const order: VehicleType[] = [VehicleType.MOTOR, VehicleType.VAN, VehicleType.MOBIL_BOX];
  const extraStops = Math.max(0, stopCount - 1);

  return order
    .map((vType) => {
      const cfg = configs.find((c) => c.vehicleType === vType);
      if (!cfg) return null;

      const overWeight = totalWeightKg > cfg.maxWeightKg;
      const overVolume = totalVolumeM3 > cfg.maxVolumeM3;
      let lockedReason: string | null = null;
      if (overWeight && overVolume) {
        lockedReason = `Melebihi batas ${cfg.maxWeightKg} kg & ${cfg.maxVolumeM3} m³`;
      } else if (overWeight) {
        lockedReason = `Melebihi batas berat ${cfg.maxWeightKg} kg`;
      } else if (overVolume) {
        lockedReason = `Melebihi batas volume ${cfg.maxVolumeM3} m³`;
      }

      const distanceFee = Math.round(totalDistanceKm * cfg.perKmRate);
      const multiDropFeeTotal = extraStops * cfg.multiDropFee;
      const totalPrice = cfg.baseFare + distanceFee + multiDropFeeTotal;
      const platformFee = Math.round(totalPrice * cfg.platformCutPct);
      const driverEarning = totalPrice - platformFee;

      return {
        vehicleType: vType,
        label: VEHICLE_META[vType].label,
        description: VEHICLE_META[vType].description,
        maxWeightKg: cfg.maxWeightKg,
        maxVolumeM3: cfg.maxVolumeM3,
        eligible: !overWeight && !overVolume,
        lockedReason,
        baseFare: cfg.baseFare,
        distanceFee,
        multiDropFeeTotal,
        totalPrice,
        platformFee,
        driverEarning,
      };
    })
    .filter((q): q is VehicleQuote => q !== null);
}
