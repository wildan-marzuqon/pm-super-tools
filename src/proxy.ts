import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-pm-tools-key-123';

// Helper to verify JWT using Web Crypto API (Edge compatible)
async function verifyJwtEdge(token: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const base64UrlDecode = (str: string) => {
      let output = str.replace(/-/g, '+').replace(/_/g, '/');
      switch (output.length % 4) {
        case 0:
          break;
        case 2:
          output += '==';
          break;
        case 3:
          output += '=';
          break;
        default:
          throw new Error('Illegal base64url string!');
      }
      return atob(output);
    };

    // Decode payload
    const payloadStr = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    // Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    
    // Decode signature
    const signatureStr = base64UrlDecode(signatureB64);
    const signatureBin = Uint8Array.from(
      signatureStr,
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBin,
      data
    );

    return isValid ? payload : null;
  } catch (error) {
    console.error('JWT Edge verification failed:', error);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Bypass public paths
  const isPublicPath = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/unauthorized') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/telegram-webhook') || // Telegram webhook is public
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 2. Read token
  const token = request.cookies.get('auth_token')?.value;

  // 3. Verify token
  const decoded = token ? await verifyJwtEdge(token) : null;

  // 4. Redirect if not authenticated
  if (!decoded) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 5. If authenticated and trying to access login, redirect to home
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (some endpoints might be excluded manually)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
