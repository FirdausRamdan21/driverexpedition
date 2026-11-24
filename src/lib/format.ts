export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const VEHICLE_LABELS: Record<string, string> = {
  MOTOR: "Motor (Kilat)",
  VAN: "Mobil Van",
  MOBIL_BOX: "Mobil Box / Pick-up",
};

export const ORDER_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  PENDING: {
    label: "Menunggu Driver",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ACCEPTED: {
    label: "Menuju Jemput",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  IN_DELIVERY: {
    label: "Sedang Diantar",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  COMPLETED: {
    label: "Selesai",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  CANCELLED: {
    label: "Dibatalkan",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

export const STOP_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  WAITING: {
    label: "Menunggu",
    badgeClass: "bg-slate-100 text-slate-700",
  },
  ARRIVED: {
    label: "Tiba di Lokasi",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  DELIVERED: {
    label: "Terkirim",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  FAILED: {
    label: "Kendala / Gagal",
    badgeClass: "bg-rose-100 text-rose-700",
  },
};

export const ROLE_META: Record<string, { label: string; color: string }> = {
  USER: { label: "Pemesan (User)", color: "bg-sky-100 text-sky-800" },
  DRIVER: { label: "Pengantar (Driver)", color: "bg-emerald-100 text-emerald-800" },
  KARYAWAN: { label: "Admin (Karyawan)", color: "bg-amber-100 text-amber-800" },
  OWNER: { label: "Pemilik (Owner)", color: "bg-purple-100 text-purple-800" },
};
