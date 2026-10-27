import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const directory = await mkdtemp(path.join(tmpdir(), "arena-entry-test-"));
try {
  const outfile = path.join(directory, "test.mjs");
  await build({stdin:{resolveDir:process.cwd(),contents:`
    import assert from 'node:assert/strict';
    import {validateTournamentRarityLineup} from './shared/game-rules';
    import {buildCardImageCandidates,toSafeImageUrl} from './client/src/lib/card-image';
    import {notificationDestination} from './client/src/lib/notifications';
    assert.equal(validateTournamentRarityLineup(['common','rare','unique','epic','legendary'],'common').valid,true);
    assert.equal(validateTournamentRarityLineup(['common','rare','unique','epic'],'common').valid,false);
    assert.equal(validateTournamentRarityLineup(['common','common','common','common','common'],'rare').valid,false);
    const verified={player:{identityVerified:true,apiFootballId:123,imageUrl:'/api/portrait/123'}};
    const candidates=buildCardImageCandidates(verified);
    assert(candidates[0].startsWith('https://arena.example/api/image-proxy?'));
    assert(candidates[0].includes('strict=1'));
    assert(candidates.includes('https://arena.example/api/portrait/123'));
    assert.equal(candidates.at(-1),'/players/fallback.svg');
    assert.deepEqual(buildCardImageCandidates({player:{imageUrl:'https://unverified.example/wrong.png'}}),['/players/fallback.svg']);
    assert.equal(toSafeImageUrl('/api/image-proxy?url=x'),'https://arena.example/api/image-proxy?url=x');
    for(const key of ['availability-reminder:2026-10-27:2h','player-availability:GW9:123:i','fixture-change:123']) assert.equal(notificationDestination({dedupeKey:key}),'/premier-league');
    assert.equal(notificationDestination({dedupeKey:'admin:entry-rejected:user:1:2026-10-27'}),'/admin');
    console.log('Entry recovery: mixed-rarity rules, verified image candidates, native API URLs and reminder deep links passed.');
  `},outfile,bundle:true,platform:"node",format:"esm",define:{'import.meta.env.VITE_API_URL':'"https://arena.example"','import.meta.env':'{}'}});
  execFileSync(process.execPath,[outfile],{stdio:"inherit"});
} finally {await rm(directory,{recursive:true,force:true});}
