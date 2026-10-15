import { PHONE_NUMBER } from "@/lib/contact";

/** 当日分は LINE で受け付けず、カウンター（電話）で相談してもらう案内 */
export default function SameDayNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`notice ${className}`} role="note">
      <p className="font-semibold mb-1">当日のご予約はカウンターで承ります</p>
      <p className="text-sm">
        LINE からは翌日以降の枠をご予約いただけます。当日のご利用はカウンターでご相談ください（電話{" "}
        <a href={`tel:${PHONE_NUMBER}`} className="underline">
          {PHONE_NUMBER}
        </a>
        ）。
      </p>
    </div>
  );
}
