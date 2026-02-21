import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Bell, User as UserIcon, Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { queryClient } from "../lib/queryClient";

type NotificationItem = {
  id: number;
  userId: string;
  type: "win" | "runner_up" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

type UserProfile = {
  id: string;
  name?: string | null;
  email?: string | null;
  managerTeamName?: string | null;
};

export default function AccountPage() {
  const { toast } = useToast();

  const { data: user, isLoading: userLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user"],
  });

  const { data: inbox, isLoading: inboxLoading } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update notification");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update notifications");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Inbox updated", description: "All notifications marked as read." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not mark notifications as read.", variant: "destructive" });
    },
  });

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Account</h1>
          <p className="text-sm text-muted-foreground">Profile and inbox notifications for competition results.</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Inbox
              {!!inbox?.unreadCount && <Badge>{inbox.unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <Card className="p-5 space-y-3">
              {userLoading ? (
                <>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-5 w-56" />
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{user?.name || "Manager"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user?.email || "No email set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Team</p>
                    <p className="font-medium">{user?.managerTeamName || "Not set"}</p>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="inbox" className="mt-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Notifications</h2>
                <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
                  Mark all read
                </Button>
              </div>

              {inboxLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : inbox?.notifications?.length ? (
                <div className="space-y-3">
                  {inbox.notifications.map((note) => (
                    <div key={note.id} className={`rounded-lg border p-3 ${note.read ? "opacity-80" : "bg-primary/5"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{note.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{note.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {note.createdAt ? new Date(note.createdAt).toLocaleString() : ""}
                          </p>
                        </div>
                        {!note.read && (
                          <Button size="sm" variant="ghost" onClick={() => markOneMutation.mutate(note.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
