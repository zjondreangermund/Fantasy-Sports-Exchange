import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Smartphone, X } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isInstalledMobileApp } from "../lib/site-view";
import { useToast } from "../hooks/use-toast";

type PushStatus = {
  configured?: boolean;
  publicKey?: string;
  activeSubscriptions?: number;
  nativeConfigured?: boolean;
  activeNativeSubscriptions?: number;
};

type DevicePermission = NotificationPermission | "prompt" | "prompt-with-rationale";

type EnabledDevice =
  | { kind: "web"; subscription: PushSubscription }
  | { kind: "native"; token: string };

type PushTestPreset =
  | "entries_open"
  | "starts_soon"
  | "lineup_lock"
  | "gameweek_live"
  | "prize_won"
  | "replacement_required"
  | "community_mention"
  | "cancellation_refund";

const PUSH_TEST_PRESETS: Array<{ id: PushTestPreset; label: string; hint: string }> = [
  { id: "entries_open", label: "Entries open", hint: "New gameweek tournaments are available" },
  { id: "starts_soon", label: "Starts soon", hint: "24-hour gameweek reminder" },
  { id: "lineup_lock", label: "Lineup lock", hint: "Two-hour deadline warning" },
  { id: "gameweek_live", label: "Gameweek live", hint: "Your entered teams are live" },
  { id: "prize_won", label: "Prize won", hint: "Tournament settlement / reward" },
  { id: "replacement_required", label: "Replacement", hint: "Premier League player replacement claim" },
  { id: "community_mention", label: "Community mention", hint: "Another manager mentioned you" },
  { id: "cancellation_refund", label: "Cancellation / refund", hint: "Tournament cancelled and entry refunded" },
];

const PROMPT_SNOOZE_KEY = "fantasy_arena_push_prompt_snoozed_until";
const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function browserSupportsWebPush() {
  return typeof window !== "undefined"
    && !Capacitor.isNativePlatform()
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

function applicationServerKey(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

function promptIsSnoozed() {
  try {
    return Number(window.localStorage.getItem(PROMPT_SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function safeAppPath(value: unknown): string {
  try {
    const target = new URL(String(value || "/dashboard"), window.location.origin);
    if (target.origin !== window.location.origin) return "/dashboard";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/dashboard";
  }
}

async function configureAndroidChannel() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.createChannel({
    id: "fantasy_arena_updates",
    name: "Fantasy Arena updates",
    description: "Tournament deadlines, results, prizes and required card replacements",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}

async function registerNativeToken(): Promise<string> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timer = 0;
    let registrationHandle: { remove: () => Promise<void> } | null = null;
    let errorHandle: { remove: () => Promise<void> } | null = null;

    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      void registrationHandle?.remove();
      void errorHandle?.remove();
    };
    const succeed = (token: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error || "Native push registration failed")));
    };

    void (async () => {
      try {
        [registrationHandle, errorHandle] = await Promise.all([
          PushNotifications.addListener("registration", ({ value }) => succeed(String(value || ""))),
          PushNotifications.addListener("registrationError", ({ error }) => fail(new Error(String(error || "Native push registration failed")))),
        ]);
        timer = window.setTimeout(() => fail(new Error("Native push registration timed out")), 20_000);
        await PushNotifications.register();
      } catch (error) {
        fail(error);
      }
    })();
  });
}

