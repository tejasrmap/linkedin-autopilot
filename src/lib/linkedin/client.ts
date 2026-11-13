// ==============================================================
// LINKEDIN AUTOPILOT - OFFICIAL LINKEDIN REST API CLIENT
// BY GT INNOX LLP
// ==============================================================

import { decryptToken } from '@/lib/encryption';
import { PostType } from '@/types';

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  id_token?: string;
}

export interface LinkedInUserInfo {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  locale?: {
    country: string;
    language: string;
  };
}

export interface LinkedInOrganization {
  id: string;
  urn: string;
  name: string;
  vanityName?: string;
  logoUrl?: string;
  role?: string;
  status?: 'active' | 'awaiting_authorization';
}

export interface LinkedInOrgPermissionStatus {
  hasOrganizationSocialScope: boolean;
  communityManagementActive: boolean;
  status: 'authorized' | 'awaiting_authorization';
  message: string;
  organizations: LinkedInOrganization[];
}

export interface LinkedInPublishResult {
  success: boolean;
  providerPostId?: string;
  urn?: string;
  error?: string;
  rawResponse?: any;
  isAmbiguous?: boolean;
  isReconciled?: boolean;
}

export class LinkedInClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiVersion: string;

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';
    this.apiVersion = process.env.LINKEDIN_API_VERSION || '202610';
  }

  /**
   * Generates official LinkedIn OAuth 2.0 authorization URL
   */
  getAuthorizationUrl(state: string, requestOrgAccess = false, overrideRedirectUri?: string): string {
    const base = 'https://www.linkedin.com/oauth/v2/authorization';
    const scopes = ['openid', 'profile', 'email', 'w_member_social'];

    if (requestOrgAccess) {
      scopes.push('w_organization_social', 'rw_organization_admin');
    }

    const redirectUri = overrideRedirectUri || this.redirectUri;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: scopes.join(' '),
    });

    return `${base}?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for an OAuth 2.0 access token
   */
  async exchangeCodeForToken(code: string, overrideRedirectUri?: string): Promise<LinkedInTokenResponse> {
    const url = 'https://www.linkedin.com/oauth/v2/accessToken';
    const redirectUri = overrideRedirectUri || this.redirectUri;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`LinkedIn OAuth Token Exchange Failed: ${data.error_description || data.error || response.statusText}`);
    }

    return data as LinkedInTokenResponse;
  }

  /**
   * Retrieves authenticated member's profile via OpenID Connect UserInfo endpoint
   */
  async getUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to retrieve LinkedIn User Profile: ${response.status} ${err}`);
    }

    return response.json();
  }

  /**
   * Retrieves organizations where the member has administrative rights, resolving real names & logos
   */
  async getOrganizations(accessToken: string): Promise<LinkedInOrganization[]> {
    const orgs: LinkedInOrganization[] = [];

    try {
      // 1. Try modern REST organizationAcls endpoint
      let response = await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      // 2. Fallback to v2 organizationalEntityAcls if needed
      if (!response.ok) {
        response = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
      }

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const elements = data.elements || [];

      for (const el of elements) {
        const orgUrn = el.organization || el.organizationalTarget;
        const role = el.role || 'ADMINISTRATOR';
        const state = el.state || 'APPROVED';

        if (orgUrn && orgUrn.startsWith('urn:li:organization:')) {
          const orgId = orgUrn.split(':').pop();
          let orgName = `Organization (${orgId})`;
          let vanityName: string | undefined;
          let logoUrl: string | undefined;

          // Attempt to fetch detailed organization info (name, vanityName, logo)
          try {
            const detailRes = await fetch(`https://api.linkedin.com/rest/organizations/${orgId}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'LinkedIn-Version': this.apiVersion,
                'X-Restli-Protocol-Version': '2.0.0',
              },
            });

            if (detailRes.ok) {
              const detailData = await detailRes.json();
              orgName = detailData.localizedName || detailData.name?.localized?.en_US || orgName;
              vanityName = detailData.vanityName;
            }
          } catch {
            // Non-blocking detail enrichment
          }

          orgs.push({
            id: orgId!,
            urn: orgUrn,
            name: orgName,
            vanityName,
            logoUrl,
            role,
            status: state === 'APPROVED' ? 'active' : 'awaiting_authorization',
          });
        }
      }

      return orgs;
    } catch {
      return [];
    }
  }

  /**
   * Inspects organization authorization status & Community Management API availability
   */
  async checkOrganizationPermissions(accessToken: string): Promise<LinkedInOrgPermissionStatus> {
    try {
      // Test REST organizationAcls endpoint
      const response = await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': this.apiVersion,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (response.ok) {
        const orgs = await this.getOrganizations(accessToken);
        return {
          hasOrganizationSocialScope: true,
          communityManagementActive: true,
          status: 'authorized',
          message: 'LinkedIn Company Page publishing is fully authorized and available.',
          organizations: orgs,
        };
      }

      if (response.status === 403) {
        const errorText = await response.text();
        return {
          hasOrganizationSocialScope: false,
          communityManagementActive: false,
          status: 'awaiting_authorization',
          message:
            'Company Page publishing requires the "Community Management API" product to be requested and approved in the LinkedIn Developer Portal for your Developer Application (Client ID: ' +
            this.clientId +
            '). Personal profile publishing is fully operational.',
          organizations: [],
        };
      }

      return {
        hasOrganizationSocialScope: false,
        communityManagementActive: false,
        status: 'awaiting_authorization',
        message: `LinkedIn returned status ${response.status} when checking organization permissions.`,
        organizations: [],
      };
    } catch (e: any) {
      return {
        hasOrganizationSocialScope: false,
        communityManagementActive: false,
        status: 'awaiting_authorization',
        message: `Network check failed: ${e.message}`,
        organizations: [],
      };
    }
  }

  /**
   * Initializes image upload and uploads binary buffer to LinkedIn
   */
  private async uploadImageToLinkedIn(accessToken: string, authorUrn: string, imageBuffer: Buffer, mimeType: string): Promise<string> {
    const initUrl = 'https://api.linkedin.com/rest/images?action=initializeUpload';
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`LinkedIn Image Initialize Upload failed: ${initRes.status} ${err}`);
    }

    const initData = await initRes.json();
    const uploadUrl = initData.value.uploadUrl;
    const imageUrn = initData.value.image;

    // Upload raw binary bytes
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LinkedIn Image Binary Upload failed: ${uploadRes.status} ${err}`);
    }

    return imageUrn;
  }

  /**
   * Registers, uploads binary, and finalizes a Video asset on LinkedIn (/rest/videos)
   */
  private async uploadVideoToLinkedIn(accessToken: string, authorUrn: string, videoBuffer: Buffer, mimeType: string): Promise<string> {
    const initUrl = 'https://api.linkedin.com/rest/videos?action=initializeUpload';
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
          fileSizeBytes: videoBuffer.length,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`LinkedIn Video Initialize Upload failed: ${initRes.status} ${err}`);
    }

    const initData = await initRes.json();
    const uploadInstructions = initData.value.uploadInstructions;
    const videoUrn = initData.value.video;

    // Upload part(s)
    if (uploadInstructions && uploadInstructions.length > 0) {
      const uploadUrl = uploadInstructions[0].uploadUrl;
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: new Uint8Array(videoBuffer),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`LinkedIn Video Binary Upload failed: ${uploadRes.status} ${err}`);
      }
    }

    return videoUrn;
  }

  /**
   * Registers and uploads a Document/PDF carousel asset on LinkedIn (/rest/documents)
   */
  private async uploadDocumentToLinkedIn(accessToken: string, authorUrn: string, docBuffer: Buffer, title: string, mimeType: string): Promise<string> {
    const initUrl = 'https://api.linkedin.com/rest/documents?action=initializeUpload';
    const initRes = await fetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': this.apiVersion,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
        },
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`LinkedIn Document Initialize Upload failed: ${initRes.status} ${err}`);
    }

    const initData = await initRes.json();
    const uploadUrl = initData.value.uploadUrl;
    const docUrn = initData.value.document;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType || 'application/pdf',
      },
      body: new Uint8Array(docBuffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`LinkedIn Document Binary Upload failed: ${uploadRes.status} ${err}`);
    }

    return docUrn;
  }

  /**
   * Publishes post directly to LinkedIn Posts API (REST /rest/posts)
   */
  async publishPost(params: {
    encryptedAccessToken: string;
    authorUrn: string; // e.g. "urn:li:person:<subId>" or "urn:li:organization:<orgId>"
    content: string;
    postType: PostType;
    mediaAssets?: Array<{
      file_name: string;
      storage_path: string;
      mime_type: string;
      url?: string;
    }>;
  }): Promise<LinkedInPublishResult> {
    const accessToken = decryptToken(params.encryptedAccessToken);
    if (!accessToken) {
      return {
        success: false,
        error: 'Missing or unreadable LinkedIn access token. Please reconnect your account.',
      };
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': this.apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };

    let postPayload: any = {
      author: params.authorUrn,
      commentary: params.content,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    // Handle Image uploads if present
    if (params.postType === 'image' && params.mediaAssets && params.mediaAssets.length > 0) {
      try {
        const media = params.mediaAssets[0];
        if (media.url) {
          const mediaFetch = await fetch(media.url);
          if (mediaFetch.ok) {
            const buffer = Buffer.from(await mediaFetch.arrayBuffer());
            const imageUrn = await this.uploadImageToLinkedIn(accessToken, params.authorUrn, buffer, media.mime_type);
            postPayload.content = {
              media: {
                id: imageUrn,
                title: media.file_name,
              },
            };
          }
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Image upload to LinkedIn failed: ${err.message}`,
        };
      }
    }

    // Handle Video uploads if present
    if (params.postType === 'video' && params.mediaAssets && params.mediaAssets.length > 0) {
      try {
        const media = params.mediaAssets[0];
        if (media.url) {
          const mediaFetch = await fetch(media.url);
          if (mediaFetch.ok) {
            const buffer = Buffer.from(await mediaFetch.arrayBuffer());
            const videoUrn = await this.uploadVideoToLinkedIn(accessToken, params.authorUrn, buffer, media.mime_type);
            postPayload.content = {
              media: {
                id: videoUrn,
                title: media.file_name,
              },
            };
          }
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Video upload to LinkedIn failed: ${err.message}`,
        };
      }
    }

    // Handle Document / PDF carousel uploads if present
    if (params.postType === 'document' && params.mediaAssets && params.mediaAssets.length > 0) {
      try {
        const media = params.mediaAssets[0];
        if (media.url) {
          const mediaFetch = await fetch(media.url);
          if (mediaFetch.ok) {
            const buffer = Buffer.from(await mediaFetch.arrayBuffer());
            const docUrn = await this.uploadDocumentToLinkedIn(accessToken, params.authorUrn, buffer, media.file_name, media.mime_type);
            postPayload.content = {
              media: {
                id: docUrn,
                title: media.file_name,
              },
            };
          }
        }
      } catch (err: any) {
        return {
          success: false,
          error: `Document upload to LinkedIn failed: ${err.message}`,
        };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s durable publishing timeout

      const response = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(postPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // LinkedIn REST posts endpoint returns 201 Created with x-restli-id or x-linkedin-id header
      if (response.status === 201) {
        const providerPostId =
          response.headers.get('x-restli-id') ||
          response.headers.get('x-linkedin-id') ||
          response.headers.get('location') ||
          'urn:li:share:published';

        return {
          success: true,
          providerPostId,
          urn: providerPostId,
          rawResponse: { status: 201, headers: Object.fromEntries(response.headers.entries()) },
        };
      }

      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // text only
      }

      let errorMsg =
        errorJson?.message ||
        errorJson?.errorDetails?.description ||
        errorJson?.error_description ||
        `LinkedIn API Error (${response.status}): ${errorText}`;

      if (
        params.authorUrn.startsWith('urn:li:organization:') &&
        (response.status === 403 || errorMsg.includes('permission') || errorMsg.includes('ACCESS_DENIED'))
      ) {
        errorMsg = `[LinkedIn Company Page Permission Note]: ${errorMsg}. Publishing to a Company Page requires the LinkedIn "Community Management API" product approved on Developer App (${this.clientId}) and authorized organization administrator rights.`;
      }

      return {
        success: false,
        error: errorMsg,
        rawResponse: errorJson || errorText,
      };
    } catch (err: any) {
      const isTimeout =
        err.name === 'AbortError' ||
        err.message?.toLowerCase().includes('timeout') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNRESET');

      return {
        success: false,
        isAmbiguous: isTimeout,
        error: isTimeout
          ? `Ambiguous Outcome: Network timeout during post transmission to LinkedIn (${err.message}). Reconciliation required before re-attempting.`
          : `Network error reaching LinkedIn API: ${err.message}`,
      };
    }
  }

  /**
   * Reconciles recent posts published by an author to resolve ambiguous network timeouts
   */
  async reconcileRecentAuthorPost(params: {
    encryptedAccessToken: string;
    authorUrn: string;
    expectedCommentarySnippet: string;
  }): Promise<{ reconciled: boolean; providerPostId?: string }> {
    try {
      const accessToken = decryptToken(params.encryptedAccessToken);
      if (!accessToken) return { reconciled: false };

      const encodedAuthor = encodeURIComponent(params.authorUrn);
      const res = await fetch(
        `https://api.linkedin.com/rest/posts?author=${encodedAuthor}&count=5&sortBy=LAST_MODIFIED`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'LinkedIn-Version': this.apiVersion,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      if (!res.ok) return { reconciled: false };
      const data = await res.json();
      const elements = data.elements || [];

      // Check if any recent post commentary matches the first 60 characters
      const targetSnippet = params.expectedCommentarySnippet.trim().slice(0, 60).toLowerCase();
      for (const p of elements) {
        const commentary = (p.commentary || '').toLowerCase();
        if (commentary.includes(targetSnippet)) {
          return {
            reconciled: true,
            providerPostId: p.id || p.urn,
          };
        }
      }
      return { reconciled: false };
    } catch (e) {
      console.warn('[Reconciliation] Error inspecting recent author posts:', e);
      return { reconciled: false };
    }
  }

  /**
   * Fetches real post statistics / analytics if authorized
   */
  async getPostAnalytics(encryptedAccessToken: string, postUrn: string): Promise<Record<string, number | null>> {
    const accessToken = decryptToken(encryptedAccessToken);
    if (!accessToken) return {};

    try {
      // Official LinkedIn Share Statistics endpoint
      const url = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&shares=List(${encodeURIComponent(postUrn)})`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!response.ok) {
        return {
          impressions: null,
          reactions: null,
          comments: null,
          reposts: null,
        };
      }

      const data = await response.json();
      const stats = data.elements?.[0]?.totalShareStatistics;

      return {
        impressions: stats?.impressionCount ?? null,
        reactions: stats?.likeCount ?? null,
        comments: stats?.commentCount ?? null,
        reposts: stats?.shareCount ?? null,
      };
    } catch {
      return {
        impressions: null,
        reactions: null,
        comments: null,
        reposts: null,
      };
    }
  }
}

export const linkedInClient = new LinkedInClient();
