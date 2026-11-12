import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const TemplateSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(5),
  category: z.string().default('General'),
});

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: templates, error } = await admin
    .from('content_templates')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = TemplateSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: template, error } = await admin
      .from('content_templates')
      .insert({
        workspace_id: auth.workspaceId,
        title: validated.title,
        content: validated.content,
        category: validated.category,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

