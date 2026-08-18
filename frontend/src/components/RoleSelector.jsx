import { useState } from "react";
import api from "../api/client.js";
import { useToast } from "./Toast.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function RoleSelector({ phone, currentRole, onRoleChange }) {
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { user: currentUser } = useAuth();

  // admins-tier: cannot touch admin or admins accounts, cannot assign admin/admins
  const isAdminsTier = currentUser?.role === "admins";
  const targetIsAdminLevel = role === "admin" || role === "admins";
  const locked = isAdminsTier && targetIsAdminLevel;

  const changeRole = async (newRole) => {
    if (newRole === role) return;
    const previousRole = role;
    setRole(newRole);
    setLoading(true);
    try {
      await api.patch(`/users/${phone}/role`, { role: newRole });
      toast(`Role changed to ${newRole}`);
      if (onRoleChange) onRoleChange(phone, newRole);
    } catch (err) {
      setRole(previousRole);
      toast(err.response?.data?.error || "Failed to change role", "error");
    } finally {
      setLoading(false);
    }
  };

  const getRoleStyle = (r) => {
    switch (r) {
      case "admin":
      case "admins":
        return { bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.35)", color: "#c4b5fd" };
      case "trainer":
        return { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.35)", color: "#fbbf24" };
      case "viewer":
        return { bg: "rgba(20, 184, 166, 0.15)", border: "rgba(20, 184, 166, 0.35)", color: "#5eead4" };
      default:
        return { bg: "rgba(255, 255, 255, 0.05)", border: "rgba(255, 255, 255, 0.12)", color: "#94a3b8" };
    }
  };

  const style = getRoleStyle(role);

  if (locked) {
    return (
      <span style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        borderRadius: 8,
        padding: "0.25rem 0.6rem",
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "capitalize",
        cursor: "not-allowed",
        userSelect: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
      }}>
        🔒 {role}
      </span>
    );
  }

  return (
    <select
      value={role}
      onChange={(e) => changeRole(e.target.value)}
      disabled={loading}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: loading ? "var(--muted)" : style.color,
        borderRadius: 8,
        padding: "0.25rem 0.55rem",
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "capitalize",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        outline: "none",
      }}
    >
      <option value="user" style={{ background: "#11121d", color: "#f8fafc" }}>User</option>
      <option value="trainer" style={{ background: "#11121d", color: "#fbbf24" }}>Trainer</option>
      <option value="viewer" style={{ background: "#11121d", color: "#5eead4" }}>Viewer</option>
      {!isAdminsTier && <option value="admins" style={{ background: "#11121d", color: "#c4b5fd" }}>Admins</option>}
      {!isAdminsTier && <option value="admin" style={{ background: "#11121d", color: "#c4b5fd" }}>Admin</option>}
    </select>
  );
}
