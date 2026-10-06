import { Check, TriangleAlert, CircleAlert, Minus } from "lucide-react";
import { componentResult } from "@/modules/verification/rules";
export function ComponentStatus({
  expected,
  actual,
}: {
  expected: number;
  actual: number | null;
}) {
  const result = componentResult(expected, actual);
  if (result === null)
    return (
      <span className="component-status">
        <Minus size={16} aria-hidden="true" />
        Not counted
      </span>
    );
  if (result === "GREEN")
    return (
      <span className="component-status match">
        <Check size={16} aria-hidden="true" />
        Match
      </span>
    );
  if (result === "YELLOW")
    return (
      <span className="component-status excess">
        <TriangleAlert size={16} aria-hidden="true" />
        Excess +{actual! - expected}
      </span>
    );
  return (
    <span className="component-status shortage">
      <CircleAlert size={16} aria-hidden="true" />
      Shortage {expected - actual!}
    </span>
  );
}
