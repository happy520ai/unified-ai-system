// =============================================================================
// swaggerUi.js — 内嵌 Swagger UI 页面（无外部 CDN 依赖）
// =============================================================================

/**
 * 生成 Swagger UI HTML 页面
 * @param {Object} spec - OpenAPI 3.0 spec
 * @returns {string} HTML
 */
export function createSwaggerUiPage(spec) {
  const specJson = JSON.stringify(spec);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Gateway API 文档</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
    .header h1 { font-size: 1.5rem; }
    .header p { opacity: 0.7; margin-top: 8px; }
    .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
    .endpoint { background: white; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .endpoint-header { padding: 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .endpoint-header:hover { background: #f8f9fa; }
    .method { padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.85rem; min-width: 60px; text-align: center; }
    .method-get { background: #61affe; color: white; }
    .method-post { background: #49cc90; color: white; }
    .method-put { background: #fca130; color: white; }
    .method-delete { background: #f93e3e; color: white; }
    .path { font-family: monospace; font-size: 0.95rem; }
    .description { color: #666; font-size: 0.9rem; margin-left: auto; }
    .badge-public { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    .badge-auth { background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    .stats { display: flex; gap: 20px; justify-content: center; padding: 20px; }
    .stat { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #1a1a2e; }
    .stat-label { color: #666; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 AI Gateway API 文档</h1>
    <p>自动生成于路由模块元数据 | OpenAPI 3.0</p>
  </div>
  <div class="stats" id="stats"></div>
  <div class="container" id="endpoints"></div>
  <script>
    const spec = ${specJson};
    const paths = spec.paths || {};
    let totalEndpoints = 0;
    let publicEndpoints = 0;
    let authEndpoints = 0;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods)) {
        totalEndpoints++;
        const isPublic = !op.security || op.security.length === 0;
        if (isPublic) publicEndpoints++; else authEndpoints++;
      }
    }

    document.getElementById('stats').innerHTML = \`
      <div class="stat"><div class="stat-value">\${totalEndpoints}</div><div class="stat-label">总端点数</div></div>
      <div class="stat"><div class="stat-value">\${publicEndpoints}</div><div class="stat-label">公开端点</div></div>
      <div class="stat"><div class="stat-value">\${authEndpoints}</div><div class="stat-label">需认证端点</div></div>
    \`;

    const container = document.getElementById('endpoints');
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const div = document.createElement('div');
        div.className = 'endpoint';
        const isPublic = !op.security || op.security.length === 0;
        div.innerHTML = \`
          <div class="endpoint-header">
            <span class="method method-\${method}">\${method.toUpperCase()}</span>
            <span class="path">\${path}</span>
            <span class="description">\${op.summary || ''}</span>
            <span class="\${isPublic ? 'badge-public' : 'badge-auth'}">\${isPublic ? '公开' : '需认证'}</span>
          </div>
        \`;
        container.appendChild(div);
      }
    }
  </script>
</body>
</html>`;
}
