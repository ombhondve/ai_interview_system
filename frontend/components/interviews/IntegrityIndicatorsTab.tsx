import { ShieldCheck, ShieldAlert, Eye, EyeOff, Users, VolumeX } from "lucide-react";
import { Interview } from "@/types";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function IntegrityIndicatorsTab({ interview }: { interview: Interview }) {
  if (!interview.integrityFlags) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="No integrity data yet" description="Integrity checks run automatically during the interview." />
      </Card>
    );
  }

  const f = interview.integrityFlags;
  const anyFlag = f.identityMismatch || f.multiFaceDetected || f.tabSwitchCount > 2 || f.silenceFlag;

  return (
    <Card>
      <CardHeader
        title="Integrity Indicators"
        action={
          <Badge variant={anyFlag ? "warning" : "success"}>
            {anyFlag ? "Review Suggested" : "No Concerns"}
          </Badge>
        }
      />
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <IndicatorRow
          icon={f.identityMismatch ? ShieldAlert : ShieldCheck}
          label="Face Match at Interview Start"
          value={`${f.faceMatchScore}% match`}
          ok={!f.identityMismatch}
        />
        <IndicatorRow
          icon={f.multiFaceDetected ? Users : ShieldCheck}
          label="Multiple Faces Detected"
          value={f.multiFaceDetected ? "Detected" : "None detected"}
          ok={!f.multiFaceDetected}
        />
        <IndicatorRow
          icon={f.tabSwitchCount > 2 ? EyeOff : Eye}
          label="Tab Switches"
          value={`${f.tabSwitchCount} during interview`}
          ok={f.tabSwitchCount <= 2}
        />
        <IndicatorRow
          icon={f.silenceFlag ? VolumeX : ShieldCheck}
          label="Unusual Silence"
          value={f.silenceFlag ? "Flagged" : "None detected"}
          ok={!f.silenceFlag}
        />
      </CardContent>
      <p className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400 dark:border-white/5">
        These signals are informational only — they do not automatically affect a candidate&apos;s report or decision.
      </p>
    </Card>
  );
}

function IndicatorRow({ icon: Icon, label, value, ok }: { icon: any; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 dark:border-white/5">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ok ? "bg-success-50 text-success-600 dark:bg-success-500/10" : "bg-warning-50 text-warning-600 dark:bg-warning-500/10")}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
