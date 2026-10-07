"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/http/client";
import type { SewingPage } from "@/modules/sewing/types";
import { StatusBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  PercentageDisplay,
  displayTimezone,
  formatCount,
} from "@/components/shared/data-display";
import { ChevronRight } from "lucide-react";
import {
  PendingLabel,
  LoadingStatus,
  TableSkeletonRows,
} from "@/components/shared/loading";
export function SewingQueue() {
  const [result, setResult] = useState<SewingPage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      setBusy(true);
      setError("");
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (cursors.at(-1)) params.set("cursor", cursors.at(-1)!);
      try {
        const data = await api<SewingPage>(`/api/sewing/queue?${params}`);
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Batches could not be loaded.",
          );
      } finally {
        if (!cancelled) setBusy(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, cursors]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Sewing queue</h1>
          <p className="intro">
            Verified batches and their immutable approved evidence.
          </p>
        </div>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setCursors([]);
        }}
      >
        <div className="field search-field">
          <label htmlFor="sewing-search">Search order number</label>
          <input
            id="sewing-search"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="AF-…"
          />
        </div>
        <button className="button" disabled={busy} aria-busy={busy}>
          <PendingLabel
            pending={busy && Boolean(result)}
            label="Search"
            pendingLabel="Applying…"
          />
        </button>
      </form>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <LoadingStatus
        busy={busy}
        label={
          result
            ? "Loading batches; previous results remain visible…"
            : "Loading batches…"
        }
        idle={`Times: ${displayTimezone}.`}
      />
      <div
        className="table-region"
        role="region"
        aria-label="Verified sewing batches"
        tabIndex={0}
        aria-busy={busy}
      >
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Recipe</th>
              <th className="numeric">Garments</th>
              <th>Verified by / time</th>
              <th>Signed fabric variance</th>
              <th>Assembly</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {busy && !result && <TableSkeletonRows columns={7} />}
            {result?.items.map((o) => (
              <tr key={o.id}>
                <td className="primary-data order-number">{o.orderNo}</td>
                <td>
                  <span className="primary-data">{o.recipeName}</span>
                  <span className="helper block">{o.recipeCode}</span>
                </td>
                <td className="numeric">{formatCount(o.targetQty)}</td>
                <td>
                  {o.verifierName}
                  <span className="helper block">
                    <HumanDateTime value={o.verifiedAt} stacked />
                  </span>
                </td>
                <td className="numeric">
                  <PercentageDisplay value={o.wastagePct} />
                </td>
                <td>
                  <StatusBadge
                    status={o.sewingStartedAt ? "STARTED" : "READY"}
                  />
                </td>
                <td>
                  <Link className="row-action" href={`/sewing/${o.id}`}>
                    Open batch<span className="sr-only"> {o.orderNo}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!busy && !error && !result?.items.length && (
        <p className="empty-state">
          {query
            ? "No batches match this order number."
            : "No verified batches are available."}
        </p>
      )}
      <div className="pagination">
        <button
          className="button"
          disabled={busy || !cursors.length}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous
        </button>
        <span>Page {cursors.length + 1}</span>
        <button
          className="button"
          disabled={busy || !result?.nextCursor}
          onClick={() => {
            if (result?.nextCursor)
              setCursors((c) => [...c, result.nextCursor!]);
          }}
        >
          Next
        </button>
      </div>
    </>
  );
}
