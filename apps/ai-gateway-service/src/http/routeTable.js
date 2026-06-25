// =============================================================================
// routeTable.js — 轻量级声明式路由表
// 将 httpServer.js 的巨型 if/else 链逐步迁移为可维护的路由注册
// =============================================================================

/**
 * 创建路由表实例
 *
 * 用法:
 *   const table = createRouteTable();
 *   table.get("/health", handleHealth);
 *   table.post("/chat", handleChat);
 *   table.get(/^\/workforce\/plans\/([^/]+)$/, handlePlanDetail);
 *
 *   // 在 httpServer.js 中:
 *   const match = table.resolve(method, pathname);
 *   if (match) {
 *     await match.handler(req, res, { params: match.params });
 *     return;
 *   }
 */
export function createRouteTable() {
  /** @type {Array<{method: string, pattern: string|RegExp, handler: Function, meta: Object}>} */
  const routes = [];

  /**
   * 注册路由
   * @param {string} method - HTTP 方法 (GET/POST/DELETE/PUT/PATCH)
   * @param {string|RegExp} pattern - 路径模式(字符串精确匹配或正则)
   * @param {Function} handler - 处理函数 async (req, res, ctx) => void
   * @param {Object} [meta={}] - 元数据(public/permission/description)
   */
  function register(method, pattern, handler, meta = {}) {
    routes.push({ method: method.toUpperCase(), pattern, handler, meta });
  }

  /** GET 路由快捷方法 */
  function get(pattern, handler, meta) {
    register("GET", pattern, handler, meta);
  }

  /** POST 路由快捷方法 */
  function post(pattern, handler, meta) {
    register("POST", pattern, handler, meta);
  }

  /** DELETE 路由快捷方法 */
  function del(pattern, handler, meta) {
    register("DELETE", pattern, handler, meta);
  }

  /** PUT 路由快捷方法 */
  function put(pattern, handler, meta) {
    register("PUT", pattern, handler, meta);
  }

  /**
   * 解析请求,匹配路由
   * @param {string} method - HTTP 方法
   * @param {string} pathname - 请求路径
   * @returns {{handler: Function, params: Object, meta: Object}|null}
   */
  function resolve(method, pathname) {
    const upperMethod = method.toUpperCase();
    for (const route of routes) {
      if (route.method !== upperMethod) continue;

      if (typeof route.pattern === "string") {
        // 精确字符串匹配
        if (route.pattern === pathname) {
          return { handler: route.handler, params: {}, meta: route.meta };
        }
      } else if (route.pattern instanceof RegExp) {
        // 正则匹配,提取捕获组作为 params
        const match = pathname.match(route.pattern);
        if (match) {
          const params = {};
          // 将捕获组转为命名参数(如果有)或数字索引
          for (let i = 1; i < match.length; i++) {
            params[String(i)] = match[i];
          }
          return { handler: route.handler, params, meta: route.meta };
        }
      }
    }
    return null;
  }

  /**
   * 获取所有已注册路由(用于调试/文档生成)
   * @returns {Array<{method: string, pattern: string, description: string}>}
   */
  function list() {
    return routes.map((r) => ({
      method: r.method,
      pattern: r.pattern instanceof RegExp ? r.pattern.source : r.pattern,
      description: r.meta.description || "",
      public: r.meta.public || false,
      permission: r.meta.permission || null,
    }));
  }

  /**
   * 路由数量
   * @returns {number}
   */
  function count() {
    return routes.length;
  }

  return { register, get, post, del, put, resolve, list, count };
}
