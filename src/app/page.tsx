/**
 * Public root — marketing landing page.
 *
 * Always renders the landing surface. The page is fully public: no auth
 * gate, no permission check, no redirect. The landing component itself
 * adapts its CTAs based on session status (Sign in / Get started for
 * visitors, Open Dashboard for signed-in users).
 */

import { LandingPage } from "@/components/landing/LandingPage";

export default function Home() {
  return <LandingPage />;
}
