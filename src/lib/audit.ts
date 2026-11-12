// ==============================================================
// LINKEDIN AUTOPILOT - AUDIT LOGGING HELPER
// BY GT INNOX LLP
// ==============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'user_login'
  | 'user_logout'
  | 'account_connected'
  | 'account_disconnected'
  | 'post_created'
  | 'post_updated'
  | 'post_published'
  | 'post_cancelled'
  | 'role_changed'
  | 'workspace_settings_updated';

export async function logAuditEvent(params: {
  workspaceId: string;
  userId: string;
  action: AuditAction;
  entityType: 'post' | 'social_account' | 'workspace' | 'user' | 'media';
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      metadata: params.metadata || {},
      ip_address: params.ipAddress || null,
      created_at: new Date().toISOString(),
    });

    logger.info(`Audit: ${params.action}`, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      entityId: params.entityId,
    });
  } catch (err: any) {
    logger.warn('Failed to record audit log entry', { error: err.message });
  }
}

