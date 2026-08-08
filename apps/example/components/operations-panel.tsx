import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Database,
  Dumbbell,
  HeartPulse,
  Salad,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const specialists = [
  { name: "Training", detail: "Weekly load and progression", icon: Dumbbell },
  {
    name: "Recovery",
    detail: "Soreness and sleep constraints",
    icon: HeartPulse,
  },
  { name: "Nutrition", detail: "Fueling and hydration", icon: Salad },
];

export function OperationsPanel({
  thread,
}: {
  thread?: {
    status: string;
    generation: {
      eveSessionId?: string;
      nextStreamIndex: number;
      status: string;
    };
  } | null;
}) {
  const isBound = Boolean(thread?.generation.eveSessionId);
  const hasEvents = (thread?.generation.nextStreamIndex ?? 0) > 0;
  const isWaiting = thread?.status === "waiting_input";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div>
          <p className="text-sm font-medium">Agent operations</p>
          <p className="text-xs text-muted-foreground">
            Live Convex projection
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />{" "}
          {isBound ? "Synced" : "Unbound"}
        </Badge>
      </div>

      <Tabs defaultValue="run" className="flex min-h-0 flex-1 flex-col p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="run">Current run</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
        </TabsList>
        <TabsContent value="run" className="min-h-0 flex-1">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-4 py-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="size-4" /> Turn progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <TimelineItem
                    icon={CheckCircle2}
                    title="Thread captured"
                    detail="Convex application record is ready"
                  />
                  <TimelineItem
                    icon={isBound ? CheckCircle2 : CircleDashed}
                    title="Eve session bound"
                    detail={
                      isBound
                        ? "Durable Eve session attached"
                        : "Created when the first message is delivered"
                    }
                    active={!isBound}
                  />
                  <TimelineItem
                    icon={hasEvents ? CheckCircle2 : CircleDashed}
                    title="Events projected"
                    detail={
                      hasEvents
                        ? `${thread?.generation.nextStreamIndex} ordered Eve events`
                        : "Waiting for the Eve event stream"
                    }
                    active={isBound && !hasEvents}
                  />
                  <TimelineItem
                    icon={isWaiting ? CircleDashed : CheckCircle2}
                    title={isWaiting ? "Awaiting input" : "Application state"}
                    detail={formatState(thread?.status ?? "ready")}
                    active={isWaiting}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Run tree</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <AgentRow
                    initials="PC"
                    name="Performance coach"
                    detail={`Root · ${formatState(thread?.generation.status ?? "unbound")}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Specialist actions and input requests appear from Eve as
                    structured message parts during a live turn.
                  </p>
                </CardContent>
              </Card>

              <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Stream cursor</span>
                  <code>{thread?.generation.nextStreamIndex ?? 0}</code>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span>Command state</span>
                  <code>{thread?.status ?? "ready"}</code>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="capabilities" className="min-h-0 flex-1">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-5 py-2">
              <CapabilityGroup title="Specialists" icon={Sparkles}>
                {specialists.map((specialist) => (
                  <div
                    key={specialist.name}
                    className="flex items-start gap-3 py-2"
                  >
                    <specialist.icon className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{specialist.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {specialist.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </CapabilityGroup>
              <CapabilityGroup title="Skills" icon={ShieldCheck}>
                <Badge variant="secondary">training-planning</Badge>{" "}
                <Badge variant="secondary">recovery-assessment</Badge>{" "}
                <Badge variant="secondary">nutrition-planning</Badge>
              </CapabilityGroup>
              <CapabilityGroup title="Application tools" icon={Database}>
                <code className="block text-xs leading-6">
                  get_user_profile
                  <br />
                  list_workouts
                  <br />
                  list_recovery_checkins
                  <br />
                  propose_training_plan
                </code>
              </CapabilityGroup>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatState(value: string) {
  return value.replaceAll("_", " ");
}

function TimelineItem({
  icon: Icon,
  title,
  detail,
  active = false,
}: {
  icon: typeof CheckCircle2;
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Icon
        className={`mt-0.5 size-4 ${active ? "text-amber-500" : "text-muted-foreground"}`}
      />
      <div>
        <p className="font-medium leading-none">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function AgentRow({
  initials,
  name,
  detail,
}: {
  initials: string;
  name: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function CapabilityGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" />
        {title}
      </h3>
      <div className="rounded-lg border bg-card p-3">{children}</div>
    </section>
  );
}
