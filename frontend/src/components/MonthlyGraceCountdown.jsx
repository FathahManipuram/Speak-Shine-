/**
 * MonthlyGraceCountdown
 * 
 * Displayed in Video Analysis during the initial 2-day free upload window of each month.
 * Shows a live ticking countdown timer, free access indicator, and direct Razorpay payment action.
 */

import { useState, useEffect, lazy, Suspense } from "react";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getMonthlyGracePeriodStatus, formatRemainingTime } from "../utils/gracePeriodUtils.js";

const InvoiceModal = lazy(() => import("./InvoiceModal.jsx"));

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

const DEFAULT_PLAN_AMOUNT = 5;

export default function MonthlyGraceCountdown({ onPaymentSuccess }) {
  const { user, login } = useAuth();
  const [status, setStatus] = useState(() => getMonthlyGracePeriodStatus());
  const [planAmount, setPlanAmount] = useState(DEFAULT_PLAN_AMOUNT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [justPaid, setJustPaid] = useState(false);
  const [successTx, setSuccessTx] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Fetch configured payment amount
  useEffect(() => {
    api.get("/payments/config")
      .then(({ data }) => {
        const amount = Number(data?.amount);
        if (Number.isFinite(amount) && amount >= 1) setPlanAmount(amount);
      })
      .catch(() => {});
  }, []);

  // Update countdown every 1 second
  useEffect(() => {
    const updateCountdown = () => {
      const current = getMonthlyGracePeriodStatus();
      setStatus(current);
    };

    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const isBypassRole = ["admin", "admins", "trainer", "viewer"].includes(user?.role);
  const isPaid = Boolean(user?.paid) || justPaid;

  // If role is admin/trainer or grace period is over and user not paid, don't show the grace banner here (PaymentWall handles hard gates)
  if (isBypassRole) {
    return null;
  }

  // If already paid for this month, show sleek active membership badge
  if (isPaid) {
    return (
      <>
        {showInvoiceModal && successTx && (
          <Suspense fallback={null}>
            <InvoiceModal
              transaction={successTx}
              user={user}
              onClose={() => setShowInvoiceModal(false)}
            />
          </Suspense>
        )}
        <div style={{
          background: "linear-gradient(135deg, rgba(16, 40, 24, 0.85) 0%, rgba(10, 26, 16, 0.85) 100%)",
          border: "1px solid rgba(74, 222, 128, 0.35)",
          borderRadius: 16,
          padding: "0.9rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25), 0 0 15px rgba(74, 222, 128, 0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(74, 222, 128, 0.15)",
              border: "1px solid rgba(74, 222, 128, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
              color: "#4ade80",
            }}>
              ✓
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                  {status.monthName} Membership Active
                </span>
                <span style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  color: "#4ade80",
                  background: "rgba(74, 222, 128, 0.15)",
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: 10,
                  textTransform: "uppercase",
                }}>
                  Paid Member
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                Unlimited speaking submissions and AI evaluations active for all of {status.monthName} {status.year}.
              </div>
            </div>
          </div>

          {successTx && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              style={{
                background: "rgba(74, 222, 128, 0.12)",
                border: "1px solid rgba(74, 222, 128, 0.35)",
                color: "#86efac",
                borderRadius: 10,
                padding: "0.45rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>📄</span> Invoice
            </button>
          )}
        </div>
      </>
    );
  }

  // If outside initial 2 days and unpaid, the route or wall handles it
  if (!status.isGracePeriod) {
    return null;
  }

  const { days, hours, minutes, seconds } = status.countdown;

  const handlePay = async () => {
    setError(null);
    setLoading(true);

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Payment system failed to load. Please check your internet connection.");
      setLoading(false);
      return;
    }

    try {
      const { data: order } = await api.post("/payments/create-order");

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Speak & Shine",
        description: `${status.monthName} ${status.year} Membership`,
        image: "/icons/icon-192.png",
        order_id: order.order_id,
        config: {
          display: {
            blocks: {
              upiBlock: {
                name: "Pay via UPI / QR Code",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upiBlock"],
            preferences: { show_default_blocks: false },
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
          try {
            await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
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
            setJustPaid(true);

            if (user) {
              login({ ...user, paid: true });
            }
            if (onPaymentSuccess) {
              onPaymentSuccess();
            }
          } catch (verifyErr) {
            const errStatus = verifyErr?.response?.status;
            const errMsg = verifyErr?.response?.data?.error || "";
            if (errStatus === 409 || errMsg.includes("already been processed")) {
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
              setJustPaid(true);
              if (user) login({ ...user, paid: true });
              if (onPaymentSuccess) onPaymentSuccess();
            } else {
              setError(errMsg || "Payment verification failed. Please contact support.");
            }
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        prefill: {
          name: user?.name || "",
          contact: user?.phone || "",
        },
        theme: { color: "#7c6fff" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (res) => {
        setLoading(false);
        setError(res.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not initiate payment. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      {showInvoiceModal && successTx && (
        <Suspense fallback={null}>
          <InvoiceModal
            transaction={successTx}
            user={user}
            onClose={() => setShowInvoiceModal(false)}
          />
        </Suspense>
      )}

      <div style={{
        background: "linear-gradient(135deg, #1c1438 0%, #150f28 50%, #0d0a1c 100%)",
        border: "1.5px solid rgba(167, 139, 250, 0.4)",
        borderRadius: 20,
        padding: "1.25rem 1.5rem",
        marginBottom: "1.25rem",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), 0 0 25px rgba(124, 111, 255, 0.15)",
      }}>
        {/* Glow ambient background decoration */}
        <div style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124, 111, 255, 0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          {/* Left Column: Title and info */}
          <div style={{ flex: "1 1 320px", minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span style={{
                background: "rgba(251, 191, 36, 0.15)",
                border: "1px solid rgba(251, 191, 36, 0.4)",
                color: "#fbbf24",
                fontSize: "0.74rem",
                fontWeight: 800,
                padding: "0.2rem 0.6rem",
                borderRadius: 20,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                letterSpacing: "0.03em",
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#fbbf24",
                  display: "inline-block",
                  animation: "pulse 1.5s infinite",
                }} />
                FREE TRIAL: DAY {status.dayOfMonth} OF 2
              </span>

              <span style={{
                background: "rgba(124, 111, 255, 0.15)",
                color: "#c4b5fd",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: 20,
              }}>
                {status.monthName} {status.year}
              </span>
            </div>

            <h3 style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              color: "#ffffff",
              marginBottom: "0.35rem",
              lineHeight: 1.3,
            }}>
              Free Upload Window Active
            </h3>

            <p style={{
              color: "#cbd5e1",
              fontSize: "0.84rem",
              lineHeight: 1.5,
              margin: 0,
            }}>
              You can upload and practice speaking for free during the first 2 days of {status.monthName}.
              Pay ₹{planAmount} now to avoid upload lock starting Day 3 (midnight).
            </p>
          </div>

          {/* Right Column: Countdown blocks & Pay button */}
          <div style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.85rem",
            justifyContent: "flex-end",
          }}>
            {/* Live Countdown Display */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "0.45rem 0.65rem",
              borderRadius: 14,
            }}>
              {days > 0 && (
                <>
                  <div style={{ textAlign: "center", minWidth: 38 }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fbbf24", fontFamily: "monospace" }}>
                      {String(days).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      DAYS
                    </div>
                  </div>
                  <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: "0.9rem" }}>:</span>
                </>
              )}

              <div style={{ textAlign: "center", minWidth: 38 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fbbf24", fontFamily: "monospace" }}>
                  {String(hours).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  HOURS
                </div>
              </div>

              <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: "0.9rem" }}>:</span>

              <div style={{ textAlign: "center", minWidth: 38 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fbbf24", fontFamily: "monospace" }}>
                  {String(minutes).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  MINS
                </div>
              </div>

              <span style={{ color: "#fbbf24", fontWeight: 800, fontSize: "0.9rem" }}>:</span>

              <div style={{ textAlign: "center", minWidth: 38 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f87171", fontFamily: "monospace" }}>
                  {String(seconds).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "0.58rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  SECS
                </div>
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              onClick={handlePay}
              disabled={loading}
              style={{
                background: loading
                  ? "rgba(124, 111, 255, 0.4)"
                  : "linear-gradient(135deg, #7c6fff 0%, #6366f1 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                padding: "0.75rem 1.25rem",
                fontSize: "0.92rem",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                boxShadow: "0 6px 18px rgba(124, 111, 255, 0.4)",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? (
                <span>Processing…</span>
              ) : (
                <>
                  <span>💳</span>
                  <span>Pay ₹{planAmount} Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message if payment failed */}
        {error && (
          <div style={{
            marginTop: "0.75rem",
            background: "rgba(248, 113, 113, 0.12)",
            border: "1px solid rgba(248, 113, 113, 0.35)",
            borderRadius: 10,
            padding: "0.5rem 0.85rem",
            color: "#f87171",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
