# LinkedIn Autopilot 🚀
### Enterprise LinkedIn Automation, AI Content Studio & Scheduling SaaS
**Built by GT InnoX LLP**

![LinkedIn Autopilot](https://img.shields.io/badge/Status-Production%20Ready-success)
![Next.js](https://img.shields.io/badge/Framework-Next.js%2014-blue)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20Postgres-emerald)
![BullMQ](https://img.shields.io/badge/Worker-BullMQ%20%2B%20Redis-red)
![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-indigo)

---

## 🌟 Overview

**LinkedIn Autopilot** is a high-performance, multi-tenant social media management SaaS platform engineered specifically for LinkedIn. Designed for founders, growth teams, content creators, and agencies to streamline content ideation, drafting, approval, AI enrichment, scheduling, and verified publishing from one centralized dashboard.

### Core Value & Guiding Principles
- **Real Functionality Only**: No mock responses, no simulated publishing, no fake engagement numbers.
- **Enterprise Security**: Row Level Security (RLS) on all 14 PostgreSQL tables. OAuth tokens are encrypted at rest with `AES-256-GCM`.
- **Fault-Tolerant Scheduling**: Built on BullMQ persistent queues with exponential backoff, attempt telemetry, and idempotency locks.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & Design System** | Tailwind CSS, Dark/Light Mode, Lucide React Icons |
| **Backend & APIs** | Next.js API Route Handlers, Node.js Crypto, Zod Validation |
| **Database & Auth** | Supabase (PostgreSQL 15), Supabase Auth, Supabase Storage |
| **AI Content Studio** | Google Gemini Generative AI SDK (`gemini-1.5-flash`) |
| **Queue & Worker Engine** | BullMQ 5, Redis (ioredis), Dedicated Node.js Worker Process |
| **LinkedIn Integration** | Official LinkedIn REST APIs (`/rest/posts`, `/v2/userinfo`, OAuth 2.0) |

---

## 🚀 Key Modules & Capabilities

### 1. Unified Dashboard
- Live count of published posts, scheduled queue, drafts, and failed attempts.
- Real engagement metrics telemetry (impressions, reactions, comments, reposts).
- Onboarding guides and direct quick-action links.

### 2. Post Composer & Live Feed Preview
- Full rich-text composer with character counter (3000 character limit).
- Multi-format media attachment (Images, Videos, PDFs/Documents).
- Real-time LinkedIn feed preview mirroring native LinkedIn UI.
- 1-click immediate publishing or scheduled queue dispatching.

### 3. AI Content Studio (Google Gemini)
- **Generate Post**: Topic, target audience, tone, length, and content type.
- **Rewrite Post**: 6 distinct styles (Storytelling, Professional, Conversational, Technical, Educational, Persuasive).
- **Hashtags Generator**: High-reach industry and topic hashtag discovery.
- **Post Ideas**: Viral concepts and scroll-stopping opening hooks.
- **7-Day Strategic Calendar**: Weekly theme breakdown with 1-click export to composer.
- **Brand Voice Settings**: Workspace-level style guide enforcement.

### 4. Automated Post Scheduler & Persistent Worker
- High-precision timezone conversion stored in UTC.
- Queue processing handled by persistent Node.js worker (`src/worker/index.ts`).
- Idempotency lock prevents double-publishing.
- Post publish attempts logged to `post_publish_attempts`.

### 5. Official LinkedIn OAuth 2.0 Integration
- Member personal profile connection (`w_member_social`, `openid`, `profile`, `email`).
- Organization page discovery (`w_organization_social`).
- Secure cryptographic state validation with 15-minute replay prevention.
- Encrypted token storage with zero frontend leakage.

### 6. Team Collaboration & RBAC
- Role-based permissions: `Owner`, `Admin`, `Editor`, `Approver`, `Viewer`.
- Multi-tenant database isolation enforced via PostgreSQL Row Level Security (RLS).

---

## 📂 Project Architecture

```
GT-Scheduler/
├── src/
│   ├── app/                         # Next.js 14 App Router
│   │   ├── accounts/                # LinkedIn Account Management
│   │   ├── ai-studio/               # Gemini AI Content Generation Studio
│   │   ├── analytics/               # Official LinkedIn Analytics & History
│   │   ├── billing/                 # Subscription Tiers & SaaS Pricing
│   │   ├── calendar/                # Visual Content Planning Calendar
│   │   ├── composer/                # Rich Post Composer & Live Preview
│   │   ├── dashboard/               # Primary Executive Dashboard
│   │   ├── library/                 # Media Assets & Cloud Storage
│   │   ├── login/ & register/       # Supabase Auth Authentication
│   │   ├── posts/                   # Post Status Matrix & Filter Tabs
│   │   ├── settings/                # Brand Settings & Guardrails
│   │   ├── team/                    # Team Workspace & RBAC
│   │   ├── templates/               # Reusable Post Frameworks
│   │   └── api/                     # Server-Side API Handlers
│   │       ├── ai/                  # AI Endpoints (generate, rewrite, hashtags, ideas)
│   │       ├── analytics/           # Metrics & Performance Endpoints
│   │       ├── auth/                # Auth Me, Callback, Logout
│   │       ├── linkedin/            # Connect, Callback, Accounts, Disconnect
│   │       ├── media/               # Storage Upload & Asset Management
│   │       ├── notifications/       # In-App Notification Center
│   │       └── posts/               # CRUD, Immediate Publish, Schedule, Cancel
│   ├── components/                  # UI Components, AppShell, Sidebar, TopNav
│   ├── lib/
│   │   ├── ai/                      # Google Gemini Service
│   │   ├── encryption.ts            # AES-256-GCM Token Encryption Engine
│   │   ├── linkedin/                # Official LinkedIn REST Client
│   │   ├── queue/                   # Redis & BullMQ Queue Dispatcher
│   │   └── supabase/                # Browser, Server & Admin Supabase Clients
│   ├── types/                       # Shared TypeScript Interfaces & Data Models
│   └── worker/                      # Dedicated Standalone Background Worker
├── supabase/
│   └── migrations/                  # 14 Tables + RLS Policies + Triggers
├── tests/                           # Automated Verification & Test Suite
├── .env.example                     # Documented Environment Variables Template
└── DEVELOPMENT_STATUS.md            # Detailed Module Status & Audit Matrix
```

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18 or later (tested on v25.6.0)
- **Redis**: Local instance or cloud Redis (Upstash)
- **Supabase**: Free Supabase project

### 2. Clone and Install Dependencies
```bash
git clone <repo-url>
cd GT-Scheduler
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your credentials:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/callback
LINKEDIN_API_VERSION=202401

GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### 4. Run Database Migration
1. Open your Supabase Project -> **SQL Editor**.
2. Run `supabase/migrations/20261112000000_init_schema.sql`.
3. Under **Storage**, create a public bucket named `post-assets`.

### 5. Run Automated Tests
```bash
npm test
```

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Run Background Worker (in separate terminal)
```bash
npm run worker
```

---

## 🚢 Production Deployment Guide

### Web Application (Next.js)
1. Deploy to **Vercel**, **AWS Amplify**, or **Docker**.
2. Configure all environment variables in project settings.
3. Build command: `npm run build`, Output directory: `.next`.

### Worker Process (Persistent Queue)
1. Deploy to **Railway**, **Render**, **Fly.io**, or any VPS.
2. Start command: `npm run worker`.
3. Ensure worker has access to `REDIS_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 🔒 Security Hardening Checklist

- [x] All OAuth access tokens encrypted at rest with AES-256-GCM.
- [x] Zero exposure of client secrets or encryption keys in browser bundles.
- [x] Row Level Security (RLS) active on all 14 PostgreSQL tables.
- [x] CSRF state validation with 15-minute expiration on OAuth callbacks.
- [x] Strict Zod schemas on all API inputs.
- [x] Safe AI guardrail: human approval required before queuing posts.
- [x] Atomic processing locks to prevent duplicate publishing.

---

## 📄 License & Ownership
Copyright © 2026 **GT InnoX LLP**. All rights reserved. Commercial SaaS product.

