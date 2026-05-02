# Proquoment — Procurement Sourcing Dashboard

## Overview
A full-featured procurement sourcing dashboard built with Next.js 15, TypeScript, Tailwind CSS, Supabase, and Recharts. Helps procurement teams manage RFQs, supplier quotes, spend tracking, and product sourcing workflows.

## Tech Stack
- **Framework**: Next.js 15.1.11 (App Router)
- **UI**: React 19, Tailwind CSS 3.4, Recharts, Lucide React, Heroicons
- **Auth & DB**: Supabase (SSR) — @supabase/ssr, @supabase/supabase-js
- **Forms**: react-hook-form
- **Toasts**: Sonner, react-hot-toast
- **AI**: @rocketnew/llm-sdk (OpenAI, Anthropic, Gemini, Perplexity)
- **Markdown**: react-markdown
- **Dev Port**: 5000

## Pages
| Route | Description |
|-------|-------------|
| `/` | Overview dashboard — KPI cards, spend chart, quotes by category chart, activity feed |
| `/products-list` | All sourcing requests/products list |
| `/product-detail?id=xxx` | Individual product detail with quotes, supplier info, timeline |
| `/new-product` | Multi-step AI-powered RFQ flow |
| `/organization` | Organization settings |
| `/account` | User account settings |
| `/sign-up-login` | Authentication page |

## Key Architecture
- `src/app/layout.tsx` — Root layout with Supabase auth, Sonner toaster
- `src/components/AppLayout.tsx` — Main layout wrapper (Sidebar + AnnouncementBanner)
- `src/components/Sidebar.tsx` — Collapsible sidebar navigation
- `src/app/components/OverviewDashboardContent.tsx` — Overview dashboard
- `src/lib/productDetailData.ts` — Static product data for 6 products (fallback)
- `src/lib/supabase/` — Supabase client + server helpers
- `src/contexts/AuthContext.tsx` — Auth context with static fallback data
- `src/app/api/ai/chat-completion/route.ts` — AI API route (streaming + non-streaming)
- `src/app/auth/callback/route.ts` — Supabase OAuth callback

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `OPENAI_API_KEY` — OpenAI API key (for AI features)
- `GEMINI_API_KEY` — Google Gemini API key
- `ANTHROPIC_API_KEY` — Anthropic API key
- `PERPLEXITY_API_KEY` — Perplexity API key
- `NEXT_PUBLIC_SITE_URL` — Public site URL

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start`

## Notes
- App works with static fallback data even without Supabase auth
- AI features require appropriate API keys
- `next.config.mjs` imports image hosts from `image-hosts.config.mjs`
- `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` for fast iteration
