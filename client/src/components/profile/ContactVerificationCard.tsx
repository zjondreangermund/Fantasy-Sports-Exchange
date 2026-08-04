import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Clock3, Mail, Phone, ShieldCheck } from "lucide-react";

type Props = {
  email?: string | null;
};

function VerificationRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant="outline" className="gap-1 border-amber-300/30 text-amber-100">
          <Clock3 className="h-3 w-3" /> Launch setup
        </Badge>
        <Button size="sm" variant="outline" disabled className="opacity-55">
          Verify
        </Button>
      </div>
    </div>
  );
}

export default function ContactVerificationCard({ email }: Props) {
  return (
    <section className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.08] to-black/20 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-200" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white">Contact verification</h3>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/55">
            Email and cell-number verification are prepared for the official launch. Verification codes remain disabled until Fantasy Arena has its permanent domain, verified sender email and approved SMS provider.
          </p>
        </div>
        <Badge className="border border-amber-300/25 bg-amber-300/10 text-amber-100">Coming at official launch</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <VerificationRow icon={<Mail className="h-5 w-5" />} label="Email address" value={email || "No email address available"} />
        <VerificationRow icon={<Phone className="h-5 w-5" />} label="Cell number" value="Not added yet" />
      </div>
    </section>
  );
}
