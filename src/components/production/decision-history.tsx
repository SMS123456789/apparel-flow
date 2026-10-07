import type { DecisionEvidence } from "@/modules/orders/types";
import { StatusBadge } from "@/components/shared/semantic-status";
import {
  HumanDateTime,
  PercentageDisplay,
  displayTimezone,
  formatCount,
} from "@/components/shared/data-display";
import { ComponentStatus } from "./component-status";
export function DecisionHistory({
  evidence,
  title = "Verification evidence",
  expanded = true,
}: {
  evidence: DecisionEvidence[];
  title?: string;
  expanded?: boolean;
}) {
  return (
    <section className="operational-section">
      <h2>{title}</h2>
      {!evidence.length ? (
        <p className="intro">No finalized verification decisions yet.</p>
      ) : (
        <>
          <p className="helper">Permanent sign-off · {displayTimezone}</p>
          {evidence.map((e) => (
            <details key={e.id} className="evidence-entry" open={expanded}>
              <summary>
                <StatusBadge status={e.decision} />
                <span className="evidence-meta">
                  {e.verifierName} · <HumanDateTime value={e.createdAt} />
                </span>
              </summary>
              {e.reason && <p className="reason">Reason: {e.reason}</p>}
              <p className="helper intro">Verifier: {e.verifierName}</p>
              <div className="evidence-fabric">
                <div>
                  <span className="helper">Expected fabric</span>
                  <strong>{e.expectedFabricYards} yards</strong>
                </div>
                <div>
                  <span className="helper">Actual fabric</span>
                  <strong>{e.actualFabricYards} yards</strong>
                </div>
                <div>
                  <span className="helper">Signed wastage</span>
                  <strong>
                    <PercentageDisplay value={e.wastagePct} />
                  </strong>
                </div>
              </div>
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
                        <td className="numeric">
                          {formatCount(i.expectedQty)}
                        </td>
                        <td className="numeric">
                          {i.actualQty === null
                            ? "Not counted"
                            : formatCount(i.actualQty)}
                        </td>
                        <td className="numeric">
                          {i.actualQty === null
                            ? "—"
                            : `${i.actualQty - i.expectedQty >= 0 ? "+" : ""}${formatCount(i.actualQty - i.expectedQty)}`}
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
              <details className="technical-details">
                <summary>Audit details</summary>
                <dl>
                  <div>
                    <dt>Verifier ID</dt>
                    <dd>{e.verifierId}</dd>
                  </div>
                  <div>
                    <dt>Immutable decision</dt>
                    <dd>{e.id}</dd>
                  </div>
                  <div>
                    <dt>Exact timestamp</dt>
                    <dd>{e.createdAt} (UTC)</dd>
                  </div>
                  <div>
                    <dt>Exact signed wastage</dt>
                    <dd>{e.wastagePct}%</dd>
                  </div>
                </dl>
              </details>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
