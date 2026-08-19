import React from "react";
import ReactDOM from "react-dom";

export default function InvoiceModal({ transaction, user, onClose }) {
  if (!transaction) return null;

  const tx = transaction;
  const studentName = tx.name || user?.name || user?.registeredName || "Student Member";
  const studentPhone = tx.phone || user?.phone || "—";
  
  const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
  const dateFormatted = txDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const invoiceNo = `INV-${txDate.getFullYear()}${(txDate.getMonth() + 1).toString().padStart(2, "0")}-${(tx.razorpayPaymentId || tx._id || "REC").slice(-6).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <>
      {/* Precision 1-Page A4 Print Stylesheet */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Completely hide entire root React app to prevent multi-page overflow */
          #root, .app, nav, header, aside, .admin-dashboard-container {
            display: none !important;
          }

          .invoice-modal-overlay {
            position: static !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }

          #printable-invoice {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 12px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
          }

          .invoice-no-print {
            display: none !important;
          }

          .invoice-header-box {
            background: #f8fafc !important;
            border-bottom: 1.5px solid #cbd5e1 !important;
          }

          .invoice-header-title {
            color: #0f172a !important;
          }

          .invoice-header-sub {
            color: #475569 !important;
          }

          .invoice-status-badge {
            background: #dcfce7 !important;
            border: 1.5px solid #86efac !important;
            color: #15803d !important;
          }

          .invoice-print-card {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }

          .invoice-print-text-dark {
            color: #0f172a !important;
          }

          .invoice-print-text-muted {
            color: #64748b !important;
          }

          .invoice-total-box {
            background: #f1f5f9 !important;
            border-top: 1.5px solid #cbd5e1 !important;
          }

          .invoice-total-amount {
            color: #15803d !important;
          }
        }
      `}</style>

      <div
        className="invoice-modal-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.78)",
          backdropFilter: "blur(6px)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          overflowY: "auto",
        }}
      >
        <div
          id="printable-invoice"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#0e101d",
            border: "1px solid rgba(124, 111, 255, 0.3)",
            borderRadius: 20,
            width: "100%",
            maxWidth: 620,
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(124, 111, 255, 0.15)",
            color: "#f8fafc",
            overflow: "hidden",
            position: "relative",
            animation: "fadeInUp 0.22s ease-out",
          }}
        >
          {/* Header Banner */}
          <div
            className="invoice-header-box"
            style={{
              background: "linear-gradient(135deg, rgba(124, 111, 255, 0.18), rgba(99, 102, 241, 0.08))",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "1.35rem 1.6rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.6rem" }}>🗣️</span>
                <div>
                  <div className="invoice-header-title" style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                    Speak &amp; Shine
                  </div>
                  <div className="invoice-header-sub" style={{ fontSize: "0.74rem", color: "#a5b4fc", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    English Communication &amp; AI Fluency Academy
                  </div>
                </div>
              </div>
              <div className="invoice-print-text-muted" style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.35rem" }}>
                🌐 speak-shine.sidhartht.online · 📞 +91 88480 96746
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                className="invoice-status-badge"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.35)",
                  color: "#4ade80",
                  padding: "0.28rem 0.7rem",
                  borderRadius: 10,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  marginBottom: "0.3rem",
                }}
              >
                <span>✓</span> PAID &amp; VERIFIED
              </div>
              <div className="invoice-print-text-muted" style={{ fontSize: "0.74rem", color: "var(--muted)", fontFamily: "monospace" }}>
                {invoiceNo}
              </div>
            </div>
          </div>

          {/* Invoice Body */}
          <div style={{ padding: "1.35rem 1.6rem" }}>
            {/* 2-Column Info Grid */}
            <div
              className="invoice-print-card"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1.1rem",
                marginBottom: "1.25rem",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: 12,
                padding: "1rem",
              }}
            >
              <div>
                <div className="invoice-print-text-muted" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  Billed To (Student)
                </div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f8fafc" }} className="invoice-print-text-dark">
                  {studentName}
                </div>
                <div className="invoice-print-text-muted" style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                  📱 {studentPhone}
                </div>
                <div style={{ fontSize: "0.74rem", color: "#16a34a", fontWeight: 600, marginTop: "0.2rem" }}>
                  Active Enrolled Student
                </div>
              </div>

              <div>
                <div className="invoice-print-text-muted" style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
                  Payment Details
                </div>
                <div style={{ fontSize: "0.82rem", color: "#f8fafc", fontWeight: 600 }} className="invoice-print-text-dark">
                  📅 {dateFormatted}
                </div>
                <div className="invoice-print-text-muted" style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                  💳 {tx.source === "admin" ? "Admin Tier Override" : "Razorpay Online / UPI"}
                </div>
                {tx.razorpayPaymentId && (
                  <div className="invoice-print-text-muted" style={{ fontSize: "0.72rem", color: "var(--muted)", fontFamily: "monospace", marginTop: "0.15rem" }}>
                    ID: {tx.razorpayPaymentId}
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Table */}
            <div
              className="invoice-print-card"
              style={{
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: "1.25rem",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "rgba(255, 255, 255, 0.04)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <th style={{ textAlign: "left", padding: "0.65rem 0.9rem", color: "#cbd5e1", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase" }} className="invoice-print-text-dark">
                      Description &amp; Access Plan
                    </th>
                    <th style={{ textAlign: "center", padding: "0.65rem 0.5rem", color: "#cbd5e1", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", width: 50 }} className="invoice-print-text-dark">
                      Qty
                    </th>
                    <th style={{ textAlign: "right", padding: "0.65rem 0.9rem", color: "#cbd5e1", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", width: 90 }} className="invoice-print-text-dark">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "0.75rem 0.9rem", borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                      <div style={{ fontWeight: 800, color: "#fff", marginBottom: "0.15rem" }} className="invoice-print-text-dark">
                        Daily Speaking Challenge &amp; AI Voice Analysis
                      </div>
                      <div className="invoice-print-text-muted" style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.35 }}>
                        • Full access to daily speaking topics &amp; AI video/audio evaluation<br/>
                        • Personalized trainer feedback, streak freezers &amp; leaderboards
                      </div>
                    </td>
                    <td style={{ textAlign: "center", padding: "0.75rem 0.5rem", color: "var(--muted)", fontWeight: 600 }} className="invoice-print-text-muted">
                      1
                    </td>
                    <td style={{ textAlign: "right", padding: "0.75rem 0.9rem", fontWeight: 800, color: "#f8fafc", fontSize: "0.92rem" }} className="invoice-print-text-dark">
                      ₹{tx.amount > 0 ? tx.amount.toLocaleString("en-IN") : "0"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Calculation Row */}
              <div
                className="invoice-total-box"
                style={{
                  background: "rgba(124, 111, 255, 0.06)",
                  padding: "0.75rem 0.9rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid rgba(124, 111, 255, 0.15)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#a5b4fc", fontWeight: 700 }} className="invoice-print-text-dark">
                    Total Amount Paid (Inclusive of Taxes)
                  </div>
                  <div className="invoice-print-text-muted" style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                    Zero Balance Due · Instant Digital Receipt
                  </div>
                </div>
                <div className="invoice-total-amount" style={{ fontSize: "1.2rem", fontWeight: 900, color: "#4ade80" }}>
                  ₹{tx.amount > 0 ? tx.amount.toLocaleString("en-IN") : "0"}
                </div>
              </div>
            </div>

            {/* Note & Seal */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.6rem",
                padding: "0.6rem 0",
                fontSize: "0.72rem",
                color: "var(--muted)",
                borderTop: "1px dashed rgba(255, 255, 255, 0.1)",
              }}
            >
              <div className="invoice-print-text-muted">
                🔒 This is a verified electronic receipt generated by Speak &amp; Shine.<br/>
                Billing inquiries: <span style={{ color: "#a5b4fc" }}>support@speakandshine.app</span>
              </div>
              <div className="invoice-print-text-muted" style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.68rem", color: "rgba(255, 255, 255, 0.4)" }}>
                REF: {tx.razorpayOrderId || tx._id || "VERIFIED"}
              </div>
            </div>
          </div>

          {/* Action Footer (Hidden during print) */}
          <div
            className="invoice-no-print"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "0.85rem 1.6rem",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#e2e8f0",
                borderRadius: 10,
                padding: "0.5rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: "linear-gradient(135deg, #7c6fff 0%, #4f46e5 100%)",
                border: "none",
                color: "#ffffff",
                borderRadius: 10,
                padding: "0.5rem 1.2rem",
                fontSize: "0.82rem",
                fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow: "0 4px 15px rgba(124, 111, 255, 0.4)",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / Save PDF (1 Page)
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
