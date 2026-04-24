/**
 * S-07 プロフィール登録画面
 * 仕様書 §3.4 / 認証フロー §6.6。
 * 初回ログイン時と users に行が無い場合に表示する。
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initLiff, getIdToken, getLiffProfile } from "@/lib/auth";
import { authRegister } from "@/lib/gas";

export default function RegisterPage() {
  const router = useRouter();
  const [display_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [team_name, setTeam] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initLiff()
      .then(() => getLiffProfile())
      .then((p) => {
        if (p.displayName) setName(p.displayName);
      })
      .catch(console.error);
  }, []);

  const canSubmit =
    display_name.trim() && phone.trim() && /^\S+@\S+\.\S+$/.test(email) && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authRegister(getIdToken(), {
        display_name,
        phone,
        email,
        team_name: team_name || undefined
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="app-header">プロフィール登録</header>
      <main className="app-main">
        <p className="mb-4 text-sm">
          初回ご利用にあたり、下記の情報をご登録ください。
          現地払いのため、電話番号・メールは必須です。
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            お名前<span className="req">*</span>
            <input
              type="text"
              value={display_name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
            />
          </label>
          <label className="field">
            電話番号<span className="req">*</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08012345678"
              required
            />
          </label>
          <label className="field">
            メールアドレス<span className="req">*</span>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="field">
            団体名（任意）
            <input
              type="text"
              value={team_name}
              onChange={(e) => setTeam(e.target.value)}
              maxLength={60}
            />
          </label>

          {error && (
            <p className="text-danger mb-3" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
            {submitting ? "登録中..." : "この内容で登録する"}
          </button>
        </form>
      </main>
    </>
  );
}

export const runtime = 'edge';
