import { renderSecurityBoundarySummary } from "../../components/SecurityBoundarySummary.js";

export function renderSecurityBoundaryModule({ copy }) {
  return renderSecurityBoundarySummary(copy.securityCopy);
}
