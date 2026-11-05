import fs from 'fs';

const clips = [
  { path: '/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/vo_v2_part1_stakes_captions.json', offsetMs: 200 },
  { path: '/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/vo_v2_part2_verticals_captions.json', offsetMs: 17700 },
  { path: '/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/vo_v2_part3_f1_captions.json', offsetMs: 38700 },
  { path: '/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/vo_v2_part4_governor_captions.json', offsetMs: 64700 },
  { path: '/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/vo_v2_part5_diligence_captions.json', offsetMs: 94700 },
];

let master = [];
for (const clip of clips) {
  const data = JSON.parse(fs.readFileSync(clip.path, 'utf8'));
  for (const word of data) {
    master.push({
      ...word,
      startMs: word.startMs + clip.offsetMs,
      endMs: word.endMs + clip.offsetMs,
      timestampMs: (word.timestampMs || word.startMs) + clip.offsetMs
    });
  }
}

fs.writeFileSync('/Users/udingethe/AdaL/Videos/fourcast-recall-demo/assets/master_captions.json', JSON.stringify(master, null, 2));
console.log('Merged', master.length, 'words into master_captions.json');
