import { EMPLOYEE_ROOM_TYPES, PHASE587_FANOUT_LIMITS } from "./messageTypeEnums.js";

export const EMPLOYEE_ROOM_REQUIRED_FIELDS = Object.freeze([
  "roomId",
  "roomType",
  "title",
  "memberEmployeeIds",
  "allowedTaskTypes",
  "fanoutPolicy",
  "evidencePolicy",
  "dryRunOnly",
]);

export function createEmployeeRoom(overrides = {}) {
  return {
    roomId: "room.preview.product-ux-review",
    roomType: "review_room",
    title: "Product / UX Review Room",
    memberEmployeeIds: ["emp-product-chief", "emp-ux-researcher", "emp-ai-gateway-engineer"],
    allowedTaskTypes: ["ux_refinement_plan", "provider_routing_audit", "general_workforce_task"],
    fanoutPolicy: { ...PHASE587_FANOUT_LIMITS },
    evidencePolicy: { required: true, timelineRequired: true },
    dryRunOnly: true,
    ...overrides,
  };
}

export function validateEmployeeRoom(room) {
  const errors = [];
  if (!room || typeof room !== "object") errors.push("room must be an object");
  for (const field of EMPLOYEE_ROOM_REQUIRED_FIELDS) {
    if (room?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (!EMPLOYEE_ROOM_TYPES.includes(room?.roomType)) errors.push("unsupported roomType");
  if (!Array.isArray(room?.memberEmployeeIds) || room.memberEmployeeIds.length > PHASE587_FANOUT_LIMITS.maxCandidateEmployees) errors.push("room members must respect candidate limit");
  if (room?.fanoutPolicy?.maxActiveEmployees > PHASE587_FANOUT_LIMITS.maxActiveEmployees) errors.push("maxActiveEmployees limit exceeded");
  if (room?.fanoutPolicy?.maxBrainCalls !== 0) errors.push("maxBrainCalls must be 0");
  if (room?.dryRunOnly !== true) errors.push("room must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
