export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: "720px",
          width: "100%",
          textAlign: "center",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "48px 24px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "#475569",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          GetMailDone
        </p>

        <h1
          style={{
            marginTop: "16px",
            marginBottom: "16px",
            fontSize: "42px",
            lineHeight: 1.1,
            fontWeight: 800,
          }}
        >
          Stop writing emails.
          <br />
          Just get them done.
        </h1>

        <p
          style={{
            margin: "0 auto 32px",
            maxWidth: "560px",
            fontSize: "18px",
            lineHeight: 1.6,
            color: "#334155",
          }}
        >
          We prepare replies for you in your style. You review, click send, and
          move on.
        </p>

        <a
          href="/api/auth/google"
          style={{
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              display: "inline-block",
              border: "none",
              borderRadius: "999px",
              padding: "14px 22px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              background: "#0f172a",
              color: "#ffffff",
            }}
          >
            Connect Gmail
          </span>
        </a>
      </section>
    </main>
  );
}
