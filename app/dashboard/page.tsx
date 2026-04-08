"use client";

import { useState } from "react";

type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  body: string;
};

export default function DashboardPage() {
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyLoadingId, setReplyLoadingId] = useState<string | null>(null);

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

  const generateReply = async (email: GmailMessage) => {
    try {
      setReplyLoadingId(email.id);
      setError("");

      const res = await fetch("/api/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: email.from,
          subject: email.subject,
          body: email.body || email.snippet,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate reply");
      }

      setReplies((prev) => ({
        ...prev,
        [email.id]: data?.reply || "",
      }));
    } catch (err: any) {
      setError(err?.message || "Failed to generate reply");
    } finally {
      setReplyLoadingId(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "20px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, Helvetica, sans-serif",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "12px",
            fontSize: "clamp(32px, 6vw, 48px)",
            lineHeight: 1.1,
            fontWeight: 800,
            wordBreak: "break-word",
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
          Load your Gmail messages and generate replies below.
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
            width: "100%",
            maxWidth: "220px",
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
              wordBreak: "break-word",
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
                width: "100%",
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
                width: "100%",
                wordBreak: "break-word",
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
                  wordBreak: "break-word",
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
                  wordBreak: "break-word",
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
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {email.snippet || "No preview available."}
              </p>

              {email.body ? (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    width: "100%",
                  }}
                >
                  <p
                    style={{
                      marginTop: 0,
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontWeight: 700,
                    }}
                  >
                    Body
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.7,
                      color: "#334155",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {email.body}
                  </p>
                </div>
              ) : null}

              <button
                onClick={() => generateReply(email)}
                disabled={replyLoadingId === email.id}
                style={{
                  display: "inline-block",
                  marginBottom: "16px",
                  padding: "12px 18px",
                  borderRadius: "999px",
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: replyLoadingId === email.id ? "default" : "pointer",
                  opacity: replyLoadingId === email.id ? 0.7 : 1,
                  width: "100%",
                  maxWidth: "220px",
                }}
              >
                {replyLoadingId === email.id ? "Generating..." : "Generate reply"}
              </button>

              {replies[email.id] ? (
                <div
                  style={{
                    marginBottom: "16px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "#eef6ff",
                    border: "1px solid #bfdbfe",
                    width: "100%",
                  }}
                >
                  <p
                    style={{
                      marginTop: 0,
                      marginBottom: "8px",
                      fontSize: "13px",
                      color: "#1d4ed8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontWeight: 700,
                    }}
                  >
                    AI Reply
                  </p>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      lineHeight: 1.7,
                      color: "#0f172a",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {replies[email.id]}
                  </p>
                </div>
              ) : null}

              <p
                style={{
                  marginTop: 0,
                  marginBottom: "6px",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  color: "#64748b",
                  wordBreak: "break-word",
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
                  wordBreak: "break-word",
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
