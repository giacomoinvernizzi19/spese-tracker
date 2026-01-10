import bcrypt from 'bcryptjs';
import type { AstroCookies } from 'astro';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

// Constants
const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_DAYS = 7;
const BCRYPT_ROUNDS = 10;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session management
export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function generateUserId(): string {
  return crypto.randomUUID();
}

export function getSessionExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_DURATION_DAYS);
  return date.toISOString();
}

// Create session in DB and set cookie
export async function createSession(
  db: D1Database,
  userId: string,
  cookies: AstroCookies
): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = getSessionExpiry();

  await db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(sessionId, userId, expiresAt).run();

  cookies.set(SESSION_COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: new Date(expiresAt)
  });

  return sessionId;
}

// Validate session and get user
export async function getAuthUser(
  cookies: AstroCookies,
  db: D1Database
): Promise<User | null> {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  // Get session and check expiry
  const session = await db.prepare(`
    SELECT s.*, u.id as user_id, u.email, u.name, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first<Session & User>();

  if (!session) {
    // Session expired or invalid, clear cookie
    cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
    return null;
  }

  return {
    id: session.user_id,
    email: session.email,
    name: session.name,
    created_at: session.created_at
  };
}

// Delete session (logout)
export async function deleteSession(
  cookies: AstroCookies,
  db: D1Database
): Promise<void> {
  const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }

  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

// Cleanup expired sessions (call periodically)
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}

// Create default categories for new user
export async function createDefaultCategories(db: D1Database, userId: string): Promise<void> {
  const defaultCategories = [
    { name: 'Spesa', icon: '🛒', color: '#22C55E' },
    { name: 'Ristoranti', icon: '🍕', color: '#F97316' },
    { name: 'Trasporti', icon: '🚗', color: '#3B82F6' },
    { name: 'Casa', icon: '🏠', color: '#8B5CF6' },
    { name: 'Salute', icon: '💊', color: '#EC4899' },
    { name: 'Bar', icon: '☕', color: '#F59E0B' },
    { name: 'Regali', icon: '🎁', color: '#EF4444' },
    { name: 'Viaggi', icon: '✈️', color: '#06B6D4' },
    { name: 'Abbonamenti', icon: '📱', color: '#6366F1' },
    { name: 'Sport', icon: '🏃', color: '#10B981' },
    { name: 'Shopping', icon: '👗', color: '#D946EF' },
    { name: 'Altro', icon: '📦', color: '#6B7280' }
  ];

  for (const cat of defaultCategories) {
    await db.prepare(`
      INSERT INTO categories (user_id, name, icon, color)
      VALUES (?, ?, ?, ?)
    `).bind(userId, cat.name, cat.icon, cat.color).run();
  }
}

// Validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: 'La password deve essere di almeno 6 caratteri' };
  }
  return { valid: true };
}

export function validateName(name: string): { valid: boolean; error?: string } {
  if (name.trim().length < 2) {
    return { valid: false, error: 'Il nome deve essere di almeno 2 caratteri' };
  }
  return { valid: true };
}

// Password reset helpers
const RESET_TOKEN_DURATION_HOURS = 1;

export function generateResetToken(): string {
  // Generate a long, secure token (two UUIDs concatenated)
  return crypto.randomUUID() + crypto.randomUUID();
}

export function getResetTokenExpiry(): string {
  const date = new Date();
  date.setHours(date.getHours() + RESET_TOKEN_DURATION_HOURS);
  return date.toISOString();
}
