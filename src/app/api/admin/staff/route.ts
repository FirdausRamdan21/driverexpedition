import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";

export async function GET() {
  const auth = await requireRole([Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const staff = await prisma.user.findMany({
    where: { role: Role.KARYAWAN },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const auth = await requireRole([Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, email, password, phone } = body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
    };

    if (!name || !email || !password || !phone) {
      return NextResponse.json(
        { error: "Semua field karyawan wajib diisi" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashPassword(password),
        phone: phone.trim(),
        role: Role.KARYAWAN,
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (error) {
    console.error("POST staff error:", error);
    return NextResponse.json({ error: "Gagal menambah karyawan" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireRole([Role.OWNER]);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID karyawan wajib diisi" }, { status: 400 });
    }

    await prisma.user.deleteMany({
      where: { id, role: Role.KARYAWAN },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE staff error:", error);
    return NextResponse.json({ error: "Gagal menghapus karyawan" }, { status: 500 });
  }
}
