import Link from "next/link";

export function HotelHeader({ admin = false }: { admin?: boolean }) {
  return (
    <header className="hotel-header">
      <Link className="hotel-brand" href="/" aria-label="Shapla Grand Hotel home">
        <span className="brand-mark"><i>SG</i></span>
        <span className="brand-copy">
          <strong>Shapla Grand</strong>
          <small>Dhaka · Bangladesh</small>
        </span>
      </Link>
      <div className="header-center" aria-hidden="true">
        <span />
        <i>AI Receptionist Demo</i>
        <span />
      </div>
      <Link className="admin-link" href={admin ? "/" : "/admin"}>
        {admin ? "Back to reception" : "Demo reservations"}
      </Link>
    </header>
  );
}
