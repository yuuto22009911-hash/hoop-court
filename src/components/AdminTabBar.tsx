"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "ダッシュ" },
  { href: "/admin/reservations", label: "予約" },
  { href: "/admin/slots", label: "枠" },
  { href: "/admin/checkin", label: "QR" },
  { href: "/admin/broadcast", label: "配信" }
];

export default function AdminTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="app-tabbar"
      aria-label="管理メニュー"
      style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || (t.href !== "/admin" && pathname.startsWith(t.href));
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
