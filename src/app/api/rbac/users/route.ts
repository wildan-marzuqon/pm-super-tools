import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        roles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Format output
    const formatted = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      roles: u.roles.map(r => ({ id: r.role.id, name: r.role.name }))
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { name, email, password, roleIds } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword
      }
    });

    // Map roles
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      await Promise.all(
        roleIds.map(roleId =>
          prisma.userRole.create({
            data: {
              userId: newUser.id,
              roleId
            }
          })
        )
      );
    }

    return NextResponse.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { userId, name, email, password, roleIds } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if user exists
    const userObj = await prisma.user.findUnique({ where: { id: userId } });
    if (!userObj) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Don't let users edit admin@pmtools.com email to prevent locking out
    if (userObj.email === 'admin@pmtools.com' && email && email.toLowerCase().trim() !== 'admin@pmtools.com') {
      return NextResponse.json({ error: 'Cannot modify email of default administrator' }, { status: 400 });
    }

    // Hash new password if provided
    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Update user fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        email: email ? email.toLowerCase().trim() : undefined,
        password: hashedPassword
      }
    });

    // Update roles mapping if roleIds is provided
    if (Array.isArray(roleIds)) {
      // 1. Delete existing UserRoles mapping
      await prisma.userRole.deleteMany({
        where: { userId }
      });

      // 2. Create new UserRoles mapping
      if (roleIds.length > 0) {
        await Promise.all(
          roleIds.map(roleId =>
            prisma.userRole.create({
              data: {
                userId,
                roleId
              }
            })
          )
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting self
    if (auth.user?.id === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (targetUser && targetUser.email === 'admin@pmtools.com') {
      return NextResponse.json({ error: 'Cannot delete system default administrator account' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
