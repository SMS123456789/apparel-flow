"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/http/client";
import type { SewingDetail as Batch } from "@/modules/sewing/types";
import { PendingLabel, BatchLoading } from "@/components/shared/loading";
import { ActionDialog } from "@/components/shared/action-dialog";
import { StatusBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  PercentageDisplay,
  displayTimezone,
  formatCount,
} from "@/components/shared/data-display";
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
  if (loading) return <BatchLoading kind="sewing" />;
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
            <strong>{batch.recipeName}</strong> · {formatCount(batch.targetQty)}{" "}
            garments
          </p>
          <div className="batch-context">
            <StatusBadge status="VERIFIED" />
            <span className="helper">{batch.recipeCode}</span>
          </div>
          <p className="helper intro">
            Roll {batch.fabricRollId} · Verified by {batch.verifierName} ·{" "}
            <HumanDateTime value={batch.verifiedAt} /> · {displayTimezone}
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
          <div className="assembly-state started">
            <div>
              <p role="status">
                <StatusBadge status="STARTED" />
              </p>
              <p className="intro">
                <HumanDateTime value={batch.sewingStartedAt} /> ·{" "}
                {displayTimezone}
              </p>
              <details className="technical-details">
                <summary>Assembly audit details</summary>
                <dl>
                  <div>
                    <dt>Started by (actor ID)</dt>
                    <dd>{batch.startedBy}</dd>
                  </div>
                  <div>
                    <dt>Exact start time</dt>
                    <dd>{batch.sewingStartedAt} (UTC)</dd>
                  </div>
                </dl>
              </details>
            </div>
          </div>
        ) : (
          <div className="assembly-state">
            <div>
              <StatusBadge status="READY" />
              <p className="intro">
                Approved pieces are ready for sewing assembly.
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy || stale}
              onClick={() => setConfirm(true)}
            >
              Start Sewing Assembly
            </button>
          </div>
        )}
        {(stale || error) && (
          <button
            className="button"
            disabled={busy}
            aria-busy={busy && !confirm}
            onClick={() => void reload()}
          >
            <PendingLabel
              pending={busy && !confirm}
              label="Reload batch"
              pendingLabel="Reloading…"
            />
          </button>
        )}
      </section>
      <p className="helper">
        Fabric cap <PercentageDisplay value={batch.wastageCapPct} /> is
        informational. Signed fabric variance is retained in the approved
        evidence.
      </p>
      <DecisionHistory evidence={[batch.evidence]} />
      <ActionDialog
        open={confirm}
        title="Start Sewing Assembly"
        description={`Record assembly start for ${batch.orderNo}. Approved evidence remains immutable and the batch remains Verified.`}
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
            aria-busy={busy}
            onClick={() => void start()}
          >
            <PendingLabel
              pending={busy}
              label="Confirm assembly start"
              pendingLabel="Starting…"
            />
          </button>
        </div>
      </ActionDialog>
    </>
  );
}
