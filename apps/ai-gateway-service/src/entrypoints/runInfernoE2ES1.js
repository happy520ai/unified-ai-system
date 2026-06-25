/**
 * Level 6 Inferno — Scenario 1: 毒苹果项目 (12 files, 18 bugs)
 * Extracted from runInfernoE2E.js for file-size compliance.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLoop, PROVIDER_ID, MODEL_ID, testState, assert, section, logTimeline } from "./runInfernoE2EInfra.js";

export async function runS1() {
  // ============================================================
  // S1: 毒苹果项目 — 12 文件 18 bug
  // ============================================================

  section("Scenario 1: 毒苹果项目 — 12 文件 18 个隐藏 bug");

  const s1Dir = join(tmpdir(), `inferno-s1-${Date.now()}`);
  mkdirSync(join(s1Dir, "src", "utils"), { recursive: true });
  mkdirSync(join(s1Dir, "src", "models"), { recursive: true });
  mkdirSync(join(s1Dir, "src", "services"), { recursive: true });
  mkdirSync(join(s1Dir, "src", "controllers"), { recursive: true });
  mkdirSync(join(s1Dir, "test"), { recursive: true });

  // File 1: config.js — Bug 1: 端口号是字符串而非数字
  writeFileSync(join(s1Dir, "src", "config.js"), `
export const config = {
  port: "3000",  // BUG 1: should be number 3000
  host: "localhost",
  maxRetries: 3,
  timeout: 5000,
  debug: true,
};
`, "utf-8");

  // File 2: utils/string.js — Bug 2: capitalize 不处理空字符串
  writeFileSync(join(s1Dir, "src", "utils", "string.js"), `
export function capitalize(str) {
  // BUG 2: no null/empty guard — crashes on null
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str) {
  return str.toLowerCase().replace(/\\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function truncate(str, maxLen = 100) {
  if (str.length <= maxLen) return str;
  // BUG 3: off-by-one — should be str.slice(0, maxLen - 3) + "..."
  return str.slice(0, maxLen) + "...";
}
`, "utf-8");

  // File 3: utils/math.js — Bug 4: average 除以 0 未处理
  writeFileSync(join(s1Dir, "src", "utils", "math.js"), `
export function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

export function average(arr) {
  // BUG 4: no empty array check — division by zero
  return sum(arr) / arr.length;
}

export function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // BUG 5: wrong operator — should be % 2 === 0 (even check is inverted)
  if (sorted.length % 2 !== 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
`, "utf-8");

  // File 4: models/user.js — Bug 6: validate 用 = 而非 ===
  writeFileSync(join(s1Dir, "src", "models", "user.js"), `
import { capitalize } from "../utils/string.js";

export class User {
  constructor(name, email, age) {
    this.name = name;
    this.email = email;
    this.age = age;
    this.createdAt = new Date();
  }

  validate() {
    const errs = [];
    if (!this.name || this.name.trim().length === 0) errs.push("name required");
    // BUG 6: = instead of === (assignment instead of comparison)
    if (this.email = "") errs.push("email required");
    // BUG 7: wrong comparison — age should be > 0, not > -1
    if (typeof this.age !== "number" || this.age > -1) errs.push("invalid age");
    return { valid: errs.length === 0, errors: errs };
  }

  displayName() {
    return capitalize(this.name);
  }
}
`, "utf-8");

  // File 5: models/product.js — Bug 8: discount 计算反了
  writeFileSync(join(s1Dir, "src", "models", "product.js"), `
export class Product {
  constructor(name, price, category) {
    this.name = name;
    this.price = price;
    this.category = category;
  }

  applyDiscount(percent) {
    // BUG 8: discount logic inverted — should multiply by (1 - percent/100)
    return this.price * (percent / 100);
  }

  toJSON() {
    return {
      name: this.name,
      price: this.price,
      category: this.category,
    };
  }
}

export class Cart {
  constructor() {
    this.items = [];
  }

  add(product, qty = 1) {
    this.items.push({ product, qty });
  }

  total() {
    // BUG 9: missing qty multiplication
    return this.items.reduce((sum, item) => sum + item.product.price, 0);
  }

  isEmpty() {
    return this.items.length === 0;
  }
}
`, "utf-8");

  // File 6: services/auth.js — Bug 10: missing await, Bug 11: wrong variable
  writeFileSync(join(s1Dir, "src", "services", "auth.js"), `
import { User } from "../models/user.js";

export class AuthService {
  constructor() {
    this.users = new Map();
    this.sessions = new Map();
  }

  async register(name, email, age) {
    const user = new User(name, email, age);
    const validation = user.validate();
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    // BUG 10: this.users is a Map, should use .set() not .push()
    this.users.push(email, user);
    return { success: true, user };
  }

  async login(email) {
    // BUG 11: wrong variable name — 'this.user' instead of 'this.users'
    const user = this.user.get(email);
    if (!user) return { success: false, error: "user not found" };
    const sessionId = Math.random().toString(36).slice(2);
    this.sessions.set(sessionId, { user, createdAt: Date.now() });
    return { success: true, sessionId };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
}
`, "utf-8");

  // File 7: services/catalog.js — Bug 12: sort comparator reversed
  writeFileSync(join(s1Dir, "src", "services", "catalog.js"), `
import { Product } from "../models/product.js";

export class CatalogService {
  constructor() {
    this.products = [];
  }

  addProduct(name, price, category) {
    const p = new Product(name, price, category);
    this.products.push(p);
    return p;
  }

  searchByCategory(category) {
    return this.products.filter((p) => p.category === category);
  }

  sortByPrice() {
    // BUG 12: sort comparator reversed — sorts descending instead of ascending
    return [...this.products].sort((a, b) => b.price - a.price);
  }

  getCheapest() {
    if (this.products.length === 0) return null;
    return this.sortByPrice()[0];
  }
}
`, "utf-8");

  // File 8: services/search.js — Bug 13: regex 错误, Bug 14: 无限循环
  writeFileSync(join(s1Dir, "src", "services", "search.js"), `
export class SearchEngine {
  constructor() {
    this.index = new Map();
  }

  indexDocument(id, text) {
    // BUG 13: wrong regex — /\\w+/g misses multi-word and unicode
    const words = text.match(/\\d+/g) || [];
    for (const word of words) {
      const w = word.toLowerCase();
      if (!this.index.has(w)) this.index.set(w, new Set());
      this.index.get(w).add(id);
    }
  }

  search(query) {
    const terms = query.toLowerCase().split("\\s+");
    let results = null;
    for (const term of terms) {
      const ids = this.index.get(term);
      if (!ids) return [];
      results = results ? new Set([...results].filter((x) => ids.has(x))) : ids;
    }
    return results ? [...results] : [];
  }

  // BUG 14: infinite loop — i never increments when condition is false
  batchIndex(docs) {
    let i = 0;
    let processed = 0;
    while (i < docs.length) {
      if (docs[i] && docs[i].text) {
        this.indexDocument(docs[i].id, docs[i].text);
        processed++;
      }
      // BUG: i++ is inside the if block — never increments for falsy docs
      if (docs[i] && docs[i].text) {
        i++;
      }
    }
    return processed;
  }
}
`, "utf-8");

  // File 9: services/notification.js — Bug 15: missing try/catch
  writeFileSync(join(s1Dir, "src", "services", "notification.js"), `
export class NotificationService {
  constructor() {
    this.subscribers = [];
    this.history = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify(event, data) {
    const record = { event, data, timestamp: Date.now(), delivered: 0 };
    // BUG 15: no try/catch — one failing subscriber kills all subsequent ones
    for (const cb of this.subscribers) {
      cb(event, data);
      record.delivered++;
    }
    this.history.push(record);
    return record;
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}
`, "utf-8");

  // File 10: controllers/api.js — Bug 16: missing return on error
  writeFileSync(join(s1Dir, "src", "controllers", "api.js"), `
import { AuthService } from "../services/auth.js";
import { CatalogService } from "../services/catalog.js";

export class ApiController {
  constructor() {
    this.auth = new AuthService();
    this.catalog = new CatalogService();
  }

  async handleRegister(req) {
    const { name, email, age } = req.body || {};
    if (!name || !email) {
      // BUG 16: missing return — falls through to register even on error
      { status: 400, error: "name and email required" };
    }
    const result = await this.auth.register(name, email, age);
    return { status: result.success ? 201 : 400, body: result };
  }

  async handleAddProduct(req) {
    const { name, price, category } = req.body || {};
    if (!name || price == null) {
      return { status: 400, error: "name and price required" };
    }
    const product = this.catalog.addProduct(name, price, category);
    return { status: 201, body: product.toJSON() };
  }
}
`, "utf-8");

  // File 11: main.js — Bug 17: 未导入 config 的某字段
  writeFileSync(join(s1Dir, "src", "main.js"), `
import { config } from "./config.js";
import { ApiController } from "./controllers/api.js";

export function createApp() {
  const controller = new ApiController();

  return {
    controller,
    config,
    // BUG 17: config.port is string "3000", used in arithmetic
    getListenPort() {
      return config.port + 1;  // "3000" + 1 = "30001" not 3001
    },
    start() {
      const port = this.getListenPort();
      console.log(\`Server starting on port \${port}\`);
      return { port, host: config.host };
    },
  };
}
`, "utf-8");

  // File 12: test/smoke.test.js — Bug 18: test 断言写反了
  writeFileSync(join(s1Dir, "test", "smoke.test.js"), `
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { User } from "../src/models/user.js";
import { Product, Cart } from "../src/models/product.js";

describe("Smoke Tests", () => {
  it("should create a valid user", () => {
    const user = new User("Alice", "alice@test.com", 25);
    const result = user.validate();
    // BUG 18: assertion inverted — expects false when should be true
    assert.equal(result.valid, false);
  });

  it("should calculate cart total", () => {
    const cart = new Cart();
    cart.add(new Product("A", 10, "x"), 2);
    cart.add(new Product("B", 20, "y"), 3);
    assert.equal(cart.total(), 80);  // 10*2 + 20*3 = 80
  });
});
`, "utf-8");

  // Write the test spec for the LLM
  writeFileSync(join(s1Dir, "BUGFIX_TASK.md"), `# Bug Fix Task

This project has a mini e-commerce backend with 12 source files.
It contains exactly 18 bugs of various types:
- Type errors (string vs number)
- Logic errors (wrong operator, inverted conditions)
- API misuse (Map.push instead of Map.set)
- Off-by-one errors
- Missing null checks
- Missing return statements
- Infinite loops
- Missing error handling
- Wrong regex patterns
- Incorrect assertions in tests

Your job:
1. Read ALL source files carefully
2. Identify each bug
3. Fix them using file_edit or file_write
4. Verify fixes by running: node --check src/config.js src/main.js src/utils/string.js src/utils/math.js src/models/user.js src/models/product.js src/services/auth.js src/services/catalog.js src/services/search.js src/services/notification.js src/controllers/api.js
5. Provide a summary of all 18 bugs found and fixed

Work methodically — file by file, top to bottom.
`, "utf-8");

  logTimeline("s1_start", "12 files, 18 bugs to find and fix");

  const s1Loop = createLoop([], { workingDirectory: s1Dir, maxIterations: 50, tokenBudget: 600_000 });
  const s1Start = Date.now();
  let s1Result;

  try {
    s1Result = await s1Loop.execute({
      goal: `Read the file BUGFIX_TASK.md for instructions. This project at ${s1Dir} has 12 source files with 18 hidden bugs. Read every source file, identify all bugs, and fix them. Be systematic — go file by file. After fixing, verify with node --check.`,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      onIteration: (iter, data) => {
        if (data.type === "tool_calls_executed") {
          const tools = data.toolCalls.map((tc) => tc.name).join(", ");
          logTimeline(`s1_iter_${iter}`, `tool_calls_executed (${data.durationMs}ms) tools: ${tools}`);
        } else if (data.type === "final_answer") {
          logTimeline(`s1_iter_${iter}`, `final_answer (${data.durationMs}ms)`);
        }
      },
    });

    logTimeline("s1_done", `${Date.now() - s1Start}ms, status=${s1Result.status}, iters=${s1Result.iterations}`);

    // Assertions
    assert(s1Result.status === "completed", "S1: status is completed");
    assert(s1Result.iterations >= 3, `S1: multiple iterations needed (got: ${s1Result.iterations})`);

    // Check that the LLM actually found bugs — count "BUG" mentions in final answer
    const bugMentions = (s1Result.finalAnswer.match(/bug|fix|error|wrong|should be|instead of/gi) || []).length;
    assert(bugMentions >= 5, `S1: final answer discusses bugs found (got ${bugMentions} mentions)`);

    // Check some specific fixes
    const configContent = existsSync(join(s1Dir, "src", "config.js"))
      ? readFileSync(join(s1Dir, "src", "config.js"), "utf-8") : "";
    assert(configContent.includes("port: 3000") || configContent.includes("port:3000"),
      "S1-Bug1: config port fixed to number 3000");

    const cartContent = existsSync(join(s1Dir, "src", "models", "product.js"))
      ? readFileSync(join(s1Dir, "src", "models", "product.js"), "utf-8") : "";
    assert(cartContent.includes("item.product.price * item.qty") || cartContent.includes("price * qty"),
      "S1-Bug9: cart total includes qty multiplication");

    const toolCalls = s1Result.toolUsage.totalCalls;
    const toolErrors = s1Result.toolUsage.totalErrors;
    console.log(`  [info] Tool calls: ${toolCalls}, errors: ${toolErrors}`);
    console.log(`  [info] Iterations: ${s1Result.iterations}, Tokens: ${s1Result.usage.totalTokens}`);
    console.log(`  [info] Duration: ${Date.now() - s1Start}ms`);
    console.log(`  [info] Final answer (first 300 chars): ${s1Result.finalAnswer.slice(0, 300)}`);

  } catch (err) {
    console.log(`  [ERROR] S1 crashed: ${err.message}`);
    testState.failed++;
    testState.errors.push(`S1 crash: ${err.message}`);
  }
}
