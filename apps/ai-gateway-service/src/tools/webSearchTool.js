/**
 * Web Search Tool — 网络搜索工具
 *
 * 支持多种搜索后端:
 * - DuckDuckGo HTML (默认, 无需 API Key)
 * - Brave Search API (BRAVE_SEARCH_API_KEY)
 * - Tavily API (TAVILY_API_KEY)
 * - SerpAPI (SERPAPI_API_KEY)
 *
 * @module webSearchTool
 */

import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 创建 web_search 工具定义。
 *
 * @param {Object} [options]
 * @param {string} [options.searchProvider] - 搜索引擎选择
 * @param {string} [options.braveApiKey]
 * @param {string} [options.tavilyApiKey]
 * @param {string} [options.serpApiKey]
 * @returns {Object} buildTool 格式的工具定义
 */
export function createWebSearchTool(options = {}) {
  const provider = options.searchProvider
    || (options.braveApiKey || process.env.BRAVE_SEARCH_API_KEY ? "brave" : null)
    || (options.tavilyApiKey || process.env.TAVILY_API_KEY ? "tavily" : null)
    || (options.serpApiKey || process.env.SERPAPI_API_KEY ? "serpapi" : null)
    || "duckduckgo";

  return buildTool({
    name: "web_search",
    description: "Search the web for up-to-date information, documentation, API references, tutorials, and more. Returns titles, URLs, and snippets.",
    inputSchema: createInputSchema({
      query: {
        type: "string",
        description: "The search query. Be specific and include relevant keywords.",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of results to return (1-10, default 5).",
        minimum: 1,
        maximum: 10,
      },
      timeRange: {
        type: "string",
        description: "Time filter: 'day', 'week', 'month', 'year', or 'all' (default 'all').",
        enum: ["day", "week", "month", "year", "all"],
      },
    }, ["query"]),

    requiredPermissions: ["network:search"],
    isReadOnly: true,
    maxResultSizeChars: 100_000,

    async execute(params) {
      const query = params.query?.trim();
      if (!query) {
        return { success: false, error: "Search query is required." };
      }

      const maxResults = Math.min(Math.max(params.maxResults || DEFAULT_MAX_RESULTS, 1), 10);
      const timeRange = params.timeRange || "all";

      switch (provider) {
        case "brave":
          return searchBrave(query, maxResults, timeRange, options.braveApiKey || process.env.BRAVE_SEARCH_API_KEY);
        case "tavily":
          return searchTavily(query, maxResults, options.tavilyApiKey || process.env.TAVILY_API_KEY);
        case "serpapi":
          return searchSerpApi(query, maxResults, timeRange, options.serpApiKey || process.env.SERPAPI_API_KEY);
        case "duckduckgo":
        default:
          return searchDuckDuckGo(query, maxResults, timeRange);
      }
    },
  });
}

// ============================================================
// DuckDuckGo HTML Search (无需 API Key)
// ============================================================

async function searchDuckDuckGo(query, maxResults, timeRange) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PME-Agent/1.0)",
        "accept": "text/html",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `DuckDuckGo returned HTTP ${response.status}`, provider: "duckduckgo" };
    }

    const html = await response.text();
    const results = parseDuckDuckGoHtml(html, maxResults);

    return {
      success: true,
      provider: "duckduckgo",
      query,
      resultCount: results.length,
      results,
    };
  } catch (error) {
    return {
      success: false,
      provider: "duckduckgo",
      error: error?.name === "AbortError" ? "Search timed out." : error.message,
    };
  }
}

/**
 * 简单 HTML 解析提取 DuckDuckGo 搜索结果。
 * 提取 <a class="result__a"> 标签中的标题和链接。
 */
