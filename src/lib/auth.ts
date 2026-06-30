import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-pm-tools-key-123';
const COOKIE_NAME = 'auth_token';

export interface UserSessionPayload {
  userId: string;
  email: string;
  name: string;
}

export function signToken(payload: UserSessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSessionPayload;
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Fetch user with roles and capabilities
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              capabilities: true
            }
          }
        }
      }
    }
  });

  if (!user) return null;

  const capabilities = new Set<string>();
  user.roles.forEach(ur => {
    ur.role.capabilities.forEach(rc => {
      capabilities.add(rc.capabilityId);
    });
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.map(ur => ur.role.name),
    capabilities: Array.from(capabilities)
  };
}

export async function verifyCapability(request: NextRequest, capabilityName: string) {
  const user = await getCurrentUser(request);
  if (!user) {
    return { user: null, authorized: false, status: 401, error: 'Unauthorized' };
  }

  // Super Admin has all capabilities
  if (user.roles.includes('Super Admin') || user.capabilities.includes(capabilityName)) {
    return { user, authorized: true };
  }

  return { user, authorized: false, status: 403, error: 'Forbidden' };
}
