import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const routeId = request.nextUrl.searchParams.get("routeId");

  if (!routeId) {
    return NextResponse.json(
      { error: "Parameter routeId wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        stops: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!route || route.stops.length < 2) {
      return NextResponse.json({ coordinates: [], source: "empty" });
    }

    const fallbackCoords: [number, number][] = route.stops.map((s) => [
      s.lat,
      s.lng,
    ]);

    const osrmPoints = route.stops.map((s) => `${s.lng},${s.lat}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${osrmPoints}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(osrmUrl, {
        signal: controller.signal,
        next: { revalidate: 3600 },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as {
          code?: string;
          routes?: Array<{
            geometry?: {
              coordinates?: [number, number][];
            };
          }>;
        };

        const geoCoords = data.routes?.[0]?.geometry?.coordinates;
        if (geoCoords && geoCoords.length > 0) {
          // OSRM returns [lng, lat], Leaflet expects [lat, lng]
          const latLngs: [number, number][] = geoCoords.map(([lng, lat]) => [
            lat,
            lng,
          ]);
          return NextResponse.json({ coordinates: latLngs, source: "osrm" });
        }
      }
    } catch {
      // Fallback gracefully to direct stop-to-stop polyline
    }

    return NextResponse.json({
      coordinates: fallbackCoords,
      source: "fallback",
    });
  } catch (error) {
    console.error("GET /api/osrm-route error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil geometri rute." },
      { status: 500 }
    );
  }
}