function parseDuckDuckGoHtml(html, maxResults) {
  const results = [];
  let match;

  // Strategy 1: Standard result__a + result__snippet (primary layout)
  const primaryPattern = new RegExp('<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>[sS]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>|<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</span>)', "gi");
  while ((match = primaryPattern.exec(html)) !== null && results.length < maxResults) {
    const url = decodeDuckDuckGoUrl(match[1]);
    const title = stripHtmlTags(match[2]);
    const snippet = stripHtmlTags(match[3] || match[4] || "");
    if (url && title && !isDuplicate(results, url)) {
      results.push({ title, url, snippet });
    }
  }

  // Strategy 2: Any <a> with result__a class (title-only fallback)
  if (results.length === 0) {
    const titlePattern = new RegExp('<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', "gi");
    while ((match = titlePattern.exec(html)) !== null && results.length < maxResults) {
      const url = decodeDuckDuckGoUrl(match[1]);
      const title = stripHtmlTags(match[2]);
      if (url && title && !isDuplicate(results, url)) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  // Strategy 3: Generic link extraction for layout changes
  if (results.length === 0) {
    const genericPattern = new RegExp('<a[^>]*href="([^"]*(?:uddg=|http)[^"]*)"[^>]*>([^<]{10,})</a>', "gi");
    while ((match = genericPattern.exec(html)) !== null && results.length < maxResults) {
      const url = decodeDuckDuckGoUrl(match[1]);
      const title = stripHtmlTags(match[2]);
      if (url && title && !url.includes("duckduckgo.com/") && !isDuplicate(results, url) && title.length > 5) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}

/**
 * Check if a URL is already in the results list.
 */
function isDuplicate(results, url) {
  return results.some((r) => r.url === url);
}

function decodeDuckDuckGoUrl(url) {
  if (!url || typeof url !== "string") return "";
  if (url.includes("uddg=")) {
    try {
      const uddg = url.match(/uddg=([^&]+)/)?.[1];
      return uddg ? decodeURIComponent(uddg) : url;
    } catch {
      return url;
    }
  }
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

// ============================================================
// Brave Search API
// ============================================================

async function searchBrave(query, maxResults, timeRange, apiKey) {
  if (!apiKey) {
    return { success: false, error: "BRAVE_SEARCH_API_KEY is not configured.", provider: "brave" };
  }

  const params = new URLSearchParams({ q: query, count: String(maxResults) });
  if (timeRange !== "all") {
    params.set("freshness", timeRange === "day" ? "pd" : timeRange === "week" ? "pw" : timeRange === "month" ? "pm" : "py");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        "accept": "application/json",
        "x-subscription-token": apiKey,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `Brave Search returned HTTP ${response.status}`, provider: "brave" };
    }

    const data = await response.json();
    const results = (data?.web?.results || []).slice(0, maxResults).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
    }));

    return { success: true, provider: "brave", query, resultCount: results.length, results };
  } catch (error) {
    return { success: false, provider: "brave", error: error.message };
  }
}

// ============================================================
// Tavily API
// ============================================================

async function searchTavily(query, maxResults, apiKey) {
  if (!apiKey) {
    return { success: false, error: "TAVILY_API_KEY is not configured.", provider: "tavily" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `Tavily returned HTTP ${response.status}`, provider: "tavily" };
    }

    const data = await response.json();
    const results = (data?.results || []).slice(0, maxResults).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || "",
    }));

    return {
      success: true,
      provider: "tavily",
      query,
      resultCount: results.length,
      results,
      answer: data?.answer || null,
    };
  } catch (error) {
    return { success: false, provider: "tavily", error: error.message };
  }
}

// ============================================================
// SerpAPI
// ============================================================

async function searchSerpApi(query, maxResults, timeRange, apiKey) {
  if (!apiKey) {
    return { success: false, error: "SERPAPI_API_KEY is not configured.", provider: "serpapi" };
  }

  const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: "google",
    num: String(maxResults),
  });

  if (timeRange !== "all") {
    params.set("tbs", timeRange === "day" ? "qdr:d" : timeRange === "week" ? "qdr:w" : timeRange === "month" ? "qdr:m" : "qdr:y");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `SerpAPI returned HTTP ${response.status}`, provider: "serpapi" };
    }

    const data = await response.json();
    const results = (data?.organic_results || []).slice(0, maxResults).map((r) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
    }));

    return { success: true, provider: "serpapi", query, resultCount: results.length, results };
  } catch (error) {
    return { success: false, provider: "serpapi", error: error.message };
  }
}

// ============================================================
// Utilities
// ============================================================

function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
