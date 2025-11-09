# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **interview tracking application** built with Next.js 16 (App Router) that helps users manage job applications and interview schedules. Users can track interviews across multiple companies, stages, and outcomes with a calendar view.

**Tech Stack:**
- Next.js 16 (App Router) with React 19
- TypeScript with strict mode
- Prisma ORM with PostgreSQL
- Clerk for authentication
- TanStack Query for data fetching
- Radix UI components with Tailwind CSS
- Feature flags via @flags-gg/react-library
- Zustand for client state management

## Development Commands

```bash
# Development server
pnpm dev

# Build for production (generates Prisma client first)
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Database commands
npx prisma generate        # Generate Prisma client
npx prisma migrate dev     # Create and apply migrations
npx prisma studio          # Open Prisma Studio GUI
npx prisma db push         # Push schema changes without migrations
```

## Architecture

### Database Schema (Prisma)

The app uses a multi-table relational model:

- **User**: Created via Clerk webhook on signup, stores `clerkId`, email, name
- **Company**: User-owned companies (unique per userId+name)
- **Interview**: The core entity tracking each interview stage
  - Links to Company, Stage, StageMethod
  - Has `status` (APPLIED, SCHEDULED, COMPLETED, etc.)
  - Has `outcome` (PASSED, REJECTED, OFFER_RECEIVED, etc.)
  - Stores `applicationDate`, `date` (interview datetime), optional `deadline` for take-homes
  - Contains `metadata` JSON field for flexible data like job posting URLs
- **Stage**: Reference table for interview stages (e.g., "Phone Screen", "Technical", "Onsite")
- **StageMethod**: Reference table for interview methods (e.g., "Phone", "Link")

**Key constraint**: Interviews are unique per `[userId, companyId, jobTitle, applicationDate]` to prevent duplicates.

**Prisma output**: Generated client is in `app/generated/prisma/` (not the default location).

### API Routes

All routes authenticate via Clerk's `currentUser()`.

**GET /api/companies**
- Returns companies for authenticated user
- Used to populate company dropdowns

**GET /api/interviews**
- Rich query support with filters:
  - Date filtering: `date`, `dateFrom`, `dateTo`, `includePast`
  - Entity filters: `companyId`, `company` (name contains), `stageId`, `stageMethodId`
  - Multi-value enums: `status[]`, `outcome[]`
  - Free-text search: `q` (searches jobTitle, interviewer, company name)
  - Pagination: `take`, `skip`
- Returns interviews with nested company, stage, stageMethod data
- Defaults to future-only interviews unless `includePast=true`

**POST /api/interviews**
- Creates new interview
- Auto-creates/upserts User, Company, Stage, StageMethod records
- Required fields: `stage`, `companyName`, `jobTitle`
- Optional: `interviewer`, `jobPostingLink`, `date`, `locationType` (phone|link), `interviewLink`
- Defaults to today 9:00 AM if no date provided

**POST /api/webhooks/clerk**
- Webhook handler for Clerk `user.created` events
- Syncs new users to local database

### Frontend Components

**Layout** (`app/layout.tsx`):
- Wraps app in `ClerkProvider` and `ClientProviders` (TanStack Query + FlagsProvider)
- Shows sign-in button or user avatar based on auth state
- Renders `<Companies />` component for company management

**Main Page** (`app/page.tsx`):
- Two-column layout: `<InterviewsList />` + `<Calendar />`

**Key Components**:
- `Calendar.tsx`: Calendar view of interviews
- `InterviewsList.tsx`: List/table view of interviews with filtering
- `InterviewForm.tsx`: Form for creating/editing interviews
- `Company.tsx`: Company selector/management UI
- `ClientProviders.tsx`: Wraps children with QueryClient and FlagsProvider

### Libraries & Utilities

**lib/prisma.ts**: Singleton Prisma client with query logging in development

**lib/env.ts**: Type-safe environment variables using `@t3-oss/env-nextjs`
- Server: `NODE_ENV`
- Client: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, flags config

**lib/store.ts**: Zustand store for client-side state

**lib/utils.ts**: Utility functions (likely includes `cn()` for class merging)

## Important Patterns

### Authentication Flow
1. Clerk handles user signup/signin
2. Webhook to `/api/webhooks/clerk` creates User in Prisma DB
3. All API routes use `currentUser()` to get Clerk user
4. API routes use `prisma.user.upsert()` to ensure local user exists before operations

### Data Fetching
- Components use TanStack Query for server state
- All mutations should invalidate relevant queries to keep UI in sync

### Prisma Client Import
Always import from the custom output location:
```typescript
import prisma from "@/lib/prisma"
// NOT from "@prisma/client"
```

The generated client types are at `@/app/generated/prisma/client`.

### Date Handling
- Interview dates are stored as `DateTime` in Prisma
- API accepts ISO strings, defaults to today 9 AM if missing
- Date filtering in GET endpoint uses UTC ranges

## Common Patterns When Modifying Code

**Adding a new Interview field:**
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev` or `npx prisma db push`
3. Update API route types/validation in `app/api/interviews/route.ts`
4. Update frontend form in `components/InterviewForm.tsx`
5. Update display components (`InterviewsList.tsx`, `Calendar.tsx`)

**Adding a new API route:**
- Create `app/api/[name]/route.ts`
- Use `currentUser()` from `@clerk/nextjs/server` for auth
- Import `prisma` from `@/lib/prisma`
- Return `NextResponse.json()` for all responses

**Working with the calendar:**
- Calendar component likely uses interview `date` field for positioning
- Status and outcome enums affect visual representation

## Environment Variables

Required in `.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk public key
- `CLERK_SECRET_KEY`: Clerk secret (server-side)
- `WEBHOOK_SECRET`: Clerk webhook signing secret
- Optional: `NEXT_PUBLIC_FLAGS_PROJECT`, `NEXT_PUBLIC_FLAGS_AGENT`, `NEXT_PUBLIC_FLAGS_ENVIRONMENT`

## Path Aliases

The project uses `@/*` to reference root-level imports:
```typescript
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
```