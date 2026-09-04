#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { generateOpenApiSpec } from "../apps/ai-gateway-service/src/http/openApiGenerator.js";

// The governance operations are canonical static contracts installed by the
// existing generator. No gateway runtime, provider, credential, or governance
// data access is needed to produce this machine-readable artifact.
const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const spec = generateOpenApiSpec([], {
  title: "Unified AI System Agent Governance API",
  version: String(packageMetadata.version),
});

process.stdout.write(`${JSON.stringify(spec, null, 2)}\n`);
