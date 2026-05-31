export const securityCopy = {
  title: "安全边界",
  summary: "本屏只生成预案，不消耗模型额度，也不触碰密钥。",
  lines: [
    "不读取密钥",
    "不调用 Provider",
    "不部署",
    "不改默认 /chat"
  ],
  legacyPlainLanguage: [
    "不会读取密钥",
    "不会调用真实模型",
    "不会部署",
    "不会改变默认聊天链路"
  ],
  plainLanguage: [
    "你可以先看系统准备怎么做。",
    "确认前不会进入真实执行。",
    "Provider、Evidence、Diagnostics 默认折叠。"
  ]
};
