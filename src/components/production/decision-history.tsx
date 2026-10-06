import type { DecisionEvidence } from "@/modules/orders/types";
import { ComponentStatus } from "./component-status";
export function DecisionHistory({
  evidence,
}: {
  evidence: DecisionEvidence[];
}) {
  return (
    <section className="operational-section">
      <h2>Verification evidence</h2>
      {!evidence.length ? (
        <p className="intro">No finalized verification decisions yet.</p>
      ) : (
        evidence.map((e) => (
          <details key={e.id} open>
            <summary>
              {e.decision === "APPROVED" ? "Approved" : "Rejected"} ·{" "}
              {e.verifierName} · {e.createdAt} (UTC)
            </summary>
            {e.reason && <p className="intro">Reason: {e.reason}</p>}
            <p className="helper">
              Verifier: {e.verifierName} ({e.verifierId}) · Immutable decision{" "}
              {e.id}
            </p>
            <p className="intro">
              Fabric: expected {e.expectedFabricYards} yards · actual{" "}
              {e.actualFabricYards} yards · Signed wastage {e.wastagePct}%
            </p>
            <div
              className="table-region"
              role="region"
              aria-label="Immutable component evidence"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th className="numeric">Expected</th>
                    <th className="numeric">Actual</th>
                    <th className="numeric">Variance</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items.map((i) => (
                    <tr key={i.componentId}>
                      <td>{i.name}</td>
                      <td className="numeric">{i.expectedQty}</td>
                      <td className="numeric">
                        {i.actualQty ?? "Not counted"}
                      </td>
                      <td className="numeric">
                        {i.actualQty === null
                          ? "—"
                          : `${i.actualQty - i.expectedQty >= 0 ? "+" : ""}${i.actualQty - i.expectedQty}`}
                      </td>
                      <td>
                        <ComponentStatus
                          expected={i.expectedQty}
                          actual={i.actualQty}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))
      )}
    </section>
  );
}
