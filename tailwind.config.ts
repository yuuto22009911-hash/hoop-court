import type { Config } from "tailwindcss";

// 仕様書 §2.2 ビジュアル規約に準拠したカラーパレット
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e60012", // ホットペッパービューティー準拠の赤
          dark: "#b80010"
        },
        ink: "#1f2937",
        muted: "#6b7280",
        line: "#e5e7eb",
        success: "#047857",
        warning: "#92400e",
        danger: "#b91c1c",
        sat: "#2563eb", // 土曜
        sun: "#dc2626", // 日曜
        canvas: "#f5f5f5"
      },
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Yu Gothic"', "-apple-system", "sans-serif"]
      },
      borderRadius: {
        btn: "6px",
        card: "8px",
        badge: "3px"
      }
    }
  },
  plugins: []
};
export default config;
