import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600", "700"], display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", weight: ["600", "700"], display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: "Corplex — Rekam Hukum Hidup",
  description: "Legal Due Diligence perusahaan Anda, selalu siap. CORPLEX by MRWP Law Firm.",
  icons: { icon: "/logo-mrwp.svg" },
  openGraph: {
    title: "Corplex — Rekam Hukum Hidup",
    description: "Legal Due Diligence perusahaan Anda, selalu siap. CORPLEX by MRWP Law Firm.",
    siteName: "Corplex", type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
