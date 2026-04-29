import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateToken,
  hashToken,
} from "../lib/crypto";
import { config } from "../config/env";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

// Helpers

async function exchangeCodeWithGitHub(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<{ access_token: string }> {
  const params: Record<string, string> = {
    client_id: config.github.clientId,
    client_secret: config.github.clientSecret,
    code,
    redirect_uri: redirectUri,
  };
  if (codeVerifier) params.code_verifier = codeVerifier;

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error ?? "GitHub token exchange failed");
  }
  return { access_token: data.access_token };
}

async function getGitHubUser(ghToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${ghToken}`,
      "User-Agent": "InsightaLabs",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch GitHub user");
  return res.json() as Promise<{
    id: number;
    login: string;
    email: string | null;
    avatar_url: string;
  }>;
}

async function createSession(userId: string, clientType: string) {
  const rawAccess = generateToken();
  const rawRefresh = generateToken();

  const now = new Date();
  const accessExpiry = new Date(now.getTime() + config.tokens.accessExpiryMs);
  const refreshExpiry = new Date(now.getTime() + config.tokens.refreshExpiryMs);

  await prisma.session.create({
    data: {
      user_id: userId,
      access_token: hashToken(rawAccess),
      refresh_token: hashToken(rawRefresh),
      access_expiry: accessExpiry,
      refresh_expiry: refreshExpiry,
      client_type: clientType,
    },
  });

  return { access_token: rawAccess, refresh_token: rawRefresh };
}

async function upsertUser(ghUser: {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}) {
  return prisma.user.upsert({
    where: { github_id: String(ghUser.id) },
    create: {
      github_id: String(ghUser.id),
      username: ghUser.login,
      email: ghUser.email,
      avatar_url: ghUser.avatar_url,
      last_login_at: new Date(),
    },
    update: {
      username: ghUser.login,
      email: ghUser.email,
      avatar_url: ghUser.avatar_url,
      last_login_at: new Date(),
    },
  });
}

function setWebCookies(
  res: Response,
  access_token: string,
  refresh_token: string,
) {
  const isProduction = config.nodeEnv === "production";

  const opts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
  };

  res.cookie("access_token", access_token, {
    ...opts,
    maxAge: config.tokens.accessExpiryMs,
  });
  res.cookie("refresh_token", refresh_token, {
    ...opts,
    maxAge: config.tokens.refreshExpiryMs,
  });
}

function clearWebCookies(res: Response) {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token");
}

// Expose GitHub client config (public)
export function getAuthConfig(_req: Request, res: Response) {
  res.json({
    github_client_id: config.github.clientId,
    cli_redirect_uri: config.github.callbackUrlCLI,
  });
}

export function getCsrfToken(
  req: Request & { csrfToken?: string },
  res: Response,
) {
  res.json({ status: "success", csrf_token: req.csrfToken });
}

// WEB FLOW

// GET /auth/github  — Initiates GitHub OAuth for web
export async function initiateWebOAuth(_req: Request, res: Response) {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await prisma.oAuthState.create({
    data: {
      state,
      code_verifier: codeVerifier,
      client_type: "web",
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrlWeb,
    scope: "read:user user:email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// GET /auth/github/callback  — Web OAuth callback
export async function handleWebCallback(req: Request, res: Response) {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code || !state) {
    res.status(400).json({ status: "error", message: "Missing code or state" });
    return;
  }

  const oauthState = await prisma.oAuthState.findUnique({ where: { state } });
  if (
    !oauthState ||
    oauthState.client_type !== "web" ||
    oauthState.expires_at < new Date()
  ) {
    res
      .status(400)
      .json({ status: "error", message: "Invalid or expired state" });
    return;
  }

  // Delete used state (one-time use)
  await prisma.oAuthState.delete({ where: { state } });

  let ghToken: string;
  try {
    const result = await exchangeCodeWithGitHub(
      code,
      config.github.callbackUrlWeb,
      oauthState.code_verifier,
    );
    ghToken = result.access_token;
  } catch {
    res
      .status(502)
      .json({ status: "error", message: "GitHub OAuth exchange failed" });
    return;
  }

  const ghUser = await getGitHubUser(ghToken);
  const user = await upsertUser(ghUser);
  const tokens = await createSession(user.id, "web");

  res.redirect(
    `${config.frontendUrl}/api/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`,
  );
}

// CLI FLOW

// POST /auth/cli/exchange — CLI sends code + code_verifier, gets tokens as JSON
export async function handleCliExchange(req: Request, res: Response) {
  const { code, code_verifier } = req.body as {
    code?: string;
    code_verifier?: string;
  };

  if (!code || !code_verifier) {
    res.status(400).json({
      status: "error",
      message: "code and code_verifier are required",
    });
    return;
  }

  let ghToken: string;
  try {
    const result = await exchangeCodeWithGitHub(
      code,
      config.github.callbackUrlCLI,
      code_verifier,
    );
    ghToken = result.access_token;
  } catch {
    res
      .status(401)
      .json({ status: "error", message: "GitHub OAuth exchange failed" });
    return;
  }

  const ghUser = await getGitHubUser(ghToken);
  const user = await upsertUser(ghUser);
  const tokens = await createSession(user.id, "cli");

  res.json({
    status: "success",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    username: user.username,
    role: user.role,
  });
}

// SHARED

// POST /auth/refresh
export async function refreshToken(req: Request, res: Response) {
  // Accept from body (CLI) or cookie (web)
  const rawRefresh: string | undefined =
    req.body?.refresh_token ?? req.cookies?.refresh_token;

  if (!rawRefresh) {
    res
      .status(400)
      .json({ status: "error", message: "refresh_token is required" });
    return;
  }

  const hashed = hashToken(rawRefresh);
  const session = await prisma.session.findUnique({
    where: { refresh_token: hashed },
  });

  if (!session || session.revoked_at) {
    res.status(401).json({ status: "error", message: "Invalid refresh token" });
    return;
  }

  if (session.refresh_expiry < new Date()) {
    res.status(401).json({ status: "error", message: "Refresh token expired" });
    return;
  }

  // Revoke old session
  await prisma.session.update({
    where: { id: session.id },
    data: { revoked_at: new Date() },
  });

  // Issue new token pair
  const newTokens = await createSession(session.user_id, session.client_type);

  if (session.client_type === "web") {
    setWebCookies(res, newTokens.access_token, newTokens.refresh_token);
    res.json({ status: "success" });
  } else {
    res.json({
      status: "success",
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
    });
  }
}

// POST /auth/logout
export async function logout(req: AuthenticatedRequest, res: Response) {
  if (req.sessionId) {
    await prisma.session.update({
      where: { id: req.sessionId },
      data: { revoked_at: new Date() },
    });
  }

  clearWebCookies(res);
  res.json({ status: "success", message: "Logged out successfully" });
}

// GET /auth/me or /auth/users/me
export async function getMe(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      email: true,
      avatar_url: true,
      role: true,
      is_active: true,
      last_login_at: true,
      created_at: true,
    },
  });
  res.json({ status: "success", data: user });
}
