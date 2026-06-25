// =============================================================================
// openApiGenerator.js — 从路由模块元数据生成 OpenAPI 3.0 spec
// =============================================================================

/**
 * 从路由模块元数据生成 OpenAPI 3.0 spec
 * @param {Array<Map>} routeModules - 路由模块 handlers 数组
 * @param {Object} options - { title, version, description, serverUrl }
 * @returns {Object} OpenAPI 3.0 spec
 */
export function generateOpenApiSpec(routeModules, options = {}) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: options.title ?? "AI Gateway API",
      version: options.version ?? "0.1.0",
      description: options.description ?? "Unified AI System Gateway API",
    },
    servers: [
      { url: options.serverUrl ?? "http://127.0.0.1:3100", description: "Local" },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };

  for (const handlers of routeModules) {
    if (!handlers || typeof handlers.forEach !== "function") continue;
    handlers.forEach?.((routeDef, key) => {
      if (!key || typeof key !== "string") return;
      const [method, path] = key.split(" ");
      if (!method || !path) return;

      const httpMethod = method.toLowerCase();
      const openApiPath = path.replace(/:([a-zA-Z_]+)/g, "{$1}");

      if (!spec.paths[openApiPath]) {
        spec.paths[openApiPath] = {};
      }

      spec.paths[openApiPath][httpMethod] = {
        summary: routeDef.description ?? key,
        operationId: key.replace(/[^a-zA-Z0-9]/g, "_"),
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          "400": { description: "请求参数错误" },
          "500": { description: "服务器内部错误" },
        },
      };

      if (!routeDef.public) {
        spec.paths[openApiPath][httpMethod].security = [{ bearerAuth: [] }];
      }
    });
  }

  return spec;
}
