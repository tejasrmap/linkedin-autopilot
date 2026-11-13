// ==============================================================
// LINKEDIN AUTOPILOT - SUPPORT & FEEDBACK API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const TicketSchema = z.object({
  category: z.enum(['publishing', 'ai_generation', 'scheduling', 'accounts', 'billing', 'general']),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(3000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
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

  return NextResponse.json({ tickets: tickets || [] });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
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


export async function PATCH(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { ticketId, status } = await request.json();
    if (!ticketId || !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid ticket id or status' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .eq('workspace_id', auth.workspaceId)
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
