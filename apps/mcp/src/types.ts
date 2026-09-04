// Authorization code đang chờ đổi token — giữ in-memory, TTL ngắn, mất khi restart (chấp nhận).
export interface PendingAuthCode {
  clientId: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number; // epoch ms
}

// Kết quả verify access token → nhét userId vào AuthInfo.extra cho tool handler.
export interface GrantIdentity {
  grantId: string;
  userId: string;
  clientId: string;
  accessExpiresAt: number; // epoch ms
}

export type IngestSource =
  | { kind: "url"; url: string }
  | { kind: "storage" }; // đường B: file đã có trong Storage theo path chuẩn

export interface Job {
  lessonId: string;
  userId: string;
  ownerId: string;
  source: IngestSource;
  startedAt: number;
}
