"use client";
import { useEffect, useState } from "react";
import { LoadingStatus, LoadingTable } from "@/components/shared/loading";
import { api } from "@/lib/http/client";
import type { AdminAuditEvent, PageResult } from "@/modules/admin/types";
import { StatusBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  displayTimezone,
} from "@/components/shared/data-display";
import { roleLabels, type AppRole } from "@/modules/identity/types";
const changeFields = [
  { key: "role", label: "Role" },
  { key: "is_active", label: "Status" },
  { key: "full_name", label: "Name" },
];
function auditValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return "Not set";
  if (key === "is_active" && typeof value === "boolean")
    return value ? "Active" : "Inactive";
  if (key === "role" && typeof value === "string") {
    const role = value.toUpperCase() as AppRole;
    return roleLabels[role] ?? "Unknown role (see audit details)";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
export function AuditPanel() {
  const [page, setPage] = useState<PageResult<AdminAuditEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [loadedPage, setLoadedPage] = useState(1);
  const [error, setError] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const cursor = cursors.at(-1);
    void api<PageResult<AdminAuditEvent>>(
      `/api/admin/audit${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setLoadedPage(cursors.length + 1);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "Audit could not be loaded. Try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursors, retry]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Administrative audit</h1>
          <p className="intro">Recorded account changes and attribution.</p>
        </div>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error} {page && "Previous results remain visible."}
          <button
            className="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRetry((old) => old + 1);
            }}
          >
            Try again
          </button>
        </p>
      )}
      <LoadingStatus
        busy={loading && Boolean(page)}
        label="Loading audit; previous results remain visible…"
      />
      {!page && loading ? (
        <LoadingTable
          label="Loading audit…"
          columns={["Time", "Actor", "User", "Action", "Details"]}
        />
      ) : (
        page && (
          <>
            <div
              className="table-region"
              role="region"
              aria-label="Administrative events"
              aria-busy={loading}
              tabIndex={0}
            >
              <table>
                <caption>Account-management events · {displayTimezone}</caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Actor</th>
                    <th scope="col">User</th>
                    <th scope="col">Action</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <HumanDateTime value={event.createdAt} stacked />
                      </td>
                      <td>{event.actorName}</td>
                      <td className="primary-data">{event.targetName}</td>
                      <td>
                        <StatusBadge status={event.action} />
                      </td>
                      <td>
                        <details>
                          <summary>View changes</summary>
                          <dl className="change-list">
                            {changeFields
                              .filter(
                                (field) =>
                                  event.beforeState[field.key] !==
                                  event.afterState[field.key],
                              )
                              .map((field) => (
                                <div key={field.key}>
                                  <dt>{field.label}</dt>
                                  <dd>
                                    {auditValue(
                                      field.key,
                                      event.beforeState[field.key],
                                    )}
                                    <span
                                      className="change-arrow"
                                      aria-label="changed to"
                                    >
                                      →
                                    </span>
                                    <strong>
                                      {auditValue(
                                        field.key,
                                        event.afterState[field.key],
                                      )}
                                    </strong>
                                  </dd>
                                </div>
                              ))}
                          </dl>
                          <details className="technical-details">
                            <summary>Technical audit details</summary>
                            <dl>
                              <div>
                                <dt>Event ID</dt>
                                <dd>{event.id}</dd>
                              </div>
                              <div>
                                <dt>Actor ID</dt>
                                <dd>{event.actorId}</dd>
                              </div>
                              <div>
                                <dt>Target ID</dt>
                                <dd>{event.targetUserId}</dd>
                              </div>
                              <div>
                                <dt>Request ID</dt>
                                <dd>{event.requestId}</dd>
                              </div>
                              <div>
                                <dt>Exact timestamp</dt>
                                <dd>{event.createdAt}</dd>
                              </div>
                            </dl>
                            <div className="audit-details">
                              Before: {JSON.stringify(event.beforeState)}
                              <br />
                              After: {JSON.stringify(event.afterState)}
                            </div>
                          </details>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.items.length === 0 && (
              <p className="empty-state">
                No administrative events have been recorded.
              </p>
            )}
            <div className="pagination">
              <button
                className="button secondary"
                disabled={loading || !cursors.length}
                onClick={() => {
                  setLoading(true);
                  setCursors((old) => old.slice(0, -1));
                }}
              >
                Previous
              </button>
              <span>Page {loadedPage}</span>
              <button
                className="button secondary"
                disabled={loading || Boolean(error) || !page.nextCursor}
                onClick={() => {
                  if (page.nextCursor) {
                    const next = page.nextCursor;
                    setLoading(true);
                    setCursors((old) => [...old, next]);
                  }
                }}
              >
                Next
              </button>
            </div>
          </>
        )
      )}
    </>
  );
}
