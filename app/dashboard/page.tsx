"use client";

import { useState } from "react";

type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
};

export default function DashboardPage() {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const loadEmails = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/emails", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load emails");
      }

      setEmails(data?.messages || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load emails");
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

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
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "12px",
            fontSize: "48px",
            lineHeight: 1.1,
            fontWeight: 800,
          }}
        >
          Dashboard
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "18px",
            lineHeight: 1.6,
            color: "#334155",
          }}
        >
          Google OAuth is connected.
        </p>

        <p
          style={{
            marginTop: "10px",
            marginBottom: 0,
            fontSize: "18px",
            lineHeight: 1.6,
            color: "#334155",
          }}
        >
          Load your first Gmail messages below.
        </p>

        <button
          onClick={loadEmails}
          disabled={loading}
          style={{
            display: "inline-block",
            marginTop: "24px",
            padding: "14px 22px",
            borderRadius: "999px",
            background: "#0f172a",
            color: "#ffffff",
            border: "none",
            fontWeight: 700,
            fontSize: "16px",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Loading..." : "Load Emails"}
        </button>

        {error ? (
          <div
            style={{
              marginTop: "20px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            marginTop: "28px",
            display: "grid",
            gap: "14px",
          }}
        >
          {!loading && emails.length === 0 && !error ? (
            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#475569",
              }}
            >
              No emails loaded yet.
            </div>
          ) : null}

          {emails.map((email) => (
            <article
              key={email.id}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "18px",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  fontWeight: 700,
                }}
              >
                Message
              </p>

              <p
                style={{
                  marginTop: "12px",
                  marginBottom: "8px",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                <strong>From:</strong> {email.from || "Unknown sender"}
              </p>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: "8px",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                <strong>Subject:</strong> {email.subject || "(No subject)"}
              </p>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: "14px",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  color: "#475569",
                }}
              >
                {email.snippet || "No preview available."}
              </p>

              <p
                style={{
                  marginTop: 0,
                  marginBottom: "6px",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "#64748b",
                }}
              >
                <strong>ID:</strong> {email.id}
              </p>

              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "#64748b",
                }}
              >
                <strong>Thread ID:</strong> {email.threadId}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
