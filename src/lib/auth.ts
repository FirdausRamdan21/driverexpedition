import crypto from "crypto";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "expedition_session";

function getSecret(): string {
  return process.env.AUTH_SECRET || "driver-expedition-fallback-secret-2026";
}

export interface SessionPayload {
  userId: string;
  role: Role;
  exp: number;
}

export function signSession(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = crypto
      .createHmac("sha256", getSecret())
      .update(data)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const decoded = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!decoded.exp || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      driverProfile: true,
    },
  });

  return user;
}

export async function requireRole(allowedRoles: Role[]) {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized: silakan login terlebih dahulu", status: 401 as const, user: null };
  }
  if (!allowedRoles.includes(user.role)) {
    return { error: "Forbidden: akses ditolak untuk role Anda", status: 403 as const, user: null };
  }
  return { error: null, status: 200 as const, user };
}

export function getRoleDashboardPath(role: Role): string {
  switch (role) {
    case Role.USER:
      return "/dashboard/user";
    case Role.DRIVER:
      return "/dashboard/driver";
    case Role.KARYAWAN:
      return "/dashboard/karyawan";
    case Role.OWNER:
      return "/dashboard/owner";
    default:
      return "/login";
  }
}
