"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

export interface MapStopMarker {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  sequenceOrder?: number;
  status?: string;
}

export interface MultiDropMapProps {
  pickup: { lat: number; lng: number; address?: string } | null;
  stops: MapStopMarker[];
  polyline?: [number, number][];
  driverLocation?: { lat: number; lng: number; label?: string } | null;
  clickMode?: "PICKUP" | "STOP" | "NONE";
  onMapClick?: (lat: number, lng: number) => void;
  heightClass?: string;
}

function createCircleIcon(text: string, bgColor: string, ringColor = "#ffffff") {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="
      width: 30px;
      height: 30px;
      border-radius: 9999px;
      background: ${bgColor};
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2.5px solid ${ringColor};
      box-shadow: 0 3px 10px rgba(15,23,42,0.35);
    ">${text}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function MapClickHandler({
  clickMode,
  onMapClick,
}: {
  clickMode: "PICKUP" | "STOP" | "NONE";
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (clickMode !== "NONE" && onMapClick) {
        onMapClick(
          Number(e.latlng.lat.toFixed(5)),
          Number(e.latlng.lng.toFixed(5))
        );
      }
    },
  });
  return null;
}

function FitBoundsHelper({
  pickup,
  stops,
  driverLocation,
}: {
  pickup: { lat: number; lng: number } | null;
  stops: MapStopMarker[];
  driverLocation?: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (pickup) points.push([pickup.lat, pickup.lng]);
    for (const s of stops) points.push([s.lat, s.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);

    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [map, pickup, stops, driverLocation]);

  return null;
}

export default function MultiDropMap({
  pickup,
  stops,
  polyline = [],
  driverLocation,
  clickMode = "NONE",
  onMapClick,
  heightClass = "h-[400px]",
}: MultiDropMapProps) {
  const defaultCenter: [number, number] = pickup
    ? [pickup.lat, pickup.lng]
    : [-6.2088, 106.8456];

  const pickupIcon = createCircleIcon("J", "#059669");
  const driverIcon = createCircleIcon("D", "#f59e0b", "#fef3c7");

  const fallbackLine: [number, number][] =
    polyline.length > 0
      ? polyline
      : pickup && stops.length > 0
      ? [[pickup.lat, pickup.lng], ...stops.map((s) => [s.lat, s.lng] as [number, number])]
      : [];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${heightClass}`}
    >
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler clickMode={clickMode} onMapClick={onMapClick} />
        <FitBoundsHelper
          pickup={pickup}
          stops={stops}
          driverLocation={driverLocation}
        />

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-emerald-700">Titik Jemput (A)</p>
                <p className="text-slate-600">{pickup.address || "Lokasi Penjemputan"}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {stops.map((stop, idx) => {
          const seq = stop.sequenceOrder ?? idx + 1;
          const color =
            stop.status === "DELIVERED"
              ? "#10b981"
              : stop.status === "FAILED"
              ? "#e11d48"
              : "#4f46e5";

          return (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createCircleIcon(String(seq), color)}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-indigo-700">
                    Pemberhentian #{seq} — {stop.label}
                  </p>
                  <p className="text-slate-600">{stop.address}</p>
                  {stop.status && (
                    <p className="mt-1 font-semibold text-slate-800">
                      Status: {stop.status}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {driverLocation && (
          <Marker
            position={[driverLocation.lat, driverLocation.lng]}
            icon={driverIcon}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold text-amber-700">Posisi Driver Saat Ini</p>
                <p className="text-slate-600">{driverLocation.label || "Armada Aktif"}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {fallbackLine.length >= 2 && (
          <Polyline
            positions={fallbackLine}
            pathOptions={{
              color: polyline.length > 0 ? "#4f46e5" : "#94a3b8",
              weight: polyline.length > 0 ? 4 : 3,
              dashArray: polyline.length > 0 ? undefined : "6, 8",
              opacity: 0.9,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
