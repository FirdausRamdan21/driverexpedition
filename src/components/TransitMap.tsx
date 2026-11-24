"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  HalteDTO,
  RouteDTO,
  TransitVehicleDTO,
  getOccupancyInfo,
} from "@/lib/transit";

interface TransitMapProps {
  route: RouteDTO | null;
  routePath: [number, number][];
  focusedPosition: [number, number] | null;
  userPin: [number, number] | null;
  nearestHalte: { halte: HalteDTO; distanceKm: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}

function MapController({
  route,
  focusedPosition,
}: {
  route: RouteDTO | null;
  focusedPosition: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (focusedPosition) {
      map.flyTo(focusedPosition, 15, { duration: 0.7 });
      return;
    }

    if (route && route.stops.length > 0) {
      const bounds = L.latLngBounds(
        route.stops.map((s) => [s.lat, s.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, route, focusedPosition]);

  return null;
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function createHalteIcon(
  orderIndex: number,
  colorHex: string,
  isNearest: boolean
) {
  return L.divIcon({
    className: "custom-halte-icon",
    html: `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        width:${isNearest ? 30 : 24}px;
        height:${isNearest ? 30 : 24}px;
        border-radius:9999px;
        background:${isNearest ? "#0F172A" : "#FFFFFF"};
        color:${isNearest ? "#FFFFFF" : colorHex};
        border:3px solid ${colorHex};
        font-weight:700;
        font-size:11px;
        box-shadow:0 2px 8px rgba(15,23,42,0.28);
      ">${orderIndex}</div>
    `,
    iconSize: [isNearest ? 30 : 24, isNearest ? 30 : 24],
    iconAnchor: [isNearest ? 15 : 12, isNearest ? 15 : 12],
  });
}

function createVehicleIcon(vehicle: TransitVehicleDTO) {
  const occ = getOccupancyInfo(vehicle.occupiedSeats, vehicle.maxSeats);
  const bg = vehicle.isActive ? occ.colorHex : "#64748B";
  const label =
    vehicle.vehicleType === "BUS"
      ? "BUS"
      : vehicle.vehicleType === "SHUTTLE"
      ? "SHT"
      : "ANG";

  return L.divIcon({
    className: "custom-vehicle-icon",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="
          display:flex;
          align-items:center;
          gap:4px;
          padding:4px 8px;
          border-radius:9999px;
          background:${bg};
          color:#FFFFFF;
          font-size:11px;
          font-weight:700;
          letter-spacing:0.02em;
          border:2px solid #FFFFFF;
          box-shadow:0 4px 12px rgba(15,23,42,0.35);
          white-space:nowrap;
        ">
          <span>${label}</span>
          <span style="opacity:0.9;">${vehicle.occupiedSeats}/${vehicle.maxSeats}</span>
        </div>
        <div style="
          width:0;
          height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-top:6px solid ${bg};
          margin-top:-1px;
        "></div>
      </div>
    `,
    iconSize: [78, 34],
    iconAnchor: [39, 34],
  });
}

function createUserPinIcon() {
  return L.divIcon({
    className: "custom-user-pin",
    html: `
      <div style="
        width:18px;
        height:18px;
        border-radius:9999px;
        background:#EF4444;
        border:3px solid #FFFFFF;
        box-shadow:0 0 0 4px rgba(239,68,68,0.28);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function TransitMap({
  route,
  routePath,
  focusedPosition,
  userPin,
  nearestHalte,
  onMapClick,
}: TransitMapProps) {
  const defaultCenter: [number, number] = [-6.245, 106.82];
  const userPinIcon = useMemo(() => createUserPinIcon(), []);

  const fallbackPath: [number, number][] = useMemo(() => {
    if (!route) return [];
    return route.stops.map((s) => [s.lat, s.lng]);
  }, [route]);

  const activePolyline = routePath.length > 1 ? routePath : fallbackPath;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController route={route} focusedPosition={focusedPosition} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* Garis rute koridor */}
        {route && activePolyline.length > 1 && (
          <Polyline
            positions={activePolyline}
            pathOptions={{
              color: route.colorHex,
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}

        {/* Garis putus-putus dari titik rumah penumpang ke halte terdekat */}
        {userPin && nearestHalte && (
          <Polyline
            positions={[
              userPin,
              [nearestHalte.halte.lat, nearestHalte.halte.lng],
            ]}
            pathOptions={{
              color: "#EF4444",
              weight: 3,
              dashArray: "6 8",
              opacity: 0.9,
            }}
          />
        )}

        {/* Marker Halte */}
        {route?.stops.map((stop) => {
          const isNearest = nearestHalte?.halte.id === stop.id;
          return (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createHalteIcon(stop.orderIndex, route.colorHex, isNearest)}
            >
              <Popup>
                <div className="min-w-[170px] space-y-1 text-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                      Halte #{stop.orderIndex}
                    </span>
                    {isNearest && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                        Terdekat
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold">{stop.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marker Armada Angkutan Umum */}
        {route?.vehicles.map((vehicle) => {
          const occ = getOccupancyInfo(vehicle.occupiedSeats, vehicle.maxSeats);
          const currentStop = route.stops[vehicle.currentStopIdx];
          return (
            <Marker
              key={vehicle.id}
              position={[vehicle.currentLat, vehicle.currentLng]}
              icon={createVehicleIcon(vehicle)}
              zIndexOffset={500}
            >
              <Popup>
                <div className="min-w-[200px] space-y-2 text-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      {vehicle.plateNumber}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{
                        backgroundColor: vehicle.isActive
                          ? occ.colorHex
                          : "#64748B",
                      }}
                    >
                      {vehicle.isActive ? occ.label : "Nonaktif"}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-600">
                    <p>
                      Jenis: <strong>{vehicle.vehicleType}</strong>
                    </p>
                    <p>
                      Driver: <strong>{vehicle.driver.name}</strong>
                    </p>
                    <p>
                      Kursi terisi:{" "}
                      <strong>
                        {vehicle.occupiedSeats} / {vehicle.maxSeats}
                      </strong>{" "}
                      ({occ.availableSeats} kosong)
                    </p>
                    {currentStop && (
                      <p>
                        Posisi: <strong>{currentStop.name}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Pin Lokasi Penumpang */}
        {userPin && (
          <Marker position={userPin} icon={userPinIcon} zIndexOffset={400}>
            <Popup>
              <div className="text-xs text-slate-700">
                <p className="font-bold text-slate-900">Titik Lokasi Anda</p>
                <p>
                  {userPin[0].toFixed(4)}, {userPin[1].toFixed(4)}
                </p>
                {nearestHalte && (
                  <p className="mt-1 text-rose-600">
                    Halte terdekat: <strong>{nearestHalte.halte.name}</strong> (
                    {nearestHalte.distanceKm.toFixed(2)} km)
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
