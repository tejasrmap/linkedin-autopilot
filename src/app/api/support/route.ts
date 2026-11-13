// ==============================================================
// LINKEDIN AUTOPILOT - SUPPORT & FEEDBACK API
// TENANT ISOLATION & ROLE-BASED ACCESS CONTROL
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const TicketSchema = z.object({
  category: z.enum(['publishing', 'ai_generation', 'scheduling', 'accounts', 'billing', 'general']),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(3000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');

  const admin = createAdminClient();

  // If requesting platform-wide tickets, user MUST be a verified platform superadmin
  if (scope === 'all') {
    if (!auth.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. Cross-tenant ticket access requires platform superadmin privileges.' },
        { status: 403 }
      );
    }

    const { data: allTickets, error } = await admin
      .from('support_tickets')
      .select(`
        id,
        category,
        subject,
        message,
        priority,
        status,
        created_at,
        workspace_id,
        user_id,
        profile:profiles(full_name, email),
        workspace:workspaces(name, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tickets: allTickets || [], scope: 'platform' });
  }

  // Standard tenant-isolated ticket list
  const { data: tickets, error } = await admin
    .from('support_tickets')
    .select(`
      id,
      category,
      subject,
      message,
      priority,
      status,
      created_at,
      user_id,
      profile:profiles(full_name, email)
    `)
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tickets: tickets || [], scope: 'workspace' });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Abuse prevention rate limit: 5 tickets per 5 minutes per user
  const rateLimitKey = `support_ticket:${auth.user.id}`;
  const rate = checkRateLimit(rateLimitKey, { limit: 5, windowMs: 5 * 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: 'Too many tickets submitted. Please wait before creating another request.',
        retryAfterMs: rate.resetMs,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const validated = TicketSchema.parse(body);

    const admin = createAdminClient();
    const { data: ticket, error } = await admin
      .from('support_tickets')
      .insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        category: validated.category,
        subject: validated.subject.trim(),
        message: validated.message.trim(),
        priority: validated.priority,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert user notification
    await admin.from('notifications').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
      title: 'Support Request Received 🎫',
      message: `Your ticket "${validated.subject.slice(0, 40)}..." has been logged with GT InnoX engineering support.`,
      type: 'info',
    });

    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { ticketId, status } = await req.json();
    if (!ticketId || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid ticket id or status' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check existing ticket
    const { data: existingTicket } = await admin
      .from('support_tickets')
      .select('id, workspace_id')
      .eq('id', ticketId)
      .maybeSingle();

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Authorization evaluation:
    // 1. Platform superadmin can update any ticket
    // 2. Workspace Owner/Admin can update tickets within their workspace
    // 3. Unauthorized callers (editors, viewers, foreign tenant owners) are blocked
    const isTenantAdmin =
      existingTicket.workspace_id === auth.workspaceId &&
      (auth.role === 'owner' || auth.role === 'admin');

    if (!auth.isPlatformAdmin && !isTenantAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. You do not have permissions to modify this ticket.' },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, ticket: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
