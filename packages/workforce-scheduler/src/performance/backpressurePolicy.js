export const backpressurePolicy = Object.freeze({
  enabled: true,
  strategy: "queue_then_fallback_preview",
  rejectWhenQueueFull: true,
});

