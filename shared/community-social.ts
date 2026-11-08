export const COMMUNITY_REACTIONS = ['😂', '🔥', '👏', '❤️', '😮', '😢'] as const;
export const COMMUNITY_EMOJIS = ['😀', '😂', '🤣', '😍', '😎', '😭', '😮', '🙌', '👏', '🔥', '⚽', '🏆', '❤️', '💪', '🤦', '🍿'] as const;
// Self-hosted football GIFs: no third-party search, tracking or API key.
export const COMMUNITY_GIFS = [
  {id:'goal', label:'GOOOAL!'}, {id:'lol', label:'Too funny!'},
  {id:'var', label:'VAR… seriously?!'}, {id:'popcorn', label:'Here for the drama'},
] as const;
export function communityGif(id: unknown) {
  return typeof id === 'string' ? COMMUNITY_GIFS.find(gif => gif.id === id) || null : null;
}
export function communityReaction(emoji: unknown): emoji is typeof COMMUNITY_REACTIONS[number] {
  return typeof emoji === 'string' && (COMMUNITY_REACTIONS as readonly string[]).includes(emoji);
}
export type CommunityReactionCount = {emoji:string; count:number; mine:boolean};
