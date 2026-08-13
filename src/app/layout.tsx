import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shapla Grand · AI Receptionist Demo",
  description: "A realtime conversational AI hotel receptionist demonstration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
