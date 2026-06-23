import type { Config } from "tailwindcss";

// 向日葵株式会社 コーポレートサイトと統一したデザイントークン
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 体育館（スポーツ）アクセント＝LIFF の主アクセント
        accent: {
          DEFAULT: "#D86A3C",
          dark: "#B14E25",
          soft: "#FAE0D2"
        },
        // コーポレート コア（向日葵）
        brand: {
          DEFAULT: "#C99238",
          dark: "#9A6B1F",
          soft: "#F2E2C0"
        },
        petal: "#EFD96F",
        // ベース
        cream: "#FDFCF8",
        "cream-warm": "#F8F4E8",
        canvas: "#F8F4E8",
        ink: "#2F2418",
        muted: "#5E4F3C",
        line: "#DDD3B8",
        // リラクゼーション / レンタル（参考）
        relax: { DEFAULT: "#E9A2B1", dark: "#C77789", soft: "#FBE7EC" },
        rental: { DEFAULT: "#7BA84E", dark: "#5C8338", soft: "#E5EFD4" },
        // LINE 導線専用
        "line-green": "#06C755",
        // 機能色
        success: "#5B8C4A",
        danger: "#C24A3A",
        error: "#C24A3A",
        warning: "#D9962A",
        // カレンダー曜日
        sun: "#C24A3A",
        sat: "#4A6FA5"
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', '"Hiragino Sans"', '"Yu Gothic"', "sans-serif"],
        logo: ['"Zen Maru Gothic"', '"Noto Sans JP"', "sans-serif"]
      },
      borderRadius: {
        sm: "4px",
        md: "10px",
        lg: "16px",
        btn: "10px",
        card: "16px",
        badge: "4px",
        pill: "9999px"
      },
      boxShadow: {
        warm: "0 0 0 1px rgba(61,47,28,0.05), 0 10px 40px rgba(61,47,28,0.10)"
      }
    }
  },
  plugins: []
};
export default config;
