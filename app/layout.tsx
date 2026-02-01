export const metadata = { title: "Polymarket Arbitraj", description: "Kripto dashboard" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f0f12", color: "#e4e4e7" }}>
        <nav style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid #27272a", display: "flex", gap: "1rem" }}>
          <a href="/" style={{ color: "#a1a1aa" }}>Dashboard</a>
          <a href="/config" style={{ color: "#a1a1aa" }}>Config</a>
          <a href="/manual-queue" style={{ color: "#a1a1aa" }}>Manuel Kuyruk</a>
          <a href="/alerts" style={{ color: "#a1a1aa" }}>Uyarılar</a>
          <a href="/audit" style={{ color: "#a1a1aa" }}>Audit</a>
          <a href="/polymarket" style={{ color: "#a1a1aa" }}>Polymarket Kripto</a>
        </nav>
        <main style={{ padding: "1.5rem" }}>{children}</main>
      </body>
    </html>
  );
}
