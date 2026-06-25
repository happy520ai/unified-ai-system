/**
 * Agentic Stream Handler — SSE 流式输出处理
 *
 * 将 agenticCodingLoop 的 executeStream 事件转为 HTTP SSE 流。
 *
 * @module agenticStreamHandler
 */

/**
 * 处理 agentic loop 的 SSE 流式输出。
 *
 * @param {import("node:http").ServerResponse} res
 * @param {Object} agenticLoop - createAgenticLoop 的返回值
 * @param {Object} input - execute 输入参数
 * @returns {Promise<void>}
 */
export async function handleAgenticStream(res, agenticLoop, input) {
  // Set SSE headers
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "x-accel-buffering": "no",
    "x-content-type-options": "nosniff",
  });

  // Track client disconnect
  let clientDisconnected = false;
  res.on("close", () => {
    clientDisconnected = true;
  });

  try {
    for await (const event of agenticLoop.executeStream(input)) {
      if (clientDisconnected) {
        break;
      }

      writeSseEvent(res, event.type, event);

      // Flush for real-time delivery
      if (typeof res.flush === "function") {
        res.flush();
      }
    }

    if (!clientDisconnected) {
      res.end();
    }
  } catch (error) {
    if (!clientDisconnected) {
      writeSseEvent(res, "error", {
        type: "error",
        code: error?.code || "AGENTIC_STREAM_ERROR",
        message: error instanceof Error ? error.message : "Agentic stream failed.",
        recoverable: false,
      });
      res.end();
    }
  }
}

/**
 * 写一个 SSE 事件到响应流。
 *
 * @param {import("node:http").ServerResponse} res
 * @param {string} eventName
 * @param {Object} data
 */
function writeSseEvent(res, eventName, data) {
  if (res.writableEnded || res.destroyed) return;
  const payload = JSON.stringify(data);
  res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
}

/**
 * 处理 agentic loop 的非流式 HTTP 请求。
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {Object} agenticLoop
 * @param {Object} input
 * @returns {Promise<void>}
 */
export async function handleAgenticRequest(req, res, agenticLoop, input) {
  try {
    const result = await agenticLoop.execute(input);

    const statusCode = result.status === "error" ? 500 : 200;
    res.writeHead(statusCode, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({
      status: "error",
      error: {
        code: error?.code || "AGENTIC_REQUEST_ERROR",
        message: error instanceof Error ? error.message : "Agentic request failed.",
      },
    }));
  }
}
