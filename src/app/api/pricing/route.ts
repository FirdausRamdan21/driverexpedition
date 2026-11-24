import { NextResponse } from "next/server";
import { Role, VehicleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    const configs = await prisma.pricingConfig.findMany({
      orderBy: { baseFare: "asc" },
    });
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("GET pricing error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil konfigurasi tarif" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRole([Role.OWNER, Role.KARYAWAN]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      vehicleType,
      baseFare,
      perKmRate,
      multiDropFee,
      platformCutPct,
      maxWeightKg,
      maxVolumeM3,
    } = body as {
      vehicleType?: VehicleType;
      baseFare?: number;
      perKmRate?: number;
      multiDropFee?: number;
      platformCutPct?: number;
      maxWeightKg?: number;
      maxVolumeM3?: number;
    };

    if (!vehicleType) {
      return NextResponse.json(
        { error: "vehicleType wajib diisi" },
        { status: 400 }
      );
    }

    // Karyawan can only update vehicle capacity limits; Owner can update pricing & limits
    const updateData: Record<string, number> = {};
    if (typeof maxWeightKg === "number" && maxWeightKg > 0) {
      updateData.maxWeightKg = maxWeightKg;
    }
    if (typeof maxVolumeM3 === "number" && maxVolumeM3 > 0) {
      updateData.maxVolumeM3 = maxVolumeM3;
    }

    if (auth.user!.role === Role.OWNER) {
      if (typeof baseFare === "number" && baseFare >= 0) updateData.baseFare = Math.round(baseFare);
      if (typeof perKmRate === "number" && perKmRate >= 0) updateData.perKmRate = Math.round(perKmRate);
      if (typeof multiDropFee === "number" && multiDropFee >= 0) updateData.multiDropFee = Math.round(multiDropFee);
      if (typeof platformCutPct === "number" && platformCutPct >= 0 && platformCutPct <= 0.5) {
        updateData.platformCutPct = platformCutPct;
      }
    }

    const updated = await prisma.pricingConfig.update({
      where: { vehicleType },
      data: updateData,
    });

    return NextResponse.json({ config: updated });
  } catch (error) {
    console.error("PATCH pricing error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui konfigurasi" },
      { status: 500 }
    );
  }
}
