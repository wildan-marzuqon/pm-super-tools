import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyCapability } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyCapability(request, 'manage_rbac');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const roles = await prisma.role.findMany({
      include: {
        capabilities: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(roles);
  } catch (error: any) {
    console.error('Error fetching roles:', error);
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
    const { name, description, capabilityIds } = body;

    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check if name already exists
    const existing = await prisma.role.findUnique({
      where: { name }
    });

    if (existing) {
      return NextResponse.json({ error: 'Role with this name already exists' }, { status: 400 });
    }

    // Create role
    const newRole = await prisma.role.create({
      data: {
        name,
        description: description || ''
      }
    });

    // Create capability mappings
    if (Array.isArray(capabilityIds) && capabilityIds.length > 0) {
      await Promise.all(
        capabilityIds.map(capId =>
          prisma.roleCapability.create({
            data: {
              roleId: newRole.id,
              capabilityId: capId
            }
          })
        )
      );
    }

    return NextResponse.json(newRole, { status: 201 });
  } catch (error: any) {
    console.error('Error creating role:', error);
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
    const { roleId, description, capabilityIds } = body;

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
    }

    // Update role description
    await prisma.role.update({
      where: { id: roleId },
      data: {
        description: description !== undefined ? description : undefined
      }
    });

    // Update capability mappings if capabilityIds is provided
    if (Array.isArray(capabilityIds)) {
      // 1. Delete existing
      await prisma.roleCapability.deleteMany({
        where: { roleId }
      });

      // 2. Create new
      if (capabilityIds.length > 0) {
        await Promise.all(
          capabilityIds.map(capId =>
            prisma.roleCapability.create({
              data: {
                roleId,
                capabilityId: capId
              }
            })
          )
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating role:', error);
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
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
    }

    // Do not delete default roles
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (role && ['Super Admin', 'PM', 'Developer', 'Viewer'].includes(role.name)) {
      return NextResponse.json({ error: 'Cannot delete system default roles' }, { status: 400 });
    }

    await prisma.role.delete({
      where: { id: roleId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
