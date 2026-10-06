"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/http/client";
import type { OrderDetail } from "@/modules/orders/types";
import { approvalViolations } from "@/modules/verification/rules";
import { rejectSchema } from "@/modules/verification/schemas";
import { ActionDialog } from "@/components/shared/action-dialog";
import { ComponentStatus } from "./component-status";
import { DecisionHistory } from "./decision-history";
import { statusLabel } from "./order-list";
function countValue(value: string): number | null {
  return value === ""
    ? null
    : /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
      ? Number(value)
      : NaN;
}
export function VerificationTerminal({
  orderId,
  actorId,
}: {
  orderId: string;
  actorId: string;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null),
    [counts, setCounts] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"approve" | "reject" | null>(null),
    [reason, setReason] = useState(""),
    [reasonError, setReasonError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [blockedComponents, setBlockedComponents] = useState<string[]>([]);
  function restore(data: OrderDetail) {
    setOrder(data);
    const attempt = data.attempts.find((a) => a.id === data.currentAttemptId);
    setCounts(
      Object.fromEntries(
        data.components.map((c) => [
          c.componentId,
          String(
            attempt?.items.find((i) => i.componentId === c.componentId)
              ?.actualQty ?? "",
          ),
        ]),
      ),
    );
    setStale(false);
    setReviewing(false);
    setBlockedComponents([]);
  }
  useEffect(() => {
    let cancelled = false;
    api<OrderDetail>(`/api/verification/${orderId}`)
      .then((data) => {
        if (!cancelled) restore(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : "Verification could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const attempt = order?.attempts.find((a) => a.id === order.currentAttemptId);
  const own = order?.createdBy === actorId;
  const pending =
    order?.status === "PENDING_VERIFICATION" && attempt?.status === "OPEN";
  const dirty = Boolean(
    order?.components.some(
      (c) =>
        countValue(counts[c.componentId] ?? "") !==
        (attempt?.items.find((i) => i.componentId === c.componentId)
          ?.actualQty ?? null),
    ),
  );
  const invalid = Boolean(
    order?.components.some((c) => {
      const value = countValue(counts[c.componentId] ?? "");
      const saved = attempt?.items.find(
        (i) => i.componentId === c.componentId,
      )?.actualQty;
      return Number.isNaN(value) || (value === null && saved != null);
    }),
  );
  const violations =
    order && attempt
      ? approvalViolations(order.components, attempt.items)
      : [{ reason: "MISSING_COMPONENT" }];
  const blocker = !pending
    ? "This attempt is finalized or outside pending verification."
    : own
      ? "An order creator cannot count or decide their own batch."
      : stale
        ? "The revision changed. Reload saved evidence and review your kept entries."
        : busy
          ? "A save or decision is in progress."
          : invalid
            ? "Enter valid whole counts; a saved count cannot be cleared."
            : dirty
              ? "Save your count changes before approving."
              : violations.length
                ? "Every required component must be counted without shortages."
                : "Saved counts are eligible for approval. Excess is permitted.";
  const canApprove =
    pending &&
    !own &&
    !busy &&
    !stale &&
    !invalid &&
    !dirty &&
    violations.length === 0;
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function failure(e: unknown) {
    setError(
      e instanceof Error ? e.message : "The operation failed. Try again.",
    );
    if (e instanceof ApiClientError) {
      if (e.status === 409) setStale(true);
      if (e.status === 422)
        setBlockedComponents(
          e.violations.flatMap((v) => (v.componentId ? [v.componentId] : [])),
        );
    }
  }
  async function reloadEvidence() {
    setBusy(true);
    setError("");
    try {
      const data = await api<OrderDetail>(`/api/verification/${orderId}`);
      setOrder(data);
      setStale(false);
      setReviewing(true);
      setNotice(
        "Saved evidence reloaded. Your entries are kept; compare them with saved values before saving again.",
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!order || !attempt || invalid || own || stale) return;
    setBusy(true);
    setError("");
    setNotice("");
    const items = order.components.flatMap((c) => {
      const actual = countValue(counts[c.componentId] ?? "");
      const saved =
        attempt.items.find((i) => i.componentId === c.componentId)?.actualQty ??
        null;
      return actual !== null && actual !== saved
        ? [{ componentId: c.componentId, actualQty: actual }]
        : [];
    });
    try {
      const data = await api<OrderDetail>(
        `/api/verification/${orderId}/counts`,
        {
          method: "PATCH",
          body: {
            attemptId: attempt.id,
            expectedRevision: order.revision,
            items,
          },
        },
      );
      restore(data);
      setNotice("Saved counts.");
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function decide() {
    if (!order || !attempt || !action) return;
    setReasonError("");
    let trimmed = "";
    if (action === "reject") {
      const check = rejectSchema.safeParse({
        attemptId: attempt.id,
        expectedRevision: order.revision,
        reason,
      });
      if (!check.success) {
        setReasonError(
          check.error.issues[0]?.message ??
            "Enter a meaningful rejection reason.",
        );
        reasonRef.current?.focus();
        return;
      }
      trimmed = check.data.reason;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<OrderDetail>(
        `/api/verification/${orderId}/${action}`,
        {
          method: "POST",
          body: {
            attemptId: attempt.id,
            expectedRevision: order.revision,
            ...(action === "reject" ? { reason: trimmed } : {}),
          },
        },
      );
      restore(data);
      setAction(null);
      setReason("");
      setNotice(
        action === "approve"
          ? "Batch verified. Immutable evidence is available below."
          : "Batch rejected for re-cut. Immutable evidence is available below.",
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (busy) return;
    if (
      action === "reject" &&
      reason &&
      !window.confirm("Discard the unsaved rejection reason?")
    )
      return;
    setAction(null);
    setError("");
  }
  if (loading) return <p role="status">Loading verification…</p>;
  if (!order)
    return (
      <p role="alert" className="alert error">
        {error || "Batch unavailable."}
      </p>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{order.orderNo}</h1>
          <p className="intro">
            {order.recipeCode} · {order.recipeName} · {order.targetQty} garments
            · {statusLabel(order.status)}
          </p>
          <p className="helper">
            Attempt {attempt?.attemptNo ?? "—"} · Roll {attempt?.fabricRollId} ·
            Expected fabric {attempt?.expectedFabricYards} yards · Actual{" "}
            {attempt?.actualFabricYards} yards
          </p>
        </div>
        <Link
          className="button"
          href="/verifier"
          onClick={(e) => {
            if (dirty && !window.confirm("Discard unsaved component counts?"))
              e.preventDefault();
          }}
        >
          Back to queue
        </Link>
      </div>
      {error && !action && (
        <p className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      {own && (
        <p className="alert">
          Read-only: the order creator cannot verify their own batch, including
          after role reassignment.
        </p>
      )}
      {pending && (
        <>
          <div
            className="table-region"
            role="region"
            aria-label="Component counts"
            tabIndex={0}
          >
            <table className="count-table">
              <caption>
                Frozen required components ·{" "}
                {dirty ? "Unsaved feedback" : "Saved counts"}
              </caption>
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="numeric">Expected</th>
                  <th>Actual pieces</th>
                  <th className="numeric">Variance</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {order.components.map((c) => {
                  const item = attempt?.items.find(
                    (i) => i.componentId === c.componentId,
                  );
                  const actual = countValue(counts[c.componentId] ?? "");
                  const invalidRow =
                    Number.isNaN(actual) ||
                    (actual === null && item?.actualQty != null);
                  const blocked = blockedComponents.includes(c.componentId);
                  return (
                    <tr key={c.componentId}>
                      <th scope="row">{c.name}</th>
                      <td className="numeric">{c.expectedQty}</td>
                      <td>
                        <label
                          className="sr-only"
                          htmlFor={`count-${c.componentId}`}
                        >
                          {c.name} actual pieces
                        </label>
                        <input
                          id={`count-${c.componentId}`}
                          className="count-input"
                          inputMode="numeric"
                          value={counts[c.componentId] ?? ""}
                          disabled={busy || own || stale || !item}
                          aria-invalid={invalidRow || blocked}
                          aria-describedby={`count-help-${c.componentId}`}
                          onChange={(e) => {
                            setCounts((current) => ({
                              ...current,
                              [c.componentId]: e.target.value,
                            }));
                            setNotice("");
                          }}
                        />
                        <p
                          id={`count-help-${c.componentId}`}
                          className={
                            invalidRow || blocked ? "field-error" : "helper"
                          }
                        >
                          {invalidRow
                            ? "Enter a nonnegative whole count. Saved counts cannot be cleared."
                            : blocked
                              ? "Approval blocked: review this required count and reload saved evidence."
                              : !item
                                ? "Incomplete data: required item is missing."
                                : reviewing
                                  ? `Saved: ${item.actualQty ?? "Not counted"}`
                                  : "Blank = not counted; zero is a count."}
                        </p>
                      </td>
                      <td className="numeric">
                        {actual === null || Number.isNaN(actual)
                          ? "—"
                          : `${actual - c.expectedQty >= 0 ? "+" : ""}${actual - c.expectedQty}`}
                      </td>
                      <td>
                        {!item ? (
                          "Incomplete data"
                        ) : invalidRow ? (
                          "Invalid count"
                        ) : (
                          <ComponentStatus
                            expected={c.expectedQty}
                            actual={actual}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="actions operational-section">
            <button
              type="button"
              className="button"
              disabled={busy || own || stale || invalid || !dirty}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save Counts"}
            </button>
            <span className="helper" role="status">
              {notice ||
                (busy ? "Saving…" : dirty ? "Unsaved counts" : "Saved counts")}
            </span>
            {(stale || error) && (
              <button
                className="button"
                disabled={busy}
                onClick={() => void reloadEvidence()}
              >
                Reload saved evidence
              </button>
            )}
          </div>
          <div className="decision-actions">
            <p id="approval-blocker">{blocker}</p>
            <div className="actions">
              <button
                type="button"
                className="button primary"
                disabled={!canApprove}
                aria-describedby="approval-blocker"
                onClick={() => setAction("approve")}
              >
                Approve
              </button>
              <button
                type="button"
                className="button reject-entry"
                disabled={busy || own || stale || dirty || invalid}
                onClick={() => setAction("reject")}
              >
                Reject
              </button>
            </div>
            <p className="helper">
              Save count changes before deciding. Physical defects may justify
              rejection even with matching counts. Fabric wastage caps do not
              block approval.
            </p>
          </div>
        </>
      )}
      {!pending && (
        <p role="status" className="intro">
          {notice || "Finalized counts and decision evidence are read-only."}
        </p>
      )}
      <DecisionHistory evidence={order.evidence} />
      <ActionDialog
        open={action !== null}
        title={action === "reject" ? "Reject batch" : "Approve batch"}
        description={
          action === "reject"
            ? `Reject ${order.orderNo} for re-cut. The reason and saved counts become immutable evidence.`
            : `Approve ${order.orderNo}. Saved counts and your sign-off become immutable and the batch becomes available to sewing.`
        }
        busy={busy}
        onCancel={cancel}
      >
        {error && (
          <p className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        {action === "reject" && (
          <div className="field">
            <label htmlFor="rejection-reason">
              Rejection reason (required, maximum 1000 characters)
            </label>
            <textarea
              id="rejection-reason"
              ref={reasonRef}
              rows={3}
              maxLength={1000}
              required
              disabled={busy}
              value={reason}
              aria-invalid={Boolean(reasonError)}
              aria-describedby="reason-error"
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
            />
            <p id="reason-error" className="field-error">
              {reasonError}
            </p>
          </div>
        )}
        <div className="actions">
          <button className="button" disabled={busy} onClick={cancel}>
            Cancel
          </button>
          <button
            className={`button ${action === "reject" ? "destructive" : "primary"}`}
            disabled={busy || (action === "approve" && !canApprove)}
            onClick={() => void decide()}
          >
            {busy
              ? "Recording decision…"
              : action === "reject"
                ? "Confirm rejection"
                : "Confirm approval"}
          </button>
        </div>
      </ActionDialog>
    </>
  );
}
