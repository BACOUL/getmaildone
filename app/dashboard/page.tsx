export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <h1 style={{ marginTop: 0, fontSize: "32px" }}>Dashboard</h1>
      <p>Google OAuth is connected.</p>
      <p>Next step: fetch Gmail messages and display them here.</p>

      <a
        href="/api/emails"
        style={{
          display: "inline-block",
          marginTop: "24px",
          padding: "12px 18px",
          borderRadius: "999px",
          background: "#0f172a",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 700,
        }}
      >
        Test Gmail API
      </a>
    </main>
  );
}
