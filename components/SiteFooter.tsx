import Link from "next/link";
import {Button} from "@/components/ui/button";

export default function SiteFooter() {
  return <footer className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] print:hidden">
    <div className="mx-auto max-w-6xl px-4 py-3 md:px-8">
      <Button asChild variant="ghost" size="sm"><Link href="/privacy/community">Community privacy notice</Link></Button>
    </div>
  </footer>;
}
