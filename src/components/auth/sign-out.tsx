"use client";
import { useState } from "react";
import { api } from "@/lib/http/client";
export function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.replace(new URL("/login", window.location.origin).href);
    } catch {
      setError("Sign-out failed. Try again.");
      setBusy(false);
    }
  }
  return (
    <div className="sign-out">
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => void logout()}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
