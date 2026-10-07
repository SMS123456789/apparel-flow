"use client";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/http/client";
import type {
  ProductionAuditEvent,
  ProductionAuditPage,
} from "@/modules/admin/production-audit";
import { StatusBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  displayTimezone,
  formatCount,
} from "@/components/shared/data-display";
import { LoadingStatus, TableSkeletonRows } from "@/components/shared/loading";
import { DecisionHistory } from "@/components/production/decision-history";

function EvidenceDetails({ event }: { event: ProductionAuditEvent }) {
  return (
    <div
      className="production-audit-details"
      id={`evidence-${event.source}-${event.id}`}
    >
      <h2>
        {event.orderNo} ·{" "}
        {event.action === "SEWING_STARTED"
          ? "Sewing start"
          : "Recorded evidence"}
      </h2>
      <p className="intro">
        {event.actorName} · <HumanDateTime value={event.time} />
      </p>
      <p className="helper">
        Actor name:{" "}
        {event.actorNameBasis === "decision snapshot"
          ? "recorded at sign-off"
          : event.actorNameBasis === "current account name"
            ? "current account name; actor ID and action time are recorded"
            : "unavailable; recorded actor ID retained below"}
        .
      </p>
      {event.attemptNo && (
        <dl className="audit-batch-facts">
          <div>
            <dt>Attempt</dt>
            <dd>{event.attemptNo}</dd>
          </div>
          <div>
            <dt>Recipe at submission</dt>
            <dd>{event.recipeName}</dd>
          </div>
          <div>
            <dt>Garments</dt>
            <dd>{formatCount(event.targetQty!)}</dd>
          </div>
          <div>
            <dt>Fabric roll at submission</dt>
            <dd>{event.fabricRollId}</dd>
          </div>
        </dl>
      )}
      {event.evidence && (
        <DecisionHistory
          evidence={[event.evidence]}
          title={
            event.action === "SEWING_STARTED"
              ? "Approved batch evidence"
              : "Verification evidence"
          }
        />
      )}
      <details className="technical-details">
        <summary>Technical audit details</summary>
        <dl>
          <div>
            <dt>Source record</dt>
            <dd>
              {event.source} · {event.id}
            </dd>
          </div>
          <div>
            <dt>Order ID</dt>
            <dd>{event.orderId}</dd>
          </div>
          <div>
            <dt>Actor ID</dt>
            <dd>{event.actorId}</dd>
          </div>
          {event.attemptId && (
            <div>
              <dt>Attempt ID</dt>
              <dd>{event.attemptId}</dd>
            </div>
          )}
          <div>
            <dt>Exact action time</dt>
            <dd>{event.time}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
export function ProductionAuditPanel() {
  const [page, setPage] = useState<ProductionAuditPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const [loadedPage, setLoadedPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    const cursor = cursors.at(-1);
    api<ProductionAuditPage>(
      `/api/admin/production-audit${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((data) => {
        if (!cancelled) {
          setPage(data);
          setLoadedPage(cursors.length + 1);
          setExpanded({});
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "Production audit could not be loaded. Try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursors, retry]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Production audit</h1>
          <p className="intro">
            Recorded manufacturing activity and permanent sign-off evidence.
          </p>
        </div>
      </div>
      <p className="helper">
        Read-only · Creation, submissions, verification decisions and sewing
        starts · {displayTimezone}
      </p>
      {error && (
        <div className="alert error" role="alert">
          <p>{error}</p>
          {page && <p>Previous results remain visible.</p>}
          <button
            className="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setRetry((r) => r + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      <LoadingStatus
        busy={busy}
        label={
          page
            ? "Loading production events; previous results remain visible…"
            : "Loading production events…"
        }
      />
      <div
        className="table-region"
        role="region"
        aria-label="Production events"
        aria-busy={busy}
        tabIndex={0}
      >
        <table className="production-audit-table">
          <caption>Authoritative production records</caption>
          <thead>
            <tr>
              <th>Time</th>
              <th>Order</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Summary</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {busy && !page && <TableSkeletonRows columns={6} />}
            {page?.items.map((event) => {
              const key = `${event.source}-${event.id}`;
              return (
                <Fragment key={key}>
                  <tr>
                    <td>
                      <HumanDateTime value={event.time} stacked />
                    </td>
                    <td className="primary-data order-number">
                      {event.orderNo}
                    </td>
                    <td title={`Actor name: ${event.actorNameBasis}`}>
                      {event.actorName}
                    </td>
                    <td>
                      <StatusBadge status={event.action} />
                    </td>
                    <td className="production-summary">{event.summary}</td>
                    <td>
                      <button
                        className="button secondary"
                        aria-expanded={Boolean(expanded[key])}
                        aria-controls={`evidence-${key}`}
                        onClick={() =>
                          setExpanded((old) => ({ ...old, [key]: !old[key] }))
                        }
                      >
                        {expanded[key]
                          ? "Hide evidence"
                          : event.action === "SEWING_STARTED"
                            ? "View batch"
                            : "View evidence"}
                        <span className="sr-only">
                          {" "}
                          for {event.orderNo}, {event.source.toLowerCase()} at{" "}
                          {event.time}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expanded[key] && (
                    <tr>
                      <td colSpan={6}>
                        <EvidenceDetails event={event} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!busy && page?.items.length === 0 && (
        <p className="empty-state">No production activity has been recorded.</p>
      )}
      {page && (
        <div className="pagination">
          <button
            className="button"
            disabled={busy || !cursors.length}
            onClick={() => {
              setBusy(true);
              setCursors((old) => old.slice(0, -1));
            }}
          >
            Previous
          </button>
          <span>Page {loadedPage}</span>
          <button
            className="button"
            disabled={busy || Boolean(error) || !page.nextCursor}
            onClick={() => {
              if (page.nextCursor) {
                setBusy(true);
                setCursors((old) => [...old, page.nextCursor!]);
              }
            }}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
