import type {AssistantQuery} from './supportWalletSnapshot.js';
export async function searchCommunityMentions(q:AssistantQuery,actor:string,raw:string,prefix=false){
  const term=String(raw||'').trim().slice(0,40).replace(/[\\%_]/g,'\\$&');
  const pattern=(prefix?'':'%')+term+'%';
  return q(`WITH candidates AS (
    SELECT id,coalesce(is_banned,false) AS banned,
      coalesce(nullif(btrim(manager_team_name),''),nullif(btrim(name),'')) AS "teamName",
      left(regexp_replace(regexp_replace(btrim(coalesce(nullif(btrim(manager_team_name),''),nullif(btrim(name),''),split_part(coalesce(email,''),'@',1),'Arena Manager')),'[[:space:]]+','_','g'),'[^A-Za-z0-9_]','','g'),30) AS handle
    FROM app.users
  ), counted AS (SELECT *,count(*) OVER(PARTITION BY lower(handle)) AS matches FROM candidates)
  SELECT "teamName",handle,(matches>1) AS ambiguous FROM counted
  WHERE id<>$1 AND NOT banned AND "teamName" IS NOT NULL AND length(handle)>=2
    AND ("teamName" ILIKE $2 ESCAPE '\\' OR handle ILIKE $2 ESCAPE '\\')
  ORDER BY ambiguous,"teamName",handle LIMIT 8`,[actor,pattern]);
}
