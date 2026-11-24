import { NextResponse } from "next/server";
import { OrderStatus, Role, StopStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action } = body as { action?: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { stops: { orderBy: { sequenceOrder: "asc" } } },
    });

    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    // DRIVER ACTIONS
    if (user.role === Role.DRIVER) {
      if (action === "ACCEPT") {
        if (order.status !== OrderStatus.PENDING || order.driverId) {
          return NextResponse.json(
            { error: "Pesanan sudah diambil driver lain atau tidak tersedia" },
            { status: 400 }
          );
        }
        if (!user.driverProfile?.isVerified) {
          return NextResponse.json(
            { error: "Akun driver Anda belum diverifikasi oleh Karyawan" },
            { status: 403 }
          );
        }
        const updated = await prisma.order.update({
          where: { id },
          data: { driverId: user.id, status: OrderStatus.ACCEPTED },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }

      if (order.driverId !== user.id) {
        return NextResponse.json(
          { error: "Anda bukan driver yang ditugaskan untuk pesanan ini" },
          { status: 403 }
        );
      }

      if (action === "START_DELIVERY") {
        const updated = await prisma.order.update({
          where: { id },
          data: { status: OrderStatus.IN_DELIVERY },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }

      if (action === "UPDATE_STOP") {
        const { stopId, status, proofPhotoUrl } = body as {
          stopId?: string;
          status?: StopStatus;
          proofPhotoUrl?: string;
        };

        if (!stopId || !status) {
          return NextResponse.json(
            { error: "stopId dan status wajib diisi" },
            { status: 400 }
          );
        }

        const targetStop = order.stops.find((s) => s.id === stopId);
        if (!targetStop) {
          return NextResponse.json({ error: "Titik antar tidak ditemukan" }, { status: 404 });
        }

        await prisma.orderStop.update({
          where: { id: stopId },
          data: {
            status,
            ...(proofPhotoUrl ? { proofPhotoUrl } : {}),
            ...(status === StopStatus.DELIVERED ? { completedAt: new Date() } : {}),
          },
        });

        // Move driver GPS to the stop coordinates
        await prisma.driverProfile.updateMany({
          where: { userId: user.id },
          data: { currentLat: targetStop.lat, currentLng: targetStop.lng },
        });

        // Check if all stops are delivered -> auto-complete order
        const refreshedStops = await prisma.orderStop.findMany({
          where: { orderId: id },
          orderBy: { sequenceOrder: "asc" },
        });

        const allDone = refreshedStops.every((s) => s.status === StopStatus.DELIVERED);
        const updatedOrder = await prisma.order.update({
          where: { id },
          data: {
            status: allDone ? OrderStatus.COMPLETED : OrderStatus.IN_DELIVERY,
          },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });

        return NextResponse.json({ order: updatedOrder });
      }
    }

    // USER ACTIONS (Cancel or Rate)
    if (user.role === Role.USER) {
      if (order.customerId !== user.id) {
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
      }

      if (action === "CANCEL") {
        if (order.status !== OrderStatus.PENDING) {
          return NextResponse.json(
            { error: "Hanya pesanan PENDING yang dapat dibatalkan" },
            { status: 400 }
          );
        }
        const updated = await prisma.order.update({
          where: { id },
          data: { status: OrderStatus.CANCELLED },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }

      if (action === "RATE") {
        const { rating, review } = body as { rating?: number; review?: string };
        if (!rating || rating < 1 || rating > 5) {
          return NextResponse.json({ error: "Rating harus 1 sampai 5" }, { status: 400 });
        }
        const updated = await prisma.order.update({
          where: { id },
          data: { rating: Math.round(rating), review: review?.trim() || null },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }
    }

    // KARYAWAN / OWNER ACTIONS (Manual dispatch, resolve issue, cancel)
    if (user.role === Role.KARYAWAN || user.role === Role.OWNER) {
      if (action === "MANUAL_DISPATCH") {
        const { driverId } = body as { driverId?: string };
        if (!driverId) {
          return NextResponse.json({ error: "driverId wajib dipilih" }, { status: 400 });
        }
        const updated = await prisma.order.update({
          where: { id },
          data: {
            driverId,
            status: order.status === OrderStatus.PENDING ? OrderStatus.ACCEPTED : order.status,
          },
          include: {
            driver: { select: { id: true, name: true, phone: true, driverProfile: true } },
            stops: { orderBy: { sequenceOrder: "asc" } },
          },
        });
        return NextResponse.json({ order: updated });
      }

      if (action === "UPDATE_ISSUE") {
        const { issueNote, resetStopId } = body as {
          issueNote?: string;
          resetStopId?: string;
        };
        if (resetStopId) {
          await prisma.orderStop.update({
            where: { id: resetStopId },
            data: { status: StopStatus.WAITING },
          });
        }
        const updated = await prisma.order.update({
          where: { id },
          data: { issueNote: issueNote?.trim() || null },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }

      if (action === "CANCEL") {
        const updated = await prisma.order.update({
          where: { id },
          data: { status: OrderStatus.CANCELLED },
          include: { stops: { orderBy: { sequenceOrder: "asc" } } },
        });
        return NextResponse.json({ order: updated });
      }
    }

    return NextResponse.json({ error: "Aksi tidak valid untuk role Anda" }, { status: 400 });
  } catch (error) {
    console.error("PATCH order error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui pesanan" },
      { status: 500 }
    );
  }
}
