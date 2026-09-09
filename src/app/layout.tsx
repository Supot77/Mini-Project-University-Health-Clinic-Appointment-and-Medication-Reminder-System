import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import TopProgressBar from "@/components/common/TopProgressBar";
import { AuthProvider } from "@/context/AuthContext";
import { ClinicMockProvider } from "@/features/mock-database/ClinicMockProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WU Clinic Booking - ระบบบริการสุขภาพและการแจ้งเตือนยา มหาวิทยาลัยวลัยลักษณ์",
  description: "ระบบจองคิวตรวจรักษา บันทึกประวัติการรักษา แจ้งเตือนการทานยา และระบบคลังยาสำหรับคลินิกมหาวิทยาลัยวลัยลักษณ์ (COE67-331)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${inter.variable} h-full scroll-smooth`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-brand-surface text-brand-ink antialiased">
        <AuthProvider>
          <ClinicMockProvider>
            <TopProgressBar />
            <Header />
            {/* Main Content Area */}
            <main className="flex-1 bg-brand-surface pt-16">
              {children}
            </main>
            <Footer />
          </ClinicMockProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
