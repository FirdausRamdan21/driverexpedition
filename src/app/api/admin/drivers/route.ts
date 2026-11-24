import { NextResponse } from "next/server";
import { Role, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole([Role.KARYAWAN, Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const drivers = await prisma.user.findMany({
      where: { role: Role.DRIVER },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        driverProfile: true,
        ordersAsDriver: {
          select: {
            id: true,
            status: true,
            driverEarning: true,
            rating: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("GET admin drivers error:", error);
    return NextResponse.json(
      { error: "Gagal memuat daftar driver" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole([Role.KARYAWAN, Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { driverProfileId, isVerified, maxWeightKg, maxVolumeM3, vehicleType } =
      body as {
        driverProfileId?: string;
        isVerified?: boolean;
        maxWeightKg?: number;
        maxVolumeM3?: number;
        vehicleType?: VehicleType;
      };

    if (!driverProfileId) {
      return NextResponse.json(
        { error: "driverProfileId wajib diisi" },
        { status: 400 }
      );
    }

    const updated = await prisma.driverProfile.update({
      where: { id: driverProfileId },
      data: {
        ...(typeof isVerified === "boolean" ? { isVerified } : {}),
        ...(typeof maxWeightKg === "number" && maxWeightKg > 0 ? { maxWeightKg } : {}),
        ...(typeof maxVolumeM3 === "number" && maxVolumeM3 > 0 ? { maxVolumeM3 } : {}),
        ...(vehicleType ? { vehicleType } : {}),
      },
    });

    return NextResponse.json({ driverProfile: updated });
  } catch (error) {
    console.error("PATCH admin drivers error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data driver" },
      { status: 500 }
    );
  }
}
