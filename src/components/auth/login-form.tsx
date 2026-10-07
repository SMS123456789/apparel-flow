"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  demoPersonas,
  type AuthenticatedUser,
  type DemoPersona,
} from "@/modules/identity/types";
import { api, ApiClientError } from "@/lib/http/client";
import { PendingLabel, LoadingStatus } from "@/components/shared/loading";
import { RoleIcon } from "@/components/shared/semantic-status";
interface LoginResult {
  user: AuthenticatedUser;
  redirectTo: string;
}
export function LoginForm({
  enabledPersonas,
}: {
  enabledPersonas: DemoPersona[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function signIn(url: string, body: unknown, label: string) {
    if (busy) return;
    setBusy(label);
    setError("");
    setFieldErrors({});
    try {
      const result = await api<LoginResult>(url, { method: "POST", body });
      window.location.assign(result.redirectTo);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign-in failed.");
      if (failure instanceof ApiClientError)
        setFieldErrors(failure.fieldErrors);
    } finally {
      const input = formRef.current?.elements.namedItem("password");
      if (input instanceof HTMLInputElement) input.value = "";
      setBusy(null);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void signIn(
      "/api/auth/login",
      { email: data.get("email"), password: data.get("password") },
      "Signing in…",
    );
  }
  return (
    <>
      {error && (
        <div className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      )}
      <form
        onSubmit={submit}
        ref={formRef}
        className="form-stack"
        aria-busy={Boolean(busy)}
        noValidate
      >
        <div className="field">
          <label htmlFor="email">
            Email <span>(required)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            disabled={Boolean(busy)}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="field-error">
              {fieldErrors.email.join(" ")}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">
            Password <span>(required)</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            disabled={Boolean(busy)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
          />
          {fieldErrors.password && (
            <p id="password-error" className="field-error">
              {fieldErrors.password.join(" ")}
            </p>
          )}
        </div>
        <button
          className="button primary"
          type="submit"
          disabled={Boolean(busy)}
          aria-busy={busy === "Signing in…"}
        >
          <PendingLabel
            pending={busy === "Signing in…"}
            label="Sign in"
            pendingLabel="Signing in…"
          />
        </button>
      </form>
      <LoadingStatus busy={Boolean(busy)} label={busy ?? ""} />
      <section className="demo-panel" aria-labelledby="demo-title">
        <h2 id="demo-title">Demo Accounts</h2>
        <p>Choose a factory account to sign in with a real session.</p>
        <div className="demo-options">
          {demoPersonas.map((persona) => (
            <button
              key={persona.id}
              type="button"
              className="button secondary"
              data-role={persona.role}
              aria-busy={busy === `Signing in as ${persona.label}…`}
              disabled={Boolean(busy) || !enabledPersonas.includes(persona.id)}
              onClick={() =>
                void signIn(
                  "/api/auth/demo",
                  { persona: persona.id },
                  `Signing in as ${persona.label}…`,
                )
              }
            >
              <RoleIcon role={persona.role} size={18} />
              <PendingLabel
                pending={busy === `Signing in as ${persona.label}…`}
                label={persona.label}
                pendingLabel="Signing in…"
              />
            </button>
          ))}
        </div>
        {enabledPersonas.length === 0 && (
          <p className="helper">
            Demo accounts are unavailable. Use your assigned credentials.
          </p>
        )}
      </section>
    </>
  );
}
