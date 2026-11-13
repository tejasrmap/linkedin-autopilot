// ==============================================================
// LINKEDIN AUTOPILOT - STRIPE RECONCILIATION API ROUTE
// EXPLICIT PRE-REACTIVATION AUTHORITATIVE STATE SYNCHRONIZATION
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { reconcileWorkspaceSubscription } from '@/lib/billing-reconcile';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetWorkspaceId = body.workspaceId || auth.workspaceId;

    // Cross-tenant protection: Regular owners can only reconcile their own workspace
    if (targetWorkspaceId !== auth.workspaceId && !auth.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot reconcile subscriptions across foreign workspaces.' },
        { status: 403 }
      );
    }

    // Single workspace reconciliation
    if (targetWorkspaceId) {
      const result = await reconcileWorkspaceSubscription(targetWorkspaceId);
      return NextResponse.json({
        success: result.reconciled,
        mode: 'authoritative_stripe_sync',
        replayedEvents: 0,
        result,
      });
    }

    // Platform superadmin bulk reconciliation
    if (auth.isPlatformAdmin && body.reconcileAll === true) {
      const admin = createAdminClient();
      const { data: workspaces } = await admin.from('workspaces').select('id');
      const results = [];

      for (const ws of workspaces || []) {
        const res = await reconcileWorkspaceSubscription(ws.id);
        results.push(res);
      }

      return NextResponse.json({
        success: true,
        mode: 'bulk_authoritative_stripe_sync',
        replayedEvents: 0,
        totalReconciled: results.length,
        results,
      });
    }

    return NextResponse.json({ error: 'Missing target workspaceId.' }, { status: 400 });
  } catch (err: any) {
    console.error('[Billing-Reconcile] Error executing reconciliation:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to execute subscription reconciliation.' },
      { status: 500 }
    );
  }
}

