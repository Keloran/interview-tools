import prisma from "@/lib/prisma";
import {reportError} from "@/lib/bugfixes";

// ChewedFeed HQ's standard product hook: POST /api/product-customers/sync with X-Enquiry-Key.
// interviews.tools has no paid plans, so every user is a free customer. Off without
// CHEWEDFEED_API_URL and CHEWEDFEED_ENQUIRY_KEY.

export type Customer = {clerkId: string; email: string; name?: string | null};

// Routes create users without an address as `<clerkId>@example.com`: not a real contact
const placeholder = (email: string) => email.endsWith("@example.com");

/** Send one user to ChewedFeed. Best effort: failures are reported, never thrown. */
export async function syncCustomer(customer: Customer): Promise<void> {
  const url = process.env.CHEWEDFEED_API_URL?.replace(/\/$/, "");
  const key = process.env.CHEWEDFEED_ENQUIRY_KEY;
  if (!url || !key || placeholder(customer.email)) return;
  try {
    const response = await fetch(`${url}/api/product-customers/sync`, {
      method: "POST",
      headers: {"content-type": "application/json", "x-enquiry-key": key},
      body: JSON.stringify({
        external_customer_id: customer.clerkId,
        email: customer.email,
        name: customer.name ?? "",
        plan: "free",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) reportError("ChewedFeed customer sync failed", String(response.status));
  } catch (err) {
    reportError("ChewedFeed customer sync failed", err);
  }
}

/** Send every user: a backfill, and a catch-up for users created outside the Clerk webhook. */
// ponytail: one POST per user, one at a time; a batch endpoint in ChewedFeed if users reach the thousands
export async function syncAllCustomers(): Promise<void> {
  try {
    const users = await prisma.user.findMany({select: {clerkId: true, email: true, name: true}});
    for (const user of users) await syncCustomer(user);
  } catch (err) {
    reportError("ChewedFeed customer sweep failed", err);
  }
}