export default function PushNotificationControl() {
  const { toast } = useToast();
  const nativeAndroid = isNativeAndroidApp();
  const webSupported = browserSupportsWebPush();
  const supported = nativeAndroid || webSupported;
  const [webSubscription, setWebSubscription] = React.useState<PushSubscription | null>(null);
  const [nativeToken, setNativeToken] = React.useState<string | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = React.useState(false);
  const [promptReady, setPromptReady] = React.useState(false);
  const [promptOpen, setPromptOpen] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testPreset, setTestPreset] = React.useState<PushTestPreset>("entries_open");
  const [permission, setPermission] = React.useState<DevicePermission>(
    webSupported ? Notification.permission : "prompt",
  );

  const { data: status } = useQuery<PushStatus>({
    queryKey: ["/api/push/status"],
    enabled: supported,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (!webSupported) return;
    let active = true;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((current) => {
        if (!active) return;
        setWebSubscription(current);
        setSubscriptionChecked(true);
        setPermission(Notification.permission);
      })
      .catch(() => {
        if (active) setSubscriptionChecked(true);
      });
    return () => { active = false; };
  }, [webSupported]);

  React.useEffect(() => {
    if (!nativeAndroid || !status?.nativeConfigured) return;
    let active = true;
    void (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const current = await PushNotifications.checkPermissions();
        if (!active) return;
        setPermission(current.receive);
        if (current.receive === "granted") {
          await configureAndroidChannel();
          const token = await registerNativeToken();
          await apiRequest("POST", "/api/push/native-subscription", { token, platform: "android" });
          if (active) setNativeToken(token);
        }
      } catch (error) {
        console.error("Failed to restore Android notification registration:", error);
      } finally {
        if (active) setSubscriptionChecked(true);
      }
    })();
    return () => { active = false; };
  }, [nativeAndroid, status?.nativeConfigured]);

  React.useEffect(() => {
    if (!nativeAndroid) return;
    let active = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    void (async () => {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      handles.push(await PushNotifications.addListener("pushNotificationReceived", () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      }));
      handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const path = safeAppPath(notification?.data?.url || notification?.link);
        window.location.assign(path);
      }));
      if (!active) await Promise.all(handles.map((handle) => handle.remove()));
    })().catch((error) => console.error("Failed to attach Android notification listeners:", error));
    return () => {
      active = false;
      void Promise.all(handles.map((handle) => handle.remove()));
    };
  }, [nativeAndroid]);

  const configured = nativeAndroid ? Boolean(status?.nativeConfigured) : Boolean(status?.configured);
  const enabled = nativeAndroid
    ? Boolean(nativeToken) && permission === "granted"
    : Boolean(webSubscription) && permission === "granted";

  React.useEffect(() => {
    if (!supported || !subscriptionChecked || !configured || enabled || permission === "denied") return;
    if (!isInstalledMobileApp() || promptIsSnoozed()) return;
    const timer = window.setTimeout(() => setPromptReady(true), 1_500);
    return () => window.clearTimeout(timer);
  }, [configured, enabled, permission, subscriptionChecked, supported]);

  React.useEffect(() => {
    if (promptReady) setPromptOpen(true);
  }, [promptReady]);

  const enableMutation = useMutation<EnabledDevice>({
    mutationFn: async () => {
      if (!supported || !configured) throw new Error("Push notifications are not available yet");
      if (nativeAndroid) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        let current = await PushNotifications.checkPermissions();
        if (current.receive === "prompt" || current.receive === "prompt-with-rationale") {
          current = await PushNotifications.requestPermissions();
        }
        setPermission(current.receive);
        if (current.receive !== "granted") {
          throw new Error("Notification permission was not granted. Allow notifications in your phone settings and try again.");
        }
        await configureAndroidChannel();
        const token = await registerNativeToken();
        await apiRequest("POST", "/api/push/native-subscription", { token, platform: "android" });
        return { kind: "native", token };
      }

      if (!status?.publicKey) throw new Error("Web Push is not configured");
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error("Notification permission was not granted. Allow notifications in your phone settings and try again.");
      }
      const registration = await navigator.serviceWorker.ready;
      let nextSubscription = await registration.pushManager.getSubscription();
      let created = false;
      if (!nextSubscription) {
        nextSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(status.publicKey),
        });
        created = true;
      }
      try {
        await apiRequest("POST", "/api/push/subscription", { subscription: nextSubscription.toJSON() });
      } catch (error) {
        if (created) await nextSubscription.unsubscribe().catch(() => false);
        throw error;
      }
      return { kind: "web", subscription: nextSubscription };
    },
    onSuccess: async (device) => {
      if (device.kind === "native") setNativeToken(device.token);
      else setWebSubscription(device.subscription);
      setPromptOpen(false);
      setPromptReady(false);
      try { window.localStorage.removeItem(PROMPT_SNOOZE_KEY); } catch { /* storage may be restricted */ }
      await queryClient.invalidateQueries({ queryKey: ["/api/push/status"] });
      toast({
        title: "Mobile notifications enabled",
        description: "Fantasy Arena can now notify this device about tournaments, prizes and required card replacements.",
      });
      window.setTimeout(() => setTestOpen(true), 250);
    },
    onError: (error: any) => toast({
      title: "Notifications were not enabled",
      description: String(error?.message || "Please check your phone notification settings and try again."),
      variant: "destructive",
    }),
  });

  const testMutation = useMutation({
    mutationFn: async (preset: PushTestPreset) => {
      const response = await apiRequest("POST", "/api/push/test", { preset, delaySeconds: 12 });
      return response.json();
    },
    onSuccess: (body: any) => {
      setTestOpen(false);
      toast({
        title: "Test notification scheduled",
        description: `${String(body?.title || "Fantasy Arena test")} will be sent in ${Number(body?.delaySeconds || 12)} seconds. Close or minimize the app now.`,
      });
    },
    onError: (error: any) => toast({
      title: "Could not schedule test notification",
      description: String(error?.message || "Make sure notifications are enabled and try again."),
      variant: "destructive",
    }),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (nativeAndroid) {
        if (nativeToken) await apiRequest("DELETE", "/api/push/native-subscription", { token: nativeToken });
        const { PushNotifications } = await import("@capacitor/push-notifications");
        await PushNotifications.unregister();
        return;
      }
      const current = webSubscription || await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (!current) return;
      await apiRequest("DELETE", "/api/push/subscription", { endpoint: current.endpoint });
      await current.unsubscribe();
    },
    onSuccess: async () => {
      setNativeToken(null);
      setWebSubscription(null);
      setTestOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/push/status"] });
      toast({ title: "Mobile notifications disabled", description: "This device will no longer receive Fantasy Arena push alerts." });
    },
    onError: (error: any) => toast({
      title: "Could not disable notifications",
      description: String(error?.message || "Please try again."),
      variant: "destructive",
    }),
  });

  if (!supported || !configured) return null;

  const busy = enableMutation.isPending || disableMutation.isPending || testMutation.isPending;
  const toggle = () => {
    if (busy) return;
    if (enabled) {
      setTestOpen(true);
      return;
    }
    enableMutation.mutate();
  };
  const snoozePrompt = () => {
    try { window.localStorage.setItem(PROMPT_SNOOZE_KEY, String(Date.now() + PROMPT_SNOOZE_MS)); } catch { /* storage may be restricted */ }
    setPromptOpen(false);
    setPromptReady(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={enabled ? "Open notification tests" : "Enable mobile notifications"}
        title={enabled ? "Alerts on — tap to test" : permission === "denied" ? "Allow notifications in phone settings" : "Enable mobile notifications"}
        className={`pointer-events-auto inline-flex h-9 touch-manipulation items-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold disabled:opacity-60 ${enabled ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}
        data-push-notification-control
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        <span>{enabled ? "Alerts on" : "Alerts"}</span>
      </button>

      {promptOpen ? (
        <div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/80 p-3 backdrop-blur-md sm:items-center" role="dialog" aria-modal="true" aria-label="Turn on mobile notifications" data-push-enable-dialog>
          <button type="button" className="absolute inset-0 cursor-default" onClick={snoozePrompt} aria-label="Close notification prompt" />
          <section className="pointer-events-auto relative z-10 w-full max-w-md rounded-[1.75rem] border border-cyan-300/25 bg-[#080c18] p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,.7)]">
            <button type="button" onClick={snoozePrompt} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5" aria-label="Close"><X className="h-4 w-4" /></button>
            <Smartphone className="h-6 w-6 text-cyan-200" />
            <h2 className="mt-3 text-xl font-black">Turn on mobile notifications</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">Get Fantasy Arena alerts even when the app is closed: tournament deadlines, gameweek starts, results, prizes and replacement claims.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={snoozePrompt} className="h-11 touch-manipulation rounded-2xl border border-white/15 bg-white/5 text-sm font-black text-white">Not now</button>
              <button type="button" onClick={() => enableMutation.mutate()} disabled={enableMutation.isPending} className="h-11 touch-manipulation rounded-2xl bg-cyan-300 text-sm font-black text-slate-950 disabled:opacity-50">{enableMutation.isPending ? "Enabling…" : "Enable alerts"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {testOpen ? (
        <div className="fixed inset-0 z-[245] flex items-end justify-center bg-black/85 p-3 backdrop-blur-md sm:items-center" role="dialog" aria-modal="true" aria-label="Test app notifications" data-push-self-test-dialog>
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setTestOpen(false)} aria-label="Close notification test" />
          <section className="pointer-events-auto relative z-10 max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-cyan-300/25 bg-[#080c18] p-4 text-white shadow-[0_30px_100px_rgba(0,0,0,.74)]">
            <button type="button" onClick={() => setTestOpen(false)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5" aria-label="Close"><X className="h-4 w-4" /></button>
            <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyan-200" /><h2 className="text-xl font-black">Test app notifications</h2></div>
            <p className="mt-2 pr-8 text-sm leading-6 text-white/60">Choose a notification type, then tap <strong className="text-white">Send in 12 sec</strong> and close or minimize Fantasy Arena.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PUSH_TEST_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTestPreset(preset.id)}
                  className={`pointer-events-auto min-h-[62px] touch-manipulation rounded-2xl border p-3 text-left active:scale-[.99] ${testPreset === preset.id ? "border-cyan-300/55 bg-cyan-300/[.12] text-white shadow-[0_0_22px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/[.035] text-white/75"}`}
                  data-push-test-preset={preset.id}
                >
                  <span className="block text-xs font-black">{preset.label}</span>
                  <span className="mt-1 block text-[10px] leading-4 text-slate-500">{preset.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-[1fr_1.25fr] gap-2">
              <button type="button" onClick={() => disableMutation.mutate()} disabled={disableMutation.isPending} className="h-11 touch-manipulation rounded-2xl border border-rose-300/20 bg-rose-300/[.06] text-xs font-black text-rose-100 disabled:opacity-50">Turn off alerts</button>
              <button type="button" onClick={() => testMutation.mutate(testPreset)} disabled={testMutation.isPending} className="h-11 touch-manipulation rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 text-xs font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,.22)] disabled:opacity-50">{testMutation.isPending ? "Scheduling…" : "Send in 12 sec"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
