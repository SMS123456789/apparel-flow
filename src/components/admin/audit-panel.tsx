"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/http/client";
import type { AdminAuditEvent, PageResult } from "@/modules/admin/types";
const labels = {
  USER_CREATED: "User created",
  USER_ROLE_CHANGED: "Role changed",
  USER_ACTIVATED: "Activated",
  USER_DEACTIVATED: "Deactivated",
};
export function AuditPanel() {
  const [page, setPage] = useState<PageResult<AdminAuditEvent> | null>(null);
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
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Audit could not be loaded. Reload to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [cursors]);
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
          {error}
        </p>
      )}
      {!page && !error ? (
        <p role="status">Loading audit…</p>
      ) : (
        page && (
          <>
            <div
              className="table-region"
              role="region"
              aria-label="Administrative events"
              tabIndex={0}
            >
              <table>
                <caption>Account-management events</caption>
                <thead>
                  <tr>
                    <th scope="col">Time (local)</th>
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
                        <time dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString()}
                        </time>
                      </td>
                      <td>{event.actorName}</td>
                      <td>{event.targetName}</td>
                      <td>{labels[event.action]}</td>
                      <td>
                        <details>
                          <summary>View changes</summary>
                          <div className="audit-details">
                            Before: {JSON.stringify(event.beforeState)}
                            <br />
                            After: {JSON.stringify(event.afterState)}
                            <br />
                            Request: {event.requestId}
                          </div>
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
                disabled={!cursors.length}
                onClick={() => {
                  setPage(null);
                  setCursors((old) => old.slice(0, -1));
                }}
              >
                Previous
              </button>
              <span>Page {cursors.length + 1}</span>
              <button
                className="button secondary"
                disabled={!page.nextCursor}
                onClick={() => {
                  if (page.nextCursor) {
                    const next = page.nextCursor;
                    setPage(null);
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
