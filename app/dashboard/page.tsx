"use client";

import { useState } from "react";

type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  body: string;
  category: "reply_needed" | "important_info" | "transactional" | "promotional" | "ignore";
  needsReply: boolean;
  priorityScore: number;
  confidence: number;
  reason: string;
  suggestedAction: "reply" | "read" | "archive" | "ignore";
};

type StyleProfile = {
  tone?: string;
  formality?: string;
  averageLength?: string;
  averageWords?: number;
  greetingStyle?: string;
  closingStyle?: string;
  commonPhrases?: string[];
  decisionNotes?: {
    conciseReplies?: boolean;
    oftenSuggestsNextStep?: boolean;
    consistentlyPolite?: boolean;
  };
  sampleCount?: number;
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

      const styleRes = await fetch("/api/style-profile", {
        method: "GET",
        cache: "no-store",
      });

      const styleData = await styleRes.json();

      if (!styleRes.ok) {
        throw new Error(styleData?.error || "Failed to load style profile");
      }

      const styleProfile: StyleProfile | undefined = styleData?.profile;

      const res = await fetch("/api/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: email.from,
          subject: email.subject,
          body: email.body || email.snippet,
          category: email.category,
          needsReply: email.needsReply,
          suggestedAction: email.suggestedAction,
          styleProfile,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate reply");
      }

      if (data?.skipped) {
        setReplies((prev) => ({
          ...prev,
          [email.id]: data?.reason || "No reply needed.",
        }));
        return;
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

  const getCategoryLabel = (category: GmailMessage["category"]) => {
    switch (category) {
      case "reply_needed":
        return "Reply needed";
      case "important_info":
        return "Important info";
      case "transactional":
        return "Transactional";
      case "promotional":
        return "Promotional";
      case "ignore":
        return "Ignore";
      default:
        return category;
    }
  };

  const getCategoryColors = (category: GmailMessage["category"]) => {
    switch (category) {
      case "reply_needed":
        return {
          bg: "#dcfce7",
          border: "#86efac",
          text: "#166534",
        };
      case "important_info":
        return {
          bg: "#dbeafe",
          border: "#93c5fd",
          text: "#1d4ed8",
        };
      case "transactional":
        return {
          bg: "#f3f4f6",
          border: "#d1d5db",
          text: "#374151",
        };
      case "promotional":
        return {
          bg: "#fef3c7",
          border: "#fcd34d",
          text: "#92400e",
        };
      case "ignore":
        return {
          bg: "#fee2e2",
          border: "#fca5a5",
          text: "#991b1b",
        };
      default:
        return {
          bg: "#f1f5f9",
          border: "#cbd5e1",
          text: "#334155",
        };
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
          Load your Gmail messages and identify what actually needs a reply.
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

          {emails.map((email) => {
            const categoryColors = getCategoryColors(email.category);

            return (
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
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "14px",
                  }}
                >
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: categoryColors.bg,
                      border: `1px solid ${categoryColors.border}`,
                      color: categoryColors.text,
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {getCategoryLabel(email.category)}
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: email.needsReply ? "#dcfce7" : "#f1f5f9",
                      border: `1px solid ${email.needsReply ? "#86efac" : "#cbd5e1"}`,
                      color: email.needsReply ? "#166534" : "#475569",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {email.needsReply ? "Needs reply" : "No reply needed"}
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Priority {email.priorityScore}
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Confidence {Math.round(email.confidence * 100)}%
                  </span>
                </div>

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
                    marginBottom: "10px",
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "#475569",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {email.snippet || "No preview available."}
                </p>

                <div
                  style={{
                    marginBottom: "14px",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      lineHeight: 1.6,
                      color: "#334155",
                    }}
                  >
                    <strong>Reason:</strong> {email.reason}
                  </p>
                  <p
                    style={{
                      marginTop: "6px",
                      marginBottom: 0,
                      fontSize: "13px",
                      lineHeight: 1.6,
                      color: "#334155",
                    }}
                  >
                    <strong>Suggested action:</strong> {email.suggestedAction}
                  </p>
                </div>

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

                {email.needsReply ? (
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
                ) : null}

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
            );
          })}
        </div>
      </div>
    </main>
  );
        }
