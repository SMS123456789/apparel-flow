"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/http/client";
import { orderStatuses, type OrderPage } from "@/modules/orders/types";
export function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
}
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
        <button className="button" disabled={busy}>
          Apply filters
        </button>
      </form>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <p className="helper" role="status">
        {busy ? "Loading orders…" : "Times shown in UTC."}
      </p>
      <div
        className="table-region"
        role="region"
        aria-label="Cutting orders"
        tabIndex={0}
      >
        <table>
          <caption>Factory cutting orders</caption>
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
            {result?.items.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNo}</td>
                <td>
                  {order.recipeName}
                  <span className="helper block">{order.recipeCode}</span>
                </td>
                <td className="numeric">{order.targetQty}</td>
                <td>{statusLabel(order.status)}</td>
                <td>
                  {new Date(order.updatedAt)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 19)}
                </td>
                <td>
                  <Link href={`/supervisor/${order.id}`}>
                    Open batch<span className="sr-only"> {order.orderNo}</span>
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
