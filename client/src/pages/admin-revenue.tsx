import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import AdminRevenuePanel from "../components/admin/AdminRevenuePanel";

export default function AdminRevenuePage() {
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-foreground">Revenue Dashboard</h1>
            <p className="text-sm text-muted-foreground">Track platform fee income from the main money flows.</p>
          </div>
          <Link href="/admin">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Admin</Button>
          </Link>
        </div>
        <AdminRevenuePanel />
      </div>
    </div>
  );
}
