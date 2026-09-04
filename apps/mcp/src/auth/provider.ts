import type { Response } from "express";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  clientsStore,
  consumeAuthCode,
  createGrant,
  peekAuthCode,
  revokeByToken,
  rotateGrant,
  verifyAccess,
} from "./store.js";

// Custom OAuthServerProvider (skeleton drive-automation-mcp). Login page dán pairing code
// thay cho credential bền: authorize → /login → validate code → phát authorization code.
export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Chưa biết user là ai → chuyển tới login page mang theo tham số OAuth (PKCE, redirect, state).
    const q = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
    });
    if (params.state) q.set("state", params.state);
    res.redirect(`/login?${q.toString()}`);
  },

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const p = peekAuthCode(authorizationCode);
    if (!p || p.clientId !== client.client_id) throw new InvalidGrantError("invalid authorization code");
    return p.codeChallenge;
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const p = consumeAuthCode(authorizationCode);
    if (!p || p.clientId !== client.client_id) throw new InvalidGrantError("invalid authorization code");
    if (redirectUri && redirectUri !== p.redirectUri) throw new InvalidGrantError("redirect_uri mismatch");
    const tokens = await createGrant({
      userId: p.userId,
      clientId: client.client_id,
      deviceLabel: client.client_name,
    });
    return {
      access_token: tokens.access_token,
      token_type: "Bearer",
      expires_in: tokens.expires_in,
      refresh_token: tokens.refresh_token,
    };
  },

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const rot = await rotateGrant(refreshToken);
    if (!rot || rot.clientId !== client.client_id) throw new InvalidGrantError("invalid refresh token");
    return {
      access_token: rot.access_token,
      token_type: "Bearer",
      expires_in: rot.expires_in,
      refresh_token: rot.refresh_token,
    };
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const g = await verifyAccess(token);
    if (!g) throw new InvalidTokenError("invalid or expired token");
    return {
      token,
      clientId: g.clientId,
      scopes: [],
      expiresAt: Math.floor(g.accessExpiresAt / 1000),
      extra: { userId: g.userId },
    };
  },

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    await revokeByToken(request.token);
  },
};
