import type { Metadata, Viewport } from "next";
import { Bagel_Fat_One, Nunito } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bagel",
  display: "swap",
});

const nunito = Nunito({
  weight: ["600", "800"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Boxcade – mystery box midway",
  description: "Mystery boxes. Real prizes. Digital pals and physical collectibles sealed inside every crate.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bagel.variable} ${nunito.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
