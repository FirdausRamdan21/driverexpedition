import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireRole([Role.DRIVER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { isOnline, currentLat, currentLng } = body as {
      isOnline?: boolean;
      currentLat?: number;
      currentLng?: number;
    };

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: auth.user!.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profil driver tidak ditemukan" },
        { status: 404 }
      );
    }

    if (isOnline === true && !profile.isVerified) {
      return NextResponse.json(
        { error: "Akun belum diverifikasi oleh Karyawan. Tidak bisa ONLINE." },
        { status: 403 }
      );
    }

    const updated = await prisma.driverProfile.update({
      where: { userId: auth.user!.id },
      data: {
        ...(typeof isOnline === "boolean" ? { isOnline } : {}),
        ...(typeof currentLat === "number" ? { currentLat } : {}),
        ...(typeof currentLng === "number" ? { currentLng } : {}),
      },
    });

    return NextResponse.json({ driverProfile: updated });
  } catch (error) {
    console.error("PATCH driver profile error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui status driver" },
      { status: 500 }
    );
  }
}
