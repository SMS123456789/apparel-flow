"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/http/client";
import type { OrderPage } from "@/modules/orders/types";
import { statusLabel } from "./order-list";
export function VerificationQueue({ history = false }: { history?: boolean }) {
  const [result, setResult] = useState<OrderPage | null>(null),
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
        const data = await api<OrderPage>(
          `/api/verification/${history ? "history" : "queue"}?${params}`,
        );
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
  }, [history, query, cursors]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{history ? "Verification history" : "Verification queue"}</h1>
          <p className="intro">
            {history
              ? "Review submitted batches and permanent decision evidence."
              : "Count each frozen component before approving a batch."}
          </p>
        </div>
        <Link
          className="button"
          href={history ? "/verifier" : "/verifier/history"}
        >
          {history ? "Pending queue" : "Verification history"}
        </Link>
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
          <label htmlFor="verification-search">Search order number</label>
          <input
            id="verification-search"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="AF-…"
          />
        </div>
        <button className="button" disabled={busy}>
          Search
        </button>
      </form>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <p className="helper" role="status">
        {busy ? "Loading batches…" : "Times shown in UTC."}
      </p>
      <div
        className="table-region"
        role="region"
        aria-label="Verification batches"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Recipe</th>
              <th className="numeric">Garments</th>
              <th>State</th>
              <th>Updated (UTC)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result?.items.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNo}</td>
                <td>
                  {o.recipeName}
                  <span className="helper block">{o.recipeCode}</span>
                </td>
                <td className="numeric">{o.targetQty}</td>
                <td>{statusLabel(o.status)}</td>
                <td>
                  {new Date(o.updatedAt)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19)}
                </td>
                <td>
                  <Link href={`/verifier/${o.id}`}>
                    Open batch<span className="sr-only"> {o.orderNo}</span>
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
            : history
              ? "No submitted batches yet."
              : "No batches are pending verification."}
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
