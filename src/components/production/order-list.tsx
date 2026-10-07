"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/http/client";
import { orderStatuses, type OrderPage } from "@/modules/orders/types";
import { StatusBadge, statusLabel } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  displayTimezone,
  formatCount,
} from "@/components/shared/data-display";
import { ChevronRight } from "lucide-react";
import {
  PendingLabel,
  LoadingStatus,
  TableSkeletonRows,
} from "@/components/shared/loading";
export function OrderList() {
  const [result, setResult] = useState<OrderPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState({ status: "", search: "" });
  const [cursors, setCursors] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      setBusy(true);
      setError("");
      const params = new URLSearchParams();
      if (query.status) params.set("status", query.status);
      if (query.search) params.set("search", query.search);
      const cursor = cursors.at(-1);
      if (cursor) params.set("cursor", cursor);
      try {
        const data = await api<OrderPage>(`/api/orders?${params}`);
        if (!cancelled) setResult(data);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Orders could not be loaded.",
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
          <h1>Cutting orders</h1>
          <p className="intro">
            Prepare batches, submit for verification, and attend to rejected
            work.
          </p>
        </div>
        <Link href="/supervisor/new" className="button primary">
          Create Order
        </Link>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          setCursors([]);
          setQuery({ status, search });
        }}
      >
        <div className="field search-field">
          <label htmlFor="order-search">Search order number</label>
          <input
            id="order-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder="AF-…"
          />
        </div>
        <div className="field">
          <label htmlFor="order-status">Cutting state</label>
          <select
            id="order-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All cutting states</option>
            {orderStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button className="button" disabled={busy} aria-busy={busy}>
          <PendingLabel
            pending={busy && Boolean(result)}
            label="Apply filters"
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
            ? "Loading orders; previous results remain visible…"
            : "Loading orders…"
        }
        idle={`Times: ${displayTimezone}.`}
      />
      <div
        className="table-region"
        role="region"
        aria-label="Cutting orders"
        tabIndex={0}
        aria-busy={busy}
      >
        <table>
          <caption>Factory cutting orders</caption>
          <thead>
            <tr>
              <th>Order</th>
              <th>Recipe</th>
              <th className="numeric">Garments</th>
              <th>State</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {busy && !result && <TableSkeletonRows columns={6} />}
            {result?.items.map((order) => (
              <tr key={order.id}>
                <td className="primary-data order-number">{order.orderNo}</td>
                <td>
                  <span className="primary-data">{order.recipeName}</span>
                  <span className="helper block">{order.recipeCode}</span>
                </td>
                <td className="numeric">{formatCount(order.targetQty)}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>
                  <HumanDateTime value={order.updatedAt} stacked />
                </td>
                <td>
                  <Link className="row-action" href={`/supervisor/${order.id}`}>
                    Open batch<span className="sr-only"> {order.orderNo}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!busy && !error && result?.items.length === 0 && (
        <p className="empty-state">
          {query.status || query.search
            ? "No orders match these filters."
            : "No cutting orders yet. Create a batch to begin."}
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
