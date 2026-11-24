import { NextResponse } from "next/server";
import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole([Role.OWNER, Role.KARYAWAN]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const orders = await prisma.order.findMany({
      include: {
        driver: {
          select: { id: true, name: true, driverProfile: true },
        },
        stops: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const validOrders = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    const completedOrders = orders.filter((o) => o.status === OrderStatus.COMPLETED);

    const grossRevenue = validOrders.reduce((s, o) => s + o.totalPrice, 0);
    const platformRevenue = validOrders.reduce((s, o) => s + o.platformFee, 0);
    const driverPayout = validOrders.reduce((s, o) => s + o.driverEarning, 0);

    const completedGross = completedOrders.reduce((s, o) => s + o.totalPrice, 0);
    const completedPlatform = completedOrders.reduce((s, o) => s + o.platformFee, 0);

    const byStatus: Record<string, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      IN_DELIVERY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    const byVehicle: Record<string, { count: number; revenue: number; distanceKm: number }> = {
      MOTOR: { count: 0, revenue: 0, distanceKm: 0 },
      VAN: { count: 0, revenue: 0, distanceKm: 0 },
      MOBIL_BOX: { count: 0, revenue: 0, distanceKm: 0 },
    };

    const driverPerfMap = new Map<
      string,
      {
        driverId: string;
        name: string;
        vehicleType: string;
        completedCount: number;
        totalEarning: number;
        totalDistanceKm: number;
        ratingSum: number;
        ratingCount: number;
      }
    >();

    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      if (o.status !== OrderStatus.CANCELLED) {
        const v = byVehicle[o.vehicleType];
        if (v) {
          v.count += 1;
          v.revenue += o.totalPrice;
          v.distanceKm = Number((v.distanceKm + o.totalDistanceKm).toFixed(2));
        }
      }

      if (o.driver && o.status !== OrderStatus.CANCELLED) {
        const existing = driverPerfMap.get(o.driver.id) || {
          driverId: o.driver.id,
          name: o.driver.name,
          vehicleType: o.driver.driverProfile?.vehicleType || o.vehicleType,
          completedCount: 0,
          totalEarning: 0,
          totalDistanceKm: 0,
          ratingSum: 0,
          ratingCount: 0,
        };
        if (o.status === OrderStatus.COMPLETED) existing.completedCount += 1;
        existing.totalEarning += o.driverEarning;
        existing.totalDistanceKm = Number(
          (existing.totalDistanceKm + o.totalDistanceKm).toFixed(2)
        );
        if (o.rating) {
          existing.ratingSum += o.rating;
          existing.ratingCount += 1;
        }
        driverPerfMap.set(o.driver.id, existing);
      }
    }

    const driverPerformance = Array.from(driverPerfMap.values())
      .map((d) => ({
        ...d,
        avgRating: d.ratingCount > 0 ? Number((d.ratingSum / d.ratingCount).toFixed(1)) : null,
      }))
      .sort((a, b) => b.totalEarning - a.totalEarning);

    return NextResponse.json({
      summary: {
        totalOrders: orders.length,
        activeOrders: byStatus.PENDING + byStatus.ACCEPTED + byStatus.IN_DELIVERY,
        completedOrders: byStatus.COMPLETED,
        grossRevenue,
        platformRevenue,
        driverPayout,
        completedGross,
        completedPlatform,
      },
      byStatus,
      byVehicle,
      driverPerformance,
    });
  } catch (error) {
    console.error("GET analytics error:", error);
    return NextResponse.json(
      { error: "Gagal memuat analitik" },
      { status: 500 }
    );
  }
}
