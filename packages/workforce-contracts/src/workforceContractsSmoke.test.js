import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKFORCE_DOMAIN_BOUNDARY,
  BRAIN_BINDING_MODES,
  DEFAULT_BRAIN_BINDING,
  validateBrainBinding,
  EMPLOYEE_STATUSES,
  validateEmployeeShape,
  POSITION_IMPORT_STATUSES,
} from "./index.js";

test("WORKFORCE_DOMAIN_BOUNDARY 冻结且保留 dry-run 预览边界", () => {
  assert.ok(Object.isFrozen(WORKFORCE_DOMAIN_BOUNDARY));
  assert.equal(WORKFORCE_DOMAIN_BOUNDARY.domain, "workforce");
  assert.equal(WORKFORCE_DOMAIN_BOUNDARY.runtimeMode, "dry_run_preview");
  assert.equal(WORKFORCE_DOMAIN_BOUNDARY.providerCallsMade, false);
  assert.equal(WORKFORCE_DOMAIN_BOUNDARY.secretValueExposed, false);
});

test("契约常量为冻结集合，校验器为函数", () => {
  assert.ok(Object.isFrozen(BRAIN_BINDING_MODES));
  assert.ok(Array.isArray(BRAIN_BINDING_MODES) && BRAIN_BINDING_MODES.length > 0);
  assert.ok(Object.isFrozen(DEFAULT_BRAIN_BINDING));
  assert.ok(Object.isFrozen(EMPLOYEE_STATUSES));
  assert.ok(Object.isFrozen(POSITION_IMPORT_STATUSES));
  assert.equal(typeof validateBrainBinding, "function");
  assert.equal(typeof validateEmployeeShape, "function");
});

test("validateBrainBinding 接受默认绑定，报告未知模式", () => {
  assert.doesNotThrow(() => validateBrainBinding(DEFAULT_BRAIN_BINDING));
  const invalid = validateBrainBinding({ ...DEFAULT_BRAIN_BINDING, mode: "not-a-mode" });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.modeValid, false);
});
