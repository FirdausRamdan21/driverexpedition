import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateVehicleQuotes,
  optimizeMultiDropRoute,
  GeoPoint,
  StopInput,
} from "@/lib/routing";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickup, stops } = body as {
      pickup?: GeoPoint;
      stops?: StopInput[];
    };

    if (!pickup || typeof pickup.lat !== "number" || typeof pickup.lng !== "number") {
      return NextResponse.json(
        { error: "Titik jemput (pickup) tidak valid" },
        { status: 400 }
      );
    }

    if (!Array.isArray(stops) || stops.length === 0) {
      return NextResponse.json(
        { error: "Minimal harus ada 1 titik tujuan pengantaran" },
        { status: 400 }
      );
    }

    const routeResult = await optimizeMultiDropRoute(pickup, stops);
    const totalWeightKg = Number(
      stops.reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0).toFixed(2)
    );
    const totalVolumeM3 = Number(
      stops.reduce((sum, s) => sum + (Number(s.volumeM3) || 0), 0).toFixed(3)
    );

    const pricingConfigs = await prisma.pricingConfig.findMany();
    const quotes = calculateVehicleQuotes(
      pricingConfigs,
      routeResult.totalDistanceKm,
      stops.length,
      totalWeightKg,
      totalVolumeM3
    );

    return NextResponse.json({
      ...routeResult,
      totalWeightKg,
      totalVolumeM3,
      quotes,
    });
  } catch (error) {
    console.error("OSRM route error:", error);
    return NextResponse.json(
      { error: "Gagal mengoptimasi rute multi-drop" },
      { status: 500 }
    );
  }
}
