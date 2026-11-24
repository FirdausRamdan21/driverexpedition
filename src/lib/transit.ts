export interface HalteDTO {
  id: string;
  name: string;
  lat: number;
  lng: number;
  orderIndex: number;
  routeId: string;
}

export interface TransitVehicleDTO {
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
  routeId: string;
  driver: {
    id: string;
    name: string;
    isOnline: boolean;
  };
  route?: {
    id: string;
    code: string;
    name: string;
    colorHex: string;
  };
}

export interface RouteDTO {
  id: string;
  code: string;
  name: string;
  colorHex: string;
  stops: HalteDTO[];
  vehicles: TransitVehicleDTO[];
}

export type OccupancyLevel = "LEGA" | "PADAT" | "PENUH";

export interface OccupancyInfo {
  level: OccupancyLevel;
  label: string;
  ratio: number;
  percentage: number;
  availableSeats: number;
  colorHex: string;
  badgeClass: string;
  dotClass: string;
}

export function getOccupancyInfo(
  occupiedSeats: number,
  maxSeats: number
): OccupancyInfo {
  const safeMax = Math.max(1, maxSeats);
  const safeOccupied = Math.min(safeMax, Math.max(0, occupiedSeats));
  const ratio = safeOccupied / safeMax;
  const percentage = Math.round(ratio * 100);
  const availableSeats = Math.max(0, safeMax - safeOccupied);

  if (ratio < 0.6) {
    return {
      level: "LEGA",
      label: "Lega",
      ratio,
      percentage,
      availableSeats,
      colorHex: "#16A34A",
      badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
      dotClass: "bg-emerald-500",
    };
  }

  if (ratio <= 0.85) {
    return {
      level: "PADAT",
      label: "Mulai Padat",
      ratio,
      percentage,
      availableSeats,
      colorHex: "#CA8A04",
      badgeClass: "bg-amber-500/15 text-amber-700 border-amber-500/30",
      dotClass: "bg-amber-500",
    };
  }

  return {
    level: "PENUH",
    label: "Penuh",
    ratio,
    percentage,
    availableSeats,
    colorHex: "#DC2626",
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    dotClass: "bg-rose-500",
  };
}

/**
 * Menghitung jarak antara dua koordinat GPS dalam kilometer menggunakan rumus Haversine.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestHalte(
  lat: number,
  lng: number,
  stops: HalteDTO[]
): { halte: HalteDTO; distanceKm: number } | null {
  if (stops.length === 0) return null;
  let nearest = stops[0];
  let minDistance = haversineDistanceKm(lat, lng, stops[0].lat, stops[0].lng);

  for (let i = 1; i < stops.length; i++) {
    const d = haversineDistanceKm(lat, lng, stops[i].lat, stops[i].lng);
    if (d < minDistance) {
      minDistance = d;
      nearest = stops[i];
    }
  }

  return { halte: nearest, distanceKm: minDistance };
}
