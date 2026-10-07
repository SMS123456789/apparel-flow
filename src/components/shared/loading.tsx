import { LoaderCircle } from "lucide-react";

export function PendingLabel({
  pending,
  label,
  pendingLabel,
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <span className="pending-label">
      <span aria-hidden="true" className="label-reserve" data-label={label} />
      <span
        aria-hidden="true"
        className="label-reserve pending-reserve"
        data-label={pendingLabel}
      />
      <span className="visible-label">
        {pending && <LoaderCircle size={16} aria-hidden="true" />}
        {pending ? pendingLabel : label}
      </span>
    </span>
  );
}
export function LoadingStatus({
  busy,
  label,
  idle = "",
}: {
  busy: boolean;
  label: string;
  idle?: string;
}) {
  return (
    <p className="helper loading-status" role="status" aria-live="polite">
      {busy && <LoaderCircle size={16} aria-hidden="true" />}
      {busy ? label : idle}
    </p>
  );
}
export function TableSkeletonRows({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className="skeleton-row" aria-hidden="true">
      {Array.from({ length: columns }, (_, column) => (
        <td key={column}>
          <span className={`skeleton-bar ${column % 3 === 0 ? "short" : ""}`} />
        </td>
      ))}
    </tr>
  ));
}
export function LoadingTable({
  columns,
  label,
}: {
  columns: string[];
  label: string;
}) {
  return (
    <>
      <LoadingStatus busy label={label} />
      <div className="table-region" aria-busy="true">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableSkeletonRows columns={columns.length} />
          </tbody>
        </table>
      </div>
    </>
  );
}
export function WorkspaceLoading({
  title,
  columns,
  filters = true,
}: {
  title: string;
  columns: string[];
  filters?: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <span
            className="skeleton-bar heading-description"
            aria-hidden="true"
          />
        </div>
      </div>
      {filters && (
        <div className="filters skeleton-filters" aria-hidden="true">
          <span className="skeleton-bar" />
          <span className="skeleton-bar" />
          <span className="skeleton-bar short" />
        </div>
      )}
      <LoadingTable
        columns={columns}
        label={`Loading ${title.toLowerCase()}…`}
      />
    </>
  );
}
export function BatchLoading({
  kind,
}: {
  kind: "preparation" | "verification" | "sewing";
}) {
  return (
    <>
      <LoadingStatus
        busy
        label={`Loading ${kind === "sewing" ? "verified batch" : kind}…`}
      />
      <div aria-busy="true" className="batch-skeleton">
        <div className="page-heading" aria-hidden="true">
          <div>
            <span className="skeleton-bar skeleton-title" />
            <span className="skeleton-bar heading-description" />
          </div>
        </div>
        {kind === "preparation" && (
          <div className="form-grid skeleton-fields" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="skeleton-bar" />
            ))}
          </div>
        )}
        {kind === "sewing" && (
          <div className="assembly-state" aria-hidden="true">
            <span className="skeleton-bar" />
          </div>
        )}
        <div className="table-region">
          <table>
            <thead>
              <tr>
                {(kind === "preparation"
                  ? ["Component", "Pieces/garment", "Expected pieces"]
                  : ["Component", "Expected", "Actual", "Difference", "Result"]
                ).map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableSkeletonRows columns={kind === "preparation" ? 3 : 5} />
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
