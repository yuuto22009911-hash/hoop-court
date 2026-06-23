/**
 * ご利用案内（料金・営業時間・注意事項・施設案内）
 * 向日葵株式会社 コーポレートサイトの内容と整合させた静的ページ。
 */

import Link from "next/link";
import { formatYen } from "@/lib/format";
import {
  CHARTER_HOLIDAY,
  CHARTER_OVERTIME_WEEKDAY_EVENING,
  CHARTER_OVERTIME_WEEKDAY_MORNING,
  CHARTER_WEEKDAY_EVENING,
  CHARTER_WEEKDAY_MORNING,
  FREE_HOLIDAY_PER30,
  FREE_MAX_HEADCOUNT,
  FREE_WEEKDAY_PER30
} from "@/lib/pricing";

export default function InfoPage() {
  return (
    <>
      <header className="app-header">
        <Link href="/" className="back" aria-label="戻る">
          ←
        </Link>
        ご利用案内
      </header>
      <main className="app-main">
        <Section title="営業時間">
          <p className="text-sm">9:00〜20:00（年中無休）</p>
          <p className="text-xs text-muted mt-1">
            平日は 朝 9:00〜14:00 / 夕 14:00〜20:00、土日祝は 9:00〜20:00 通し。
          </p>
        </Section>

        <Section title="料金 — 貸切（コート／ハーフ1面・税込）">
          <table className="info-table">
            <tbody>
              <tr>
                <th>平日 朝（9:00〜14:00）</th>
                <td>{formatYen(CHARTER_WEEKDAY_MORNING)} / 1時間</td>
              </tr>
              <tr>
                <th>平日 夕（14:00〜20:00）</th>
                <td>{formatYen(CHARTER_WEEKDAY_EVENING)} / 1時間</td>
              </tr>
              <tr>
                <th>土日祝（9:00〜20:00）</th>
                <td>{formatYen(CHARTER_HOLIDAY)} / 1時間</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-1">
            予約は1時間単位（追加も1時間単位）。ご予約時間を過ぎると、平日朝
            {formatYen(CHARTER_OVERTIME_WEEKDAY_MORNING)}・平日夕
            {formatYen(CHARTER_OVERTIME_WEEKDAY_EVENING)}（30分ごと）の追加料金が発生します。
          </p>
        </Section>

        <Section title="料金 — バスケフリーゴール（税込）">
          <table className="info-table">
            <tbody>
              <tr>
                <th>平日</th>
                <td>{formatYen(FREE_WEEKDAY_PER30)} / 30分 / 人</td>
              </tr>
              <tr>
                <th>土日祝</th>
                <td>{formatYen(FREE_HOLIDAY_PER30)} / 30分 / 人</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted mt-1">
            バスケットボール限定・同一時間帯あたり最大 {FREE_MAX_HEADCOUNT} 名。
          </p>
        </Section>

        <Section title="お支払い・ご予約">
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>お支払いは PayPay（当日カウンターは現金も可）。</li>
            <li>ご予約はアプリ（LINE）から24時間可能。コートはご予約を最優先でご案内します。</li>
            <li>当日のご予約・変更はカウンターのみ（要相談）です。</li>
          </ul>
        </Section>

        <Section title="2F ギャラリー・リラクゼーション">
          <p className="text-sm mb-1">2F にコートを観覧できるギャラリーがあります。</p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            <li>ハンドマッサージ {formatYen(1300)} / 15分</li>
            <li>フットマッサージ {formatYen(1300)} / 15分</li>
            <li>ヘッドマッサージ {formatYen(1300)} / 15分</li>
            <li>フットバス {formatYen(1500)} / 20分</li>
          </ul>
          <p className="text-xs text-muted mt-1">
            リラクゼーションはネット予約のみ。マッサージチェアもご用意しています（料金は店頭にて）。
          </p>
          <p className="text-sm mt-2 font-semibold text-accent">
            コート予約＋リラクゼーション同時予約で、次回コート 200円引き！
          </p>
        </Section>

        <Section title="お問い合わせ">
          <p className="text-sm">向日葵株式会社</p>
          <p className="text-sm">電話: 090-7889-2729</p>
          <p className="text-sm">メール: himawari20251113@gmail.com</p>
          <p className="text-sm">所在地: 大阪府大東市浜町</p>
          <p className="text-sm mt-2">
            <a
              href="https://himawari-co.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-accent"
            >
              コーポレートサイトを見る
            </a>
          </p>
        </Section>

        <Link href="/" className="btn btn-primary w-full">
          予約カレンダーへ
        </Link>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-card mb-3">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

export const runtime = "edge";
