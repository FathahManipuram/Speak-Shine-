/**
 * PaymentWall
 * Shown to unpaid users when they try to access a gated feature.
 * Handles Razorpay Standard Checkout flow end-to-end.
 * Features instant verification, success confirmation, and 1-click invoice download.
 */

import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";
import Layout from "../components/Layout.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const InvoiceModal = lazy(() => import("../components/InvoiceModal.jsx"));

// ── Load Razorpay checkout.js script once ────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const DEFAULT_PLAN_AMOUNT = 5; // INR

export default function PaymentWall({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paid, setPaid] = useState(false);
  const [successTx, setSuccessTx] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [failed, setFailed] = useState(false);
  const [planAmount, setPlanAmount] = useState(DEFAULT_PLAN_AMOUNT);
  const navigate = useNavigate();
  const { login, user } = useAuth();

  useEffect(() => {
    api.get("/payments/config")
      .then(({ data }) => {
        const amount = Number(data?.amount);
        if (Number.isFinite(amount) && amount >= 1) setPlanAmount(amount);
      })
      .catch(() => {});
  }, []);

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    // 1. Load Razorpay checkout SDK
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Payment system failed to load. Please check your internet connection and try again.");
      setLoading(false);
      return;
    }

    try {
      // 2. Create order on backend
      const { data: order } = await api.post("/payments/create-order");

      // 3. Open Razorpay modal (Restricted strictly to UPI & QR Code only)
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Speak & Shine",
        description: "Premium Membership",
        image: "/icons/icon-192.png",
        order_id: order.order_id,
        // ── Restrict payment methods strictly to UPI (Google Pay, PhonePe, Paytm, QR Code) ──
        // ── Completely removes Cards, Netbanking, Wallets, EMI, PayLater ────────────────────
        config: {
          display: {
            blocks: {
              upiBlock: {
                name: "Pay via UPI / QR Code",
                instruments: [
                  {
                    method: "upi",
                  },
                ],
              },
            },
            sequence: ["block.upiBlock"],
            preferences: {
              show_default_blocks: false,
            },
          },
        },
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
          emi: false,
          paylater: false,
        },
        handler: async (response) => {
          // 4. Verify payment on backend
          try {
            await api.post("/payments/verify", {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });

            const txObj = {
              name: user?.name || user?.registeredName || "Student Member",
              phone: user?.phone,
              amount: planAmount,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              status: "success",
              source: "razorpay",
              createdAt: new Date().toISOString(),
            };

            setSuccessTx(txObj);
            setPaid(true);

            // Update user in memory so PaidRoute unblocks immediately
            if (user) {
              login({ ...user, paid: true });
            }
          } catch (verifyErr) {
            const errStatus = verifyErr?.response?.status;
            const errMsg = verifyErr?.response?.data?.error || "";
            if (errStatus === 409 || errMsg.includes("already been processed")) {
              // Webhook or concurrent request already verified this order
              const txObj = {
                name: user?.name || user?.registeredName || "Student Member",
                phone: user?.phone,
                amount: planAmount,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                status: "success",
                source: "razorpay",
                createdAt: new Date().toISOString(),
              };
              setSuccessTx(txObj);
              setPaid(true);
              if (user) login({ ...user, paid: true });
            } else {
              setError(
                errMsg ||
                "Payment verification failed. Please contact support."
              );
            }
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError("Payment cancelled. You can try again anytime.");
          },
        },
        prefill: {
          name: user?.name || "",
          contact: user?.phone || "",
        },
        theme: { color: "#7c6fff" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        setLoading(false);
        setFailed(true);
        setError(
          response.error?.description ||
          "Payment failed. Please try a different payment method."
        );
      });
      rzp.open();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        "Could not initiate payment. Please try again."
      );
      setLoading(false);
    }
  };

  const handleContinueToDashboard = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.href = "/video-analysis";
    }
  };

  if (failed) {
    return (
      <Layout title="Payment Failed">
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", textAlign: "center",
          padding: "2rem",
        }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
          <h2 style={{ color: "#f87171", fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Payment Failed
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem", maxWidth: 340, lineHeight: 1.6 }}>
            {error || "Something went wrong with your payment."}
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "2rem" }}>
            No money was deducted. You can try again safely.
          </p>
          <button
            onClick={() => { setFailed(false); setError(null); }}
            style={{
              background: "linear-gradient(135deg, #7c6fff 0%, #6d5ce7 100%)",
              color: "#fff", border: "none", borderRadius: 12,
              padding: "0.9rem 2rem", fontSize: "1rem", fontWeight: 700,
              cursor: "pointer", boxShadow: "0 6px 24px rgba(124,111,255,0.35)",
              marginBottom: "1rem",
            }}
          >
            🔄 Try Again
          </button>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Contact your trainer if the problem persists.
          </p>
        </div>
      </Layout>
    );
  }

  if (paid) {
    return (
      <Layout title="Payment Successful">
        {/* Printable Official Invoice Modal */}
        {showInvoiceModal && (
          <Suspense fallback={null}>
            <InvoiceModal
              transaction={successTx}
              user={user}
              onClose={() => setShowInvoiceModal(false)}
            />
          </Suspense>
        )}

        <div style={{ maxWidth: 560, margin: "2rem auto", padding: "0 1rem" }}>
          {/* Main Celebration Card */}
          <div style={{
            background: "linear-gradient(135deg, #0d1e16 0%, #0a1711 100%)",
            border: "1px solid rgba(74, 222, 128, 0.35)",
            borderRadius: 24,
            padding: "2.25rem 1.75rem",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(74, 222, 128, 0.12)",
            position: "relative",
            overflow: "hidden",
            marginBottom: "1.25rem",
          }}>
            <div style={{ fontSize: "3.75rem", marginBottom: "0.85rem" }}>🎉</div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(74, 222, 128, 0.15)",
              border: "1px solid rgba(74, 222, 128, 0.35)",
              color: "#4ade80",
              padding: "0.3rem 0.85rem",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              marginBottom: "0.75rem",
            }}>
              <span>✓</span> PAYMENT VERIFIED &amp; UNLOCKED
            </div>

            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ffffff", marginBottom: "0.5rem" }}>
              Welcome to Speak &amp; Shine!
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: 440, margin: "0 auto 1.5rem" }}>
              Your payment has been verified. Daily speaking challenges, AI speech analysis, and full mentorship are now active on your account!
            </p>

            {/* Quick Receipt Summary Box */}
            <div style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 16,
              padding: "1.1rem 1.25rem",
              textAlign: "left",
              marginBottom: "1.75rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "0.6rem", marginBottom: "0.6rem" }}>
                <span style={{ fontSize: "0.76rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>AMOUNT PAID:</span>
                <span style={{ fontSize: "1.2rem", fontWeight: 900, color: "#4ade80" }}>₹{planAmount}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--muted)" }}>Plan:</span>
                <span style={{ fontWeight: 600 }}>Speak &amp; Shine Full Membership</span>
              </div>
              {successTx?.razorpayPaymentId && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem", color: "#cbd5e1", marginBottom: "0.4rem" }}>
                  <span style={{ color: "var(--muted)" }}>Payment ID:</span>
                  <span style={{ fontFamily: "monospace", color: "#a5b4fc" }}>{successTx.razorpayPaymentId}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem", color: "#cbd5e1" }}>
                <span style={{ color: "var(--muted)" }}>Date &amp; Time:</span>
                <span>{new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleContinueToDashboard}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #7c6fff 0%, #4f46e5 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 14,
                  padding: "0.95rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 6px 20px rgba(124, 111, 255, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>🚀</span> Start Speaking Challenges Now
              </button>

              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                style={{
                  width: "100%",
                  background: "rgba(124, 111, 255, 0.12)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(124, 111, 255, 0.35)",
                  borderRadius: 14,
                  padding: "0.85rem 1.5rem",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "all 0.15s ease",
                }}
              >
                <span>📄</span> View &amp; Download Official Invoice (PDF)
              </button>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--muted)" }}>
            A receipt has been saved to your account. You can view all past invoices anytime in <a href="/payment-history" style={{ color: "#a5b4fc", textDecoration: "underline" }}>Payment History</a>.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Unlock Full Access">
      <div style={{
        maxWidth: 480, margin: "2rem auto", padding: "0 1rem",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f23 100%)",
          border: "1px solid rgba(124,111,255,0.3)",
          borderRadius: 20,
          padding: "2rem 1.5rem",
          textAlign: "center",
          marginBottom: "1.5rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -50, right: -50,
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,111,255,0.2) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", marginBottom: "0.5rem" }}>
            Payment Required
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Your account is on a payment hold. Complete the payment below to unlock
            video submission, analysis, and all premium features.
          </p>
        </div>

        {/* Plan card */}
        <div style={{
          background: "rgba(124,111,255,0.06)",
          border: "2px solid rgba(124,111,255,0.3)",
          borderRadius: 16,
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "1rem",
          }}>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#a78bfa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
                Premium Membership
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                Speak &amp; Shine Full Access
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#7c6fff" }}>
                ₹{planAmount}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>one-time</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              "📹 Daily video submission & AI analysis",
              "📊 Fluency, grammar & confidence scores",
              "🔥 Streak tracking & leaderboard",
              "💬 Community feed & live sessions",
              "🎓 Vocabulary challenges & feedback",
            ].map((item) => (
              <div key={item} style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                fontSize: "0.85rem", color: "var(--text)",
              }}>
                <span style={{ color: "#4ade80", flexShrink: 0 }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 10,
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
            color: "#f87171",
            fontSize: "0.85rem",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={loading}
          style={{
            width: "100%",
            background: loading
              ? "rgba(124,111,255,0.4)"
              : "linear-gradient(135deg, #7c6fff 0%, #6d5ce7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            padding: "1rem 1.5rem",
            fontSize: "1.05rem",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.03em",
            boxShadow: loading ? "none" : "0 6px 24px rgba(124,111,255,0.35)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(124,111,255,0.45)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,111,255,0.35)";
          }}
        >
          {loading ? "Processing…" : `💳 Pay ₹${planAmount} & Unlock Access`}
        </button>

        <p style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--muted)",
          marginTop: "1rem",
          lineHeight: 1.6,
        }}>
          Secured by Razorpay · Instant UPI &amp; QR Code payment accepted<br />
          Contact your trainer if you believe this is a mistake.
        </p>
      </div>
    </Layout>
  );
}
