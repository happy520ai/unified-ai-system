// =============================================================================
// oauth2Provider.js — OAuth2/OIDC SSO 集成
// 支持 Google/GitHub/Microsoft 登录
// =============================================================================

export function createOAuth2Provider(options = {}) {
  const providers = new Map();

  function registerProvider(name, config) {
    providers.set(name, {
      name,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationUrl: config.authorizationUrl,
      tokenUrl: config.tokenUrl,
      userInfoUrl: config.userInfoUrl,
      scopes: config.scopes ?? ["openid", "email", "profile"],
      redirectUri: config.redirectUri,
    });
  }

  // 内置 Provider 配置模板
  const TEMPLATES = {
    google: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
      scopes: ["openid", "email", "profile"],
    },
    github: {
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scopes: ["user:email"],
    },
    microsoft: {
      authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      userInfoUrl: "https://graph.microsoft.com/v1.0/me",
      scopes: ["openid", "email", "profile"],
    },
  };

  function registerFromTemplate(name, clientId, clientSecret, redirectUri) {
    const template = TEMPLATES[name];
    if (!template) throw new Error(`Unknown OAuth provider: ${name}`);
    registerProvider(name, { ...template, clientId, clientSecret, redirectUri });
  }

  function getAuthorizationUrl(providerName, state) {
    const p = providers.get(providerName);
    if (!p) throw new Error(`Provider not registered: ${providerName}`);
    const params = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: p.redirectUri,
      response_type: "code",
      scope: p.scopes.join(" "),
      state: state ?? randomUUID(),
    });
    return `${p.authorizationUrl}?${params}`;
  }

  async function exchangeCode(providerName, code) {
    const p = providers.get(providerName);
    if (!p) throw new Error(`Provider not registered: ${providerName}`);

    const resp = await fetch(p.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: p.clientId,
        client_secret: p.clientSecret,
        code,
        redirect_uri: p.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status}`);
    const data = await resp.json();
    return { accessToken: data.access_token, tokenType: data.token_type, expiresIn: data.expires_in };
  }

  async function getUserInfo(providerName, accessToken) {
    const p = providers.get(providerName);
    if (!p) throw new Error(`Provider not registered: ${providerName}`);

    const resp = await fetch(p.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) throw new Error(`UserInfo failed: ${resp.status}`);
    const data = await resp.json();

    return {
      provider: providerName,
      providerUserId: data.id ?? data.sub ?? data.login,
      email: data.email,
      name: data.name ?? data.login,
      avatarUrl: data.avatar_url ?? data.picture,
      raw: data,
    };
  }

  function getRegisteredProviders() {
    return Array.from(providers.values()).map((p) => ({
      name: p.name,
      scopes: p.scopes,
      redirectUri: p.redirectUri,
    }));
  }

  return { registerProvider, registerFromTemplate, getAuthorizationUrl, exchangeCode, getUserInfo, getRegisteredProviders };
}

function randomUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
