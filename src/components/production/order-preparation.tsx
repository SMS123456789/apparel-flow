"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/http/client";
import { createOrderSchema } from "@/modules/orders/schemas";
import { expectedFabric, requirements } from "@/modules/orders/calculations";
import type { OrderDetail, Recipe } from "@/modules/orders/types";
import { ActionDialog } from "@/components/shared/action-dialog";
import {
  StatusBadge,
  FrozenIndicator,
} from "@/components/shared/semantic-status";
import { DecisionHistory } from "./decision-history";
import {
  formatCount,
  PercentageDisplay,
} from "@/components/shared/data-display";
export function OrderPreparation({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [form, setForm] = useState({
    recipeId: "",
    targetQty: "",
    fabricRollId: "",
    actualFabricYards: "",
  });
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<"submit" | "recut" | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = JSON.stringify(form) !== saved;
  function loadOrder(data: OrderDetail) {
    setOrder(data);
    const next = {
      recipeId: data.recipe.id,
      targetQty: String(data.targetQty),
      fabricRollId: data.fabricRollId,
      actualFabricYards: data.actualFabricYards,
    };
    setForm(next);
    setSaved(JSON.stringify(next));
  }
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Recipe[]>("/api/recipes"),
      orderId
        ? api<OrderDetail>(`/api/orders/${orderId}`)
        : Promise.resolve(null),
    ])
      .then(([catalog, data]) => {
        if (cancelled) return;
        setRecipes(catalog);
        if (data) loadOrder(data);
        else {
          const next = {
            recipeId: catalog[0]?.id ?? "",
            targetQty: "",
            fabricRollId: "",
            actualFabricYards: "",
          };
          setForm(next);
          setSaved(JSON.stringify(next));
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Preparation could not be loaded.",
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
  useEffect(() => {
    if (!dirty) return;
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const recipe = recipes.find((r) => r.id === form.recipeId);
  const target = /^\d+$/.test(form.targetQty) ? Number(form.targetQty) : NaN;
  let preview = order?.firstSubmittedAt ? order.components : [];
  let fabric = order?.firstSubmittedAt ? order.expectedFabricYards : "—";
  if (
    !order?.firstSubmittedAt &&
    recipe &&
    Number.isInteger(target) &&
    target > 0 &&
    target <= 2147483647
  ) {
    try {
      preview = requirements(recipe, target);
      fabric = expectedFabric(target, recipe.standardFabricYards);
    } catch {
      preview = [];
    }
  }
  const editable = !order || order.status === "CUTTING_IN_PROGRESS";
  const frozen = Boolean(order?.firstSubmittedAt);
  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setNotice("");
    const candidate =
      key === "targetQty"
        ? /^\d+$/.test(value)
          ? Number(value)
          : value
        : key === "actualFabricYards"
          ? /^\d+(?:\.\d{1,3})?$/.test(value)
            ? Number(value)
            : value
          : value;
    const checked = createOrderSchema.shape[key].safeParse(candidate);
    setFields((current) => ({
      ...current,
      [key]: checked.success
        ? []
        : checked.error.issues.map((issue) => issue.message),
    }));
  }
  function fail(e: unknown) {
    setError(
      e instanceof Error ? e.message : "The operation failed. Try again.",
    );
    setFields(e instanceof ApiClientError ? e.fieldErrors : {});
  }
  async function save() {
    setError("");
    setFields({});
    setNotice("");
    const input = {
      recipeId: form.recipeId,
      targetQty: /^\d+$/.test(form.targetQty)
        ? Number(form.targetQty)
        : form.targetQty,
      fabricRollId: form.fabricRollId,
      actualFabricYards: /^\d+(?:\.\d{1,3})?$/.test(form.actualFabricYards)
        ? Number(form.actualFabricYards)
        : form.actualFabricYards,
    };
    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues)
        (errors[issue.path.join(".") || "form"] ??= []).push(issue.message);
      setFields(errors);
      setError("Check the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<OrderDetail>(
        order ? `/api/orders/${order.id}` : "/api/orders",
        {
          method: order ? "PATCH" : "POST",
          body: {
            ...parsed.data,
            ...(order ? { expectedRevision: order.revision } : {}),
          },
        },
      );
      loadOrder(data);
      setNotice("Saved preparation.");
      if (!order) router.replace(`/supervisor/${data.id}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function transition() {
    if (!order || !action) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<OrderDetail>(`/api/orders/${order.id}/${action}`, {
        method: "POST",
        body: { expectedRevision: order.revision },
      });
      loadOrder(data);
      setNotice(
        action === "submit"
          ? "Submitted for verification."
          : "Re-cut preparation opened. Save replacement fabric details before resubmitting.",
      );
      setAction(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  function errorText(key: string) {
    return fields[key]?.join(" ");
  }
  if (loading) return <p role="status">Loading preparation…</p>;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{order ? order.orderNo : "Create cutting order"}</h1>
          <div className="batch-context">
            {order ? (
              <StatusBadge status={order.status} />
            ) : (
              <p className="intro">
                Save preparation before submitting the batch.
              </p>
            )}
          </div>
        </div>
        <Link
          className="button"
          href="/supervisor"
          onClick={(e) => {
            if (
              dirty &&
              !window.confirm("Discard unsaved preparation changes?")
            )
              e.preventDefault();
          }}
        >
          Back to orders
        </Link>
      </div>
      {error && !action && (
        <p className="alert error" role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      {order?.status === "REJECTED" && (
        <div className="alert error">
          <h2>Re-cut required</h2>
          <p>
            {order.evidence.at(-1)?.reason ??
              "Review the finalized rejection evidence."}
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => setAction("recut")}
          >
            Begin Re-cut
          </button>
        </div>
      )}
      <form
        className="preparation-form form-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset className="form-section">
          <legend>Order information</legend>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="recipe">Recipe (required)</label>
              <select
                id="recipe"
                required
                value={form.recipeId}
                disabled={!editable || frozen || busy}
                aria-invalid={Boolean(fields.recipeId?.length)}
                aria-describedby={
                  fields.recipeId?.length ? "recipe-error" : undefined
                }
                onChange={(e) => update("recipeId", e.target.value)}
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
              {Boolean(fields.recipeId?.length) && (
                <p id="recipe-error" className="field-error">
                  {errorText("recipeId")}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="target">
                Target batch quantity (garments, required)
              </label>
              <input
                id="target"
                inputMode="numeric"
                required
                value={form.targetQty}
                readOnly={!editable || frozen}
                disabled={busy}
                aria-invalid={Boolean(fields.targetQty?.length)}
                aria-describedby={
                  fields.targetQty?.length ? "target-error" : undefined
                }
                onChange={(e) => update("targetQty", e.target.value)}
              />
              {Boolean(fields.targetQty?.length) && (
                <p id="target-error" className="field-error">
                  {errorText("targetQty")}
                </p>
              )}
            </div>
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend>Fabric information</legend>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="roll">Fabric roll ID (required)</label>
              <input
                id="roll"
                required
                maxLength={100}
                value={form.fabricRollId}
                readOnly={!editable}
                disabled={busy}
                aria-invalid={Boolean(fields.fabricRollId?.length)}
                aria-describedby={
                  fields.fabricRollId?.length ? "roll-error" : undefined
                }
                onChange={(e) => update("fabricRollId", e.target.value)}
              />
              {Boolean(fields.fabricRollId?.length) && (
                <p id="roll-error" className="field-error">
                  {errorText("fabricRollId")}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="fabric">
                Actual fabric used (yards, required)
              </label>
              <input
                id="fabric"
                inputMode="decimal"
                required
                value={form.actualFabricYards}
                readOnly={!editable}
                disabled={busy}
                aria-invalid={Boolean(fields.actualFabricYards?.length)}
                aria-describedby="fabric-help fabric-error"
                onChange={(e) => update("actualFabricYards", e.target.value)}
              />
              <p id="fabric-help" className="helper">
                Positive yards, at most three decimal places.
              </p>
              <p id="fabric-error" className="field-error">
                {errorText("actualFabricYards")}
              </p>
            </div>
          </div>
        </fieldset>
        <div className="operational-section">
          <div className="section-heading">
            <h2>
              {frozen
                ? "Frozen requirements"
                : "Recipe requirements — preparation preview"}
            </h2>
            {frozen && <FrozenIndicator />}
          </div>
          <p className="intro">
            {recipe?.category} · Standard {recipe?.standardFabricYards}{" "}
            yards/garment · Expected fabric: <strong>{fabric} yards</strong>
          </p>
          <p className="helper">
            Wastage cap{" "}
            {recipe && <PercentageDisplay value={recipe.wastageCapPct} />} is
            informational.{" "}
            {frozen
              ? "Recipe, target and BOM are read-only after first submission."
              : "First submission freezes recipe, target and the full component manifest."}
          </p>
          <div
            className="table-region"
            role="region"
            aria-label="Required components"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="numeric">Pieces/garment</th>
                  <th className="numeric">Expected pieces</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c) => (
                  <tr key={c.componentId}>
                    <td>{c.name}</td>
                    <td className="numeric">{c.piecesPerGarment}</td>
                    <td className="numeric numeric-emphasis">
                      {formatCount(c.expectedQty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!preview.length && (
            <p className="helper">
              Enter a valid target quantity to preview the BOM.
            </p>
          )}
        </div>
        <div className="actions">
          {editable && (
            <button className="button primary" disabled={busy || !dirty}>
              {busy ? "Saving…" : order ? "Save preparation" : "Create Order"}
            </button>
          )}
          {order && editable && (
            <button
              type="button"
              className="button primary"
              disabled={busy || dirty}
              onClick={() => setAction("submit")}
            >
              Submit for verification
            </button>
          )}
          <span className="helper" role="status">
            {busy
              ? "Saving…"
              : notice ||
                (!order
                  ? "Unsaved preview"
                  : dirty
                    ? "Unsaved preparation"
                    : "Saved preparation")}
          </span>
        </div>
        {order && editable && dirty && (
          <p className="helper">Save preparation changes before submitting.</p>
        )}
      </form>
      {order && (
        <DecisionHistory
          evidence={order.evidence}
          title="Verification history"
          expanded={false}
        />
      )}
      <ActionDialog
        open={action !== null}
        title={action === "recut" ? "Begin Re-cut" : "Submit for verification"}
        description={
          action === "recut"
            ? `Prepare replacement work for ${order?.orderNo}. Previous verification evidence remains permanent.`
            : `Submit ${order?.orderNo}. Recipe, target and component requirements become frozen on first submission.`
        }
        busy={busy}
        onCancel={() => setAction(null)}
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
            onClick={() => setAction(null)}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void transition()}
          >
            {busy
              ? "Submitting…"
              : action === "recut"
                ? "Begin Re-cut"
                : "Confirm submission"}
          </button>
        </div>
      </ActionDialog>
    </>
  );
}
