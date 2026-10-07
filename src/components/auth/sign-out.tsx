"use client";
import { useState } from "react";
import { PendingLabel } from "@/components/shared/loading";
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
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-out failed. Try again.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="sign-out">
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void logout()}
      >
        <PendingLabel
          pending={busy}
          label="Sign out"
          pendingLabel="Signing out…"
        />
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
