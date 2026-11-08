export function notificationQueryOptions(userId:unknown) {
  return {
    queryKey:['/api/notifications',String(userId||'anonymous')],
    enabled:Boolean(userId),
    queryFn:async({signal}:{signal:AbortSignal})=>{
      const response=await fetch('/api/notifications',{credentials:'include',signal});
      if(!response.ok)throw new Error('Notifications are temporarily unavailable');
      return response.json();
    },
    staleTime:10_000,
    refetchInterval:()=>document.visibilityState==='hidden'?false as const:20_000,
    refetchIntervalInBackground:false,
    refetchOnWindowFocus:true,
  };
}
