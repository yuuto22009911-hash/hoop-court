"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="app-tabbar" aria-label="メインナビ">
      <Link href="/" className={pathname === "/" ? "active" : ""}>
        予約する
      </Link>
      <Link href="/mypage" className={pathname.startsWith("/mypage") ? "active" : ""}>
        マイページ
      </Link>
    </nav>
  );
}
