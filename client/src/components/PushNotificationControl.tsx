import * as React from "react";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import { apiRequest, queryClient } from "../lib/queryClient";
import { isInstalledMobileApp } from "../lib/site-view";
import { useToast } from "../hooks/use-toast";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

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
        description: "Fantasy Arena can now notify this installed app about tournaments, prizes and required card replacements.",
      });
    },
    onError: (error: any) => toast({
      title: "Notifications were not enabled",
      description: String(error?.message || "Please check your phone notification settings and try again."),
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

  const busy = enableMutation.isPending || disableMutation.isPending;
  const toggle = () => {
    if (busy) return;
    if (enabled) {
      if (window.confirm("Turn off Fantasy Arena mobile notifications on this device?")) disableMutation.mutate();
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
        aria-label={enabled ? "Disable mobile notifications" : "Enable mobile notifications"}
        title={enabled ? "Mobile notifications enabled" : permission === "denied" ? "Allow notifications in phone settings" : "Enable mobile notifications"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold disabled:opacity-60 ${enabled ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}
        data-push-notification-control
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        <span className="hidden lg:inline">{enabled ? "Alerts on" : "Alerts"}</span>
      </button>

      <Dialog open={promptOpen} onOpenChange={(open) => { if (!open) snoozePrompt(); }}>
        <DialogContent className="z-[125] max-w-md border-cyan-300/25 bg-[#080c18] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black"><Smartphone className="h-5 w-5 text-cyan-200" />Turn on mobile notifications</DialogTitle>
            <DialogDescription className="leading-6 text-white/60">
              Get alerts from your installed Fantasy Arena app even when it is closed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm leading-6 text-white/75">
            We will notify you about tournament entry deadlines, live gameweeks, results and prizes, plus required replacement claims when one of your players leaves the Premier League.
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={snoozePrompt} className="border-white/15 bg-white/5 text-white hover:bg-white/10">Not now</Button>
            <Button type="button" onClick={() => enableMutation.mutate()} disabled={enableMutation.isPending} className="bg-cyan-300 font-black text-slate-950 hover:bg-cyan-200">
              {enableMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Enable notifications
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
