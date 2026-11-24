import { NextResponse } from "next/server";
import { OrderStatus, Role, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireRole } from "@/lib/auth";
import {
  calculateVehicleQuotes,
  optimizeMultiDropRoute,
  StopInput,
} from "@/lib/routing";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const include = {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
          driverProfile: true,
        },
      },
      stops: { orderBy: { sequenceOrder: "asc" as const } },
    };

    if (user.role === Role.USER) {
      const orders = await prisma.order.findMany({
        where: { customerId: user.id },
        include,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ orders });
    }

    if (user.role === Role.DRIVER) {
      const profile = user.driverProfile;
      const myOrders = await prisma.order.findMany({
        where: { driverId: user.id },
        include,
        orderBy: { createdAt: "desc" },
      });

      let availableOrders: typeof myOrders = [];
      if (profile && profile.isVerified && profile.isOnline) {
        availableOrders = await prisma.order.findMany({
          where: {
            status: OrderStatus.PENDING,
            driverId: null,
            vehicleType: profile.vehicleType,
            totalWeightKg: { lte: profile.maxWeightKg },
          },
          include,
          orderBy: { createdAt: "desc" },
        });
      }

      return NextResponse.json({ orders: myOrders, availableOrders });
    }

    // KARYAWAN & OWNER see all orders
    const orders = await prisma.order.findMany({
      include,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET orders error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data pesanan" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireRole([Role.USER, Role.KARYAWAN, Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      vehicleType,
      pickupAddress,
      pickupLat,
      pickupLng,
      stops,
    } = body as {
      vehicleType?: VehicleType;
      pickupAddress?: string;
      pickupLat?: number;
      pickupLng?: number;
      stops?: StopInput[];
    };

    if (
      !vehicleType ||
      !pickupAddress ||
      typeof pickupLat !== "number" ||
      typeof pickupLng !== "number" ||
      !Array.isArray(stops) ||
      stops.length === 0
    ) {
      return NextResponse.json(
        { error: "Data pesanan tidak lengkap (armada, titik jemput, dan minimal 1 tujuan wajib diisi)" },
        { status: 400 }
      );
    }

    const totalWeightKg = Number(
      stops.reduce((sum, s) => sum + (Number(s.weightKg) || 0), 0).toFixed(2)
    );
    const totalVolumeM3 = Number(
      stops.reduce((sum, s) => sum + (Number(s.volumeM3) || 0.01), 0).toFixed(3)
    );

    const routeResult = await optimizeMultiDropRoute(
      { lat: pickupLat, lng: pickupLng },
      stops
    );

    const configs = await prisma.pricingConfig.findMany();
    const quotes = calculateVehicleQuotes(
      configs,
      routeResult.totalDistanceKm,
      stops.length,
      totalWeightKg,
      totalVolumeM3
    );

    const selectedQuote = quotes.find((q) => q.vehicleType === vehicleType);
    if (!selectedQuote) {
      return NextResponse.json(
        { error: "Konfigurasi tarif armada tidak ditemukan" },
        { status: 400 }
      );
    }
    if (!selectedQuote.eligible) {
      return NextResponse.json(
        {
          error: `Armada ${selectedQuote.label} terkunci: ${selectedQuote.lockedReason}`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const countToday = await prisma.order.count();
    const orderCode = `EXP-${datePart}-${String(countToday + 1).padStart(3, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderCode,
        customerId: auth.user!.id,
        vehicleType,
        pickupAddress: pickupAddress.trim(),
        pickupLat,
        pickupLng,
        totalWeightKg,
        totalVolumeM3,
        totalDistanceKm: routeResult.totalDistanceKm,
        totalPrice: selectedQuote.totalPrice,
        platformFee: selectedQuote.platformFee,
        driverEarning: selectedQuote.driverEarning,
        status: OrderStatus.PENDING,
        stops: {
          create: routeResult.orderedStops.map((s) => ({
            sequenceOrder: s.sequenceOrder,
            recipientName: s.recipientName.trim() || "Penerima",
            recipientPhone: s.recipientPhone.trim() || "-",
            address: s.address.trim(),
            lat: s.lat,
            lng: s.lng,
            itemDesc: s.itemDesc.trim() || "Paket Ekspedisi",
            weightKg: Number(s.weightKg) || 1,
            volumeM3: Number(s.volumeM3) || 0.01,
          })),
        },
      },
      include: {
        stops: { orderBy: { sequenceOrder: "asc" } },
      },
    });

    return NextResponse.json({ order, route: routeResult }, { status: 201 });
  } catch (error) {
    console.error("POST order error:", error);
    return NextResponse.json(
      { error: "Gagal membuat pesanan" },
      { status: 500 }
    );
  }
}
