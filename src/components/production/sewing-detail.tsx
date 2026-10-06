"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/http/client";
import type { SewingDetail as Batch } from "@/modules/sewing/types";
import { ActionDialog } from "@/components/shared/action-dialog";
import { DecisionHistory } from "./decision-history";
export function SewingDetail({ orderId }: { orderId: string }) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [confirm, setConfirm] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let cancelled = false;
    api<Batch>(`/api/sewing/${orderId}`)
      .then((data) => {
        if (!cancelled) setBatch(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Batch could not be loaded.",
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
  async function reload() {
    setBusy(true);
    setError("");
    try {
      setBatch(await api<Batch>(`/api/sewing/${orderId}`));
      setStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch could not be loaded.");
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (!batch) return;
    setBusy(true);
    setError("");
    try {
      setBatch(
        await api<Batch>(`/api/sewing/${orderId}/start`, {
          method: "POST",
          body: { expectedRevision: batch.revision },
        }),
      );
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start could not be recorded.");
      if (e instanceof ApiClientError && e.status === 409) setStale(true);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading verified batch…</p>;
  if (!batch)
    return (
      <p className="alert error" role="alert">
        {error || "Verified batch unavailable."}
      </p>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{batch.orderNo}</h1>
          <p className="intro">
            {batch.recipeCode} · {batch.recipeName} · {batch.targetQty} garments
            · Verified
          </p>
          <p className="helper">
            Roll {batch.fabricRollId} · Verified by {batch.verifierName} ·{" "}
            {batch.verifiedAt} (UTC)
          </p>
        </div>
        <Link className="button" href="/sewing">
          Back to sewing queue
        </Link>
      </div>
      {error && !confirm && (
        <p className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      <section className="operational-section">
        <h2>Assembly start</h2>
        {batch.sewingStartedAt ? (
          <>
            <p role="status" className="intro">
              Sewing assembly started.
            </p>
            <p className="helper">
              Started by {batch.startedBy} · {batch.sewingStartedAt} (UTC).
              Batch remains VERIFIED.
            </p>
          </>
        ) : (
          <>
            <p className="intro">
              Approved pieces are ready for sewing assembly.
            </p>
            <button
              className="button primary"
              disabled={busy || stale}
              onClick={() => setConfirm(true)}
            >
              Start Sewing Assembly
            </button>
          </>
        )}
        {(stale || error) && (
          <button
            className="button"
            disabled={busy}
            onClick={() => void reload()}
          >
            Reload batch
          </button>
        )}
      </section>
      <p className="helper">
        Fabric cap {batch.wastageCapPct}% is informational. Signed fabric
        variance is retained in the approved evidence.
      </p>
      <DecisionHistory evidence={[batch.evidence]} />
      <ActionDialog
        open={confirm}
        title="Start Sewing Assembly"
        description={`Record assembly start for ${batch.orderNo}. Approved evidence remains immutable and the batch remains VERIFIED.`}
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(false);
        }}
      >
        {error && (
          <p className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        <div className="actions">
          <button
            className="button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy || stale}
            onClick={() => void start()}
          >
            {busy ? "Recording start…" : "Confirm assembly start"}
          </button>
        </div>
      </ActionDialog>
    </>
  );
}
