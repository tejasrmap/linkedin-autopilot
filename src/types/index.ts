// ==============================================================
// LINKEDIN AUTOPILOT - CORE TYPES AND DATA MODELS
// BY GT INNOX LLP
// ==============================================================

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'approver' | 'viewer';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profile?: Profile;
}

export type AccountType = 'member' | 'organization';
export type ConnectionStatus = 'active' | 'expired' | 'disconnected' | 'unauthorized';

export interface SocialAccount {
  id: string;
  workspace_id: string;
  provider: 'linkedin';
  provider_account_id: string;
  account_name: string;
  account_type: AccountType;
  token_expires_at: string | null;
  scopes: string[];
  connection_status: ConnectionStatus;
  profile_image_url?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type PostType = 'text' | 'image' | 'video' | 'document' | 'article';

export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'processing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface MediaAssetItem {
  id?: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  url?: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  created_by: string;
  social_account_id: string | null;
  content: string;
  media_assets: MediaAssetItem[];
  post_type: PostType;
  status: PostStatus;
  scheduled_at: string | null;
  timezone: string;
  published_at: string | null;
  provider_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  social_account?: SocialAccount;
  author_profile?: Profile;
}

export interface ScheduledJob {
  id: string;
  post_id: string;
  queue_job_id: string | null;
  scheduled_at: string;
  status: 'scheduled' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  workspace_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_by: string;
  created_at: string;
  url?: string;
}

export interface AIGeneration {
  id: string;
  workspace_id: string;
  user_id: string;
  prompt: string;
  generated_content: string;
  generation_type: 'post' | 'rewrite' | 'hashtags' | 'ideas' | 'calendar';
  created_at: string;
}

export interface AppNotification {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  read_at: string | null;
  created_at: string;
}

export interface PostAnalytics {
  id: string;
  post_id: string;
  metric_name: string;
  metric_value: number;
  collected_at: string;
}

export interface PostPublishAttempt {
  id: string;
  post_id: string;
  attempt_number: number;
  status: 'started' | 'succeeded' | 'failed';
  provider_response: Record<string, any>;
  error_message: string | null;
  created_at: string;
}

export interface ContentTemplate {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  category: string;
  created_by: string;
  created_at: string;
}

export interface BrandSettings {
  id: string;
  workspace_id: string;
  brand_name: string;
  industry: string | null;
  target_audience: string | null;
  brand_voice: string | null;
  preferred_hashtags: string[];
  created_at: string;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: 'free' | 'pro' | 'business' | 'agency';
  provider_subscription_id: string | null;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_end: string | null;
  created_at: string;
}

export interface LinkedInPublishPayload {
  authorUrn: string; // e.g. "urn:li:person:..." or "urn:li:organization:..."
  commentary: string;
  mediaType: PostType;
  mediaItems?: Array<{
    urn?: string;
    title?: string;
    description?: string;
  }>;
}

