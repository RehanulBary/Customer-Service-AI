import { AdminDashboard } from "@/components/AdminDashboard";
import { HotelHeader } from "@/components/HotelHeader";

export default function AdminPage() {
  return (
    <main className="site-shell admin-shell">
      <div className="ambient ambient-one" />
      <HotelHeader admin />
      <AdminDashboard />
      <footer className="site-footer">
        <span>Local demo controls · No authentication</span>
        <span>Shapla Grand Hotel is fictional</span>
      </footer>
    </main>
  );
}
