'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const ROLES = ['Vocalist', 'Guitarist', 'Bassist', 'Drummer', 'Keys'];
const ROLE_ICONS = { Vocalist: '🎤', Guitarist: '🎸', Bassist: '🎵', Drummer: '🥁', Keys: '🎹' };

const VENUES = [
  { name: 'The Basement',    req: 0,       minSet: 3,  pay: 80,   fans: 100   },
  { name: 'The Crow Bar',    req: 1000,    minSet: 6,  pay: 200,  fans: 400   },
  { name: 'Midnight Stage',  req: 10000,   minSet: 10, pay: 500,  fans: 2000  },
  { name: 'The Rex Theater', req: 100000,  minSet: 15, pay: 1200, fans: 10000 },
  { name: 'City Arena',      req: 500000,  minSet: 20, pay: 3500, fans: 50000 },
];

const SOCIAL = [
  { name: 'Movie Night',    chem: 3,  cost: 0   },
  { name: 'Band Dinner',    chem: 5,  cost: 60  },
  { name: 'Go to a Show',   chem: 6,  cost: 40  },
  { name: 'Sports & Games', chem: 7,  cost: 20  },
  { name: 'Road Trip',      chem: 15, cost: 120 },
];

const TIER_CAPS = [0, 40, 70, 100]; // index = tier number

const ROLE_AVATARS = {
  'Vocalist':  'assets/singer.png',
  'Guitarist': 'assets/guitar_player.png',
  'Bassist':   'assets/bass player.png',
  'Drummer':   'assets/drummer.png',
  'Keys':      'assets/keyboarder.png',
};
const ROLE_AVATAR_DARK = new Set(['Guitarist', 'Bassist']);

const RIVAL_NAMES = [
  'The Static Kings', 'Dead Frequencies', 'Hollow Parade',
  'Neon Ghosts', 'Paper Tigers', 'Electric Shadows',
  'The Slow Burn', 'Bitter Signal', 'Chrome Parade', 'Glass Echoes',
];

const FIRST_NAMES = [
  'Alex','Jordan','Sam','Casey','Morgan','Riley','Taylor','Jamie','Drew','Avery',
  'Blake','Quinn','Sage','River','Charlie','Reese','Dakota','Hayden','Parker','Rowan',
  'Finley','Emery','Marlowe','Lennox','Sloane','Scout','Remy','Ellis','Wren','Elliot',
];
const LAST_NAMES = [
  'Cole','Reed','Hart','Stone','Blake','Chase','Flynn','Grant','Hayes','Knox',
  'Lane','Moore','Nash','Page','Ray','Scott','Shaw','Todd','Wade','West',
  'Cruz','Fox','Bell','Park','Kim','Carr','Dean','York','Ford','Banks',
];

const SONG_A = [
  'Electric','Midnight','Broken','Wild','Silent','Golden','Dark','Neon','Velvet','Paper',
  'Glass','Chrome','Hollow','Burning','Faded','Silver','Rusty','Loud','Blue','Static',
  'Painted','Wooden','Empty','Living','Dead','Bitter','Sweet','Slow','Fast','Cold',
];
const SONG_B = [
  'Heart','Road','Dream','Fire','Rain','City','Ghost','Sky','Storm','Light',
  'Star','Wave','Echo','Shadow','River','Machine','Kingdom','Parade','Curtain','Signal',
  'Anthem','Lullaby','Silence','Distance','Colour','Garden','Engine','Letter','Horizon','Mirror',
];

// ─── STATE ───────────────────────────────────────────────────────────────────

let gs = null;
let pendingEvents = [];
let weekLog = [];   // entries: { section, text, tone }
let draggedSongId = null;
let _uid = 1;

// ─── UTILS ───────────────────────────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function uid() { return _uid++; }

function randName() {
  return FIRST_NAMES[rand(0, FIRST_NAMES.length - 1)] + ' ' + LAST_NAMES[rand(0, LAST_NAMES.length - 1)];
}

function randSongTitle() {
  return SONG_A[rand(0, SONG_A.length - 1)] + ' ' + SONG_B[rand(0, SONG_B.length - 1)];
}

function fmtMoney(n) {
  return '$' + Math.floor(n).toLocaleString();
}

function fmtFollowers(n) {
  n = Math.floor(n);
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function chemLabel(v) {
  if (v <= 0)  return 'None';
  if (v <= 15) return 'Tense';
  if (v <= 30) return 'Awkward';
  if (v <= 45) return 'Ok';
  if (v <= 60) return 'Solid';
  if (v <= 79) return 'Tight';
  return 'On fire';
}

function skillLabel(v) {
  if (v <= 15) return 'Poor';
  if (v <= 30) return 'Below Avg';
  if (v <= 45) return 'Average';
  if (v <= 60) return 'Good';
  if (v <= 79) return 'Excellent';
  return 'Exceptional';
}

// ─── FORMULAS ────────────────────────────────────────────────────────────────

function chemMult(chem) {
  return 0.8 + (chem / 100) * 0.6;
}

function avgMemberSkill(skillKey) {
  if (!gs.members.length) return 0;
  return gs.members.reduce((acc, m) => acc + m[skillKey], 0) / gs.members.length;
}

function calcSongScore() {
  const chem = gs.members.length > 1 ? gs.chemistry : 0;
  const mult = chemMult(chem);
  const et = avgMemberSkill('technical') * mult;
  const es = avgMemberSkill('songwriting') * mult;
  const base = et * 0.3 + es * 0.4 + chem * 0.3;
  return clamp(Math.round(base + rand(-10, 10)), 1, 100);
}

function avgSetlistQuality() {
  if (!gs.setlist.length) return 0;
  const songs = gs.setlist.map(id => gs.songs.find(s => s.id === id)).filter(Boolean);
  if (!songs.length) return 0;
  return songs.reduce((acc, s) => acc + s.quality, 0) / songs.length;
}

function calcConcertResult(venue) {
  const chem = gs.members.length > 1 ? gs.chemistry : 0;
  const eff_stage = avgMemberSkill('stage') * chemMult(chem);
  const avgSetlist = avgSetlistQuality();

  const score = (1 + eff_stage  / 100 * 0.8)
              * (1 + chem       / 100 * 0.4)
              * (1 + Math.min(gs.followers / 1000000, 0.5))
              * (1 + avgSetlist / 100 * 0.5);

  return {
    income:    Math.round(venue.pay  * score),
    followers: Math.round(venue.fans * score),
    score,
  };
}

// ─── SKILL HELPERS ───────────────────────────────────────────────────────────

function gainSkill(member, skillKey, amount) {
  const tierKey = skillKey + 'Tier';
  const tier = member[tierKey] || 1;
  const cap = TIER_CAPS[tier];
  member[skillKey] = clamp(member[skillKey] + amount, 0, cap);
}

// ─── GAME INIT ────────────────────────────────────────────────────────────────

function startGame() {
  const input = document.getElementById('band-name-input');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  newGame(name);
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  render();
}

function newGame(bandName) {
  _uid = 1;
  const solo = makeMember('Vocalist', 12, 10, 10);
  gs = {
    bandName,
    week: 1,
    money: 500,
    followers: 0,
    chemistry: 50,
    chemistryTier: 1,
    members: [solo],
    songs: [],
    setlist: [],
    viralFired:             false,
    localPressFired:        false,
    gearSponsorFired:       false,
    creativeBreakthroughFired: false,
    mentorshipFired:        false,
    openingActFired:        false,
    radioPlayFired:         false,
    licensedFired:          false,
    merchDealFired:         false,
    scoutFired:             false,
    lastAnniversaryWeek:    0,
    concertsPlayed: 0,
    songsWritten:   0,
    bestSongScore:  0,
    lowChemWeeks:   0,
    rehearsalAction: 'performance',
    memberActions:   { [solo.id]: { type: 'practice' } },
    candidates:      [],
    ended:           false,
    rival: { name: RIVAL_NAMES[rand(0, RIVAL_NAMES.length - 1)], followers: 500 },
  };
  refreshCandidates();
  save();
}

function makeMember(role, tech, song, stage) {
  return {
    id: uid(),
    name: randName(),
    role,
    technical:  tech,
    songwriting: song,
    stage,
    technicalTier:   1,
    songwritingTier: 1,
    stageTier:       1,
    coWriteCount:    0,
    injuredWeeks:    0,
    paidLessonDone:  false,
  };
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────

function save() {
  try {
    localStorage.setItem('bandmgr_v1', JSON.stringify({ gs, _uid }));
  } catch (e) {}
}

function tryLoad() {
  try {
    const raw = localStorage.getItem('bandmgr_v1');
    if (!raw) return false;
    const data = JSON.parse(raw);
    gs   = data.gs;
    _uid = data._uid || 100;
    if (!gs.rival) gs.rival = { name: RIVAL_NAMES[rand(0, RIVAL_NAMES.length - 1)], followers: Math.max(500, gs.week * 80) };
    if (gs.lastAnniversaryWeek === undefined) gs.lastAnniversaryWeek = gs.week - (gs.week % 10);
    return true;
  } catch (e) { return false; }
}

// ─── REHEARSAL ────────────────────────────────────────────────────────────────

function setRehearsal(action) {
  gs.rehearsalAction = action;
  document.querySelectorAll('.rehearsal-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.action === action);
  });
}

// ─── MEMBER ACTIONS ───────────────────────────────────────────────────────────

function setMemberAction(memberId, actionType) {
  if (!gs.memberActions) gs.memberActions = {};
  gs.memberActions[memberId] = { type: actionType };
  renderRehearsalRoom();
}

function preSelectMemberActions() {
  gs.memberActions = {};
  gs.members.forEach(m => { gs.memberActions[m.id] = { type: 'practice' }; });
}

// ─── WEEK RESOLUTION ─────────────────────────────────────────────────────────

function confirmBandSlot(type, idx) {
  if (gs.ended) return;

  weekLog = [];
  const data = type === 'concert' ? VENUES[idx] : SOCIAL[idx];

  processMemberActions();
  processRehearsal();
  processBandSlot(type, data);
  tickRival();
  checkEvents();

  gs.week++;
  refreshCandidates();
  save();

  showWeekReport();
}

function log(section, text, tone) {
  weekLog.push({ section, text, tone: tone || 'neutral' });
}

function showWeekReport() {
  const sections = ['MEMBERS', 'REHEARSAL', 'TONIGHT', 'COMPETITION'];
  const bySection = {};
  sections.forEach(s => { bySection[s] = []; });
  weekLog.forEach(e => {
    if (bySection[e.section]) bySection[e.section].push(e);
  });

  const html = sections
    .filter(s => bySection[s].length)
    .map(s => `
      <div class="report-section">
        <div class="report-section-label">${s}</div>
        ${bySection[s].map(e => `<div class="report-entry ${e.tone}">${e.text}</div>`).join('')}
      </div>`)
    .join('');

  document.getElementById('report-title').textContent = `WEEK ${gs.week - 1} REPORT`;
  document.getElementById('report-body').innerHTML = html || '<div class="report-entry">A quiet week.</div>';
  document.getElementById('report-modal').classList.remove('hidden');
}

function dismissReport() {
  document.getElementById('report-modal').classList.add('hidden');
  if (pendingEvents.length) {
    showNextEvent();
  } else {
    render();
  }
}

function processMemberActions() {
  if (!gs.memberActions) return;

  // Pair up co-writers
  const cowriters = gs.members.filter(m => gs.memberActions[m.id]?.type === 'cowrite');
  const paired = new Set();
  for (let i = 0; i + 1 < cowriters.length; i += 2) {
    paired.add(cowriters[i].id);
    paired.add(cowriters[i + 1].id);
  }

  let trainerCount = 0;

  gs.members.forEach(m => {
    if (m.injuredWeeks > 0) {
      m.injuredWeeks--;
      log('MEMBERS', `${m.name} was injured — skipped training`, 'bad');
      return;
    }
    const action = gs.memberActions[m.id];
    if (!action) return;

    switch (action.type) {
      case 'practice':
        gainSkill(m, 'technical', rand(2, 4));
        log('MEMBERS', `${m.name} practiced — Technical improved`);
        trainerCount++;
        break;
      case 'lesson':
        if (gs.money >= 150) {
          gs.money -= 150;
          m.technicalTier = Math.max(m.technicalTier, 2);
          gainSkill(m, 'technical', rand(5, 8));
          log('MEMBERS', `${m.name} took a paid lesson (−$150) — Technical improved`);
          trainerCount++;
        }
        break;
      case 'write':
        gainSkill(m, 'songwriting', rand(2, 4));
        log('MEMBERS', `${m.name} wrote music — Songwriting improved`);
        trainerCount++;
        break;
      case 'cowrite':
        if (paired.has(m.id)) {
          gainSkill(m, 'songwriting', rand(3, 5));
          m.coWriteCount++;
          if (m.coWriteCount >= 3) m.songwritingTier = Math.max(m.songwritingTier, 2);
          log('MEMBERS', `${m.name} co-wrote with a bandmate — Songwriting improved`);
        } else {
          gainSkill(m, 'songwriting', rand(2, 4));
          log('MEMBERS', `${m.name} wrote music — Songwriting improved`);
        }
        trainerCount++;
        break;
      case 'busk': {
        gainSkill(m, 'stage', rand(2, 4));
        const busked = rand(20, 40);
        gs.money += busked;
        log('MEMBERS', `${m.name} busked — Stage improved, earned ${fmtMoney(busked)}`);
        trainerCount++;
        break;
      }
      case 'workshop':
        if (gs.money >= 80) {
          gs.money -= 80;
          gainSkill(m, 'stage', rand(5, 8));
          log('MEMBERS', `${m.name} attended a stage workshop (−$80) — Stage improved`);
          trainerCount++;
        }
        break;
    }
  });

  // Chemistry T2: unlock when 2+ members train in the same week
  if (trainerCount >= 2 && gs.chemistryTier < 2) {
    gs.chemistryTier = 2;
  }

  // Stage T2: 5+ concerts unlocks tier 2 for all members
  if (gs.concertsPlayed >= 5) {
    gs.members.forEach(m => { m.stageTier = Math.max(m.stageTier, 2); });
  }

  // Stage T3: tier-2 venue available (10k followers) and 10k+ followers
  if (gs.followers >= 10000) {
    gs.members.forEach(m => { m.stageTier = Math.max(m.stageTier, 3); });
  }
}

function processRehearsal() {
  if (!gs.rehearsalAction) return;

  switch (gs.rehearsalAction) {
    case 'learn': {
      const count = rand(2, 4);
      for (let i = 0; i < count; i++) {
        gs.songs.push({ id: uid(), title: randSongTitle(), type: 'cover', quality: rand(40, 60) });
      }
      log('REHEARSAL', `Learned ${count} new cover song${count > 1 ? 's' : ''}`, 'good');
      break;
    }
    case 'write': {
      const score = calcSongScore();
      const song = { id: uid(), title: randSongTitle(), type: 'original', quality: score };
      gs.songs.push(song);
      gs.songsWritten++;
      if (score > gs.bestSongScore) gs.bestSongScore = score;

      const tone = score < 35 ? 'bad' : 'good';
      log('REHEARSAL', `Wrote "${song.title}" — Quality: ${skillLabel(score)}`, tone);
      break;
    }
    case 'performance': {
      const stageGain = rand(2, 4);
      const chemGain  = rand(3, 6);
      gs.members.forEach(m => gainSkill(m, 'stage', stageGain));
      if (gs.members.length > 1) {
        gs.chemistry = clamp(gs.chemistry + chemGain, 0, TIER_CAPS[gs.chemistryTier]);
        log('REHEARSAL', `Worked on live performance — Stage improved for all, Chemistry +${chemGain}`, 'good');
      } else {
        log('REHEARSAL', `Worked on live performance — Stage improved`, 'good');
      }
      break;
    }
  }
}

function processBandSlot(type, data) {
  if (type === 'concert') {
    const result = calcConcertResult(data);
    gs.money     += result.income;
    gs.followers += result.followers;
    gs.concertsPlayed++;
    log('TONIGHT', `Played ${data.name} — earned ${fmtMoney(result.income)}, +${fmtFollowers(result.followers)} followers`, 'good');

    const originals = gs.setlist.map(id => gs.songs.find(s => s.id === id)).filter(s => s && s.type === 'original');
    if (originals.length && Math.random() < 0.01) {
      const song = originals[rand(0, originals.length - 1)];
      const qGain = rand(3, 5);
      const fGain = rand(75, 150);
      song.quality = clamp(song.quality + qGain, 1, 100);
      queueEvent({
        badge: 'GOING VIRAL',
        title: `"${song.title.toUpperCase()}" GOES VIRAL`,
        text: `A video of "${song.title}" took off online. The song sounds even better now. +${qGain} quality, +${fGain} followers.`,
        isBad: false,
        effect() { gs.followers += fGain; },
      });
    }

    const badSongs = gs.setlist.map(id => gs.songs.find(s => s.id === id)).filter(s => s && s.quality < 35);
    if (badSongs.length && Math.random() < 0.35) {
      const bad = badSongs[rand(0, badSongs.length - 1)];
      queueEvent({
        badge: 'BAD NEWS',
        title: 'BAD REVIEW',
        text: `"${bad.title}" gets torn apart by the press. Playing a weak song live drew attention to it. −5,000 followers.`,
        isBad: true,
        effect() { gs.followers = Math.max(0, gs.followers - 5000); },
      });
    }
  } else if (type === 'social') {
    if (gs.money >= data.cost) {
      gs.money -= data.cost;
      if (gs.members.length > 1) {
        gs.chemistry = clamp(gs.chemistry + data.chem, 0, TIER_CAPS[gs.chemistryTier]);
        log('TONIGHT', `${data.name} — Chemistry +${data.chem}${data.cost > 0 ? `, spent ${fmtMoney(data.cost)}` : ''}`, 'good');
      } else {
        log('TONIGHT', `${data.name}${data.cost > 0 ? ` — spent ${fmtMoney(data.cost)}` : ''}`, 'neutral');
      }
    }
  }
}

// ─── RIVAL ────────────────────────────────────────────────────────────────────

function tickRival() {
  const base = Math.floor(gs.rival.followers * 0.045 + rand(30, 100));
  const breakout = Math.random() < 0.05;
  gs.rival.followers += breakout ? Math.floor(base * 1.6) : base;
  if (breakout) {
    log('COMPETITION', `${gs.rival.name} had a breakout week.`, 'bad');
  }
}

// ─── RANDOM EVENTS ────────────────────────────────────────────────────────────

function checkEvents() {
  // Band argument: 8% per week, requires 2+ members
  if (gs.members.length >= 2 && Math.random() < 0.08) {
    queueEvent({
      badge: 'DRAMA',
      title: 'BAND ARGUMENT',
      text: 'Tensions boil over in the practice room. Everyone storms out. Chemistry −15.',
      isBad: true,
      effect() { gs.chemistry = Math.max(0, gs.chemistry - 15); },
    });
  }

  // Injury: 2% per member per week
  gs.members.forEach(m => {
    if (m.injuredWeeks === 0 && Math.random() < 0.005) {
      m.injuredWeeks = rand(1, 4);
      queueEvent({
        badge: 'SETBACK',
        title: 'INJURY',
        text: `${m.name} picked up an injury and can't train for ${m.injuredWeeks} week${m.injuredWeeks > 1 ? 's' : ''}.`,
        isBad: true,
        effect() {},
      });
    }
  });

  // Local press feature: fires once, followers 1k–50k
  if (!gs.localPressFired && gs.followers >= 1000 && gs.followers < 50000) {
    gs.localPressFired = true;
    queueEvent({
      badge: 'GOOD NEWS',
      title: 'LOCAL PRESS FEATURE',
      text: 'A local music blog ran a piece on the band. Exposure! +5,000 followers.',
      isBad: false,
      effect() { gs.followers += 5000; },
    });
  }

  // Viral moment: fires once, avg stage ≥ 60, after a concert
  if (!gs.viralFired && avgMemberSkill('stage') >= 60 && gs.concertsPlayed > 0) {
    gs.viralFired = true;
    queueEvent({
      badge: 'VIRAL',
      title: 'VIRAL MOMENT!',
      text: 'A clip from one of your shows blew up overnight. +100,000 followers and +$400.',
      isBad: false,
      effect() { gs.followers += 100000; gs.money += 400; },
    });
  }

  // Gear sponsor: fires once, best song score ≥ 70
  if (!gs.gearSponsorFired && gs.bestSongScore >= 70) {
    gs.gearSponsorFired = true;
    queueEvent({
      badge: 'SPONSORSHIP',
      title: 'GEAR SPONSOR',
      text: 'A gear brand wants to kit the band out for free. Technical tier 3 unlocked for everyone.',
      isBad: false,
      effect() { gs.members.forEach(m => { m.technicalTier = 3; }); },
    });
  }

  // Creative breakthrough: fires once, any member songwriting ≥ 65
  if (!gs.creativeBreakthroughFired) {
    const target = gs.members.find(m => m.songwriting >= 65);
    if (target) {
      gs.creativeBreakthroughFired = true;
      queueEvent({
        badge: 'BREAKTHROUGH',
        title: 'CREATIVE BREAKTHROUGH',
        text: `${target.name} hit a creative streak. +20 Songwriting.`,
        isBad: false,
        effect() { gainSkill(target, 'songwriting', 20); },
      });
    }
  }

  // Mentorship offer: fires once, 3+ originals written, avg original quality ≥ 75
  if (!gs.mentorshipFired && gs.songsWritten >= 3) {
    const originals = gs.songs.filter(s => s.type === 'original');
    const avgQ = originals.length
      ? originals.reduce((a, s) => a + s.quality, 0) / originals.length
      : 0;
    if (avgQ >= 75) {
      gs.mentorshipFired = true;
      queueEvent({
        badge: 'OPPORTUNITY',
        title: 'MENTORSHIP OFFER',
        text: 'A veteran songwriter offers guidance. Songwriting tier 3 unlocked for all members.',
        isBad: false,
        effect() { gs.members.forEach(m => { m.songwritingTier = 3; }); },
      });
    }
  }

  // Member quits: chemistry < 25 for 3+ consecutive weeks
  if (gs.members.length >= 2) {
    if (gs.chemistry < 25) {
      gs.lowChemWeeks++;
      if (gs.lowChemWeeks >= 3 && Math.random() < 0.10) {
        gs.lowChemWeeks = 0;
        const quitter = gs.members[gs.members.length - 1];
        queueEvent({
          badge: 'BAD NEWS',
          title: `${quitter.name.split(' ')[0].toUpperCase()} QUITS`,
          text: `${quitter.name} has had enough and walks out. The remaining members feel it. Chemistry −20.`,
          isBad: true,
          effect() {
            gs.members    = gs.members.filter(m => m.id !== quitter.id);
            gs.chemistry  = Math.max(0, gs.chemistry - 20);
          },
        });
      }
    } else {
      gs.lowChemWeeks = 0;
    }
  }

  // Opening act: fires once, followers 5k–200k
  if (!gs.openingActFired && gs.followers >= 5000 && gs.followers < 200000) {
    gs.openingActFired = true;
    queueEvent({
      badge: 'OPPORTUNITY',
      title: 'OPENING ACT OFFER',
      text: 'A touring band picks you to open their show. Big room, new ears. +8,000 followers, +$300.',
      isBad: false,
      effect() { gs.followers += 8000; gs.money += 300; },
    });
  }

  // Radio play: fires once, original with quality ≥ 65 and 5+ concerts played
  if (!gs.radioPlayFired && gs.concertsPlayed >= 5) {
    const radioSong = gs.songs.find(s => s.type === 'original' && s.quality >= 65);
    if (radioSong) {
      gs.radioPlayFired = true;
      queueEvent({
        badge: 'GOOD NEWS',
        title: 'RADIO PLAY',
        text: `"${radioSong.title}" got picked up by a local station. People are hearing you. +12,000 followers.`,
        isBad: false,
        effect() { gs.followers += 12000; },
      });
    }
  }

  // Sync license: fires once, best song score ≥ 80
  if (!gs.licensedFired && gs.bestSongScore >= 80) {
    const licensedSong = gs.songs.find(s => s.quality >= 80);
    const licTitle = licensedSong ? `"${licensedSong.title}"` : 'One of your songs';
    gs.licensedFired = true;
    queueEvent({
      badge: 'DEAL',
      title: 'SYNC LICENSE',
      text: `${licTitle} got licensed for a TV ad. You didn't even know it was that good. +$800.`,
      isBad: false,
      effect() { gs.money += 800; },
    });
  }

  // Merch windfall: fires once, followers ≥ 25k
  if (!gs.merchDealFired && gs.followers >= 25000) {
    gs.merchDealFired = true;
    queueEvent({
      badge: 'CASH',
      title: 'MERCH WINDFALL',
      text: 'The online store sold out overnight. Someone with a big following posted your shirt. +$500.',
      isBad: false,
      effect() { gs.money += 500; },
    });
  }

  // Label scout: fires once, followers ≥ 150k
  if (!gs.scoutFired && gs.followers >= 150000) {
    gs.scoutFired = true;
    queueEvent({
      badge: 'BUZZ',
      title: 'LABEL SCOUT',
      text: 'A major label scout showed up at your last show and took notes. The band is energised. Chemistry +10.',
      isBad: false,
      effect() { gs.chemistry = clamp(gs.chemistry + 10, 0, 100); },
    });
  }

  // Band anniversary: every 10 weeks
  if (gs.week % 10 === 0 && gs.week > gs.lastAnniversaryWeek) {
    gs.lastAnniversaryWeek = gs.week;
    queueEvent({
      badge: 'MILESTONE',
      title: `WEEK ${gs.week}`,
      text: `${gs.week} weeks in. You're still here, still grinding. The band feels it. Chemistry +8.`,
      isBad: false,
      effect() { gs.chemistry = clamp(gs.chemistry + 8, 0, 100); },
    });
  }

  // Gear stolen: 2% per week
  if (Math.random() < 0.02) {
    queueEvent({
      badge: 'BAD NEWS',
      title: 'GEAR STOLEN',
      text: 'Someone broke into the rehearsal space. An amp is gone. −$200.',
      isBad: true,
      effect() { gs.money = Math.max(0, gs.money - 200); },
    });
  }

  // Internet drama: 4% per week, 2+ members, followers > 5k
  if (gs.members.length >= 2 && gs.followers > 5000 && Math.random() < 0.04) {
    const culprit = gs.members[rand(0, gs.members.length - 1)];
    queueEvent({
      badge: 'DRAMA',
      title: 'INTERNET DRAMA',
      text: `${culprit.name} posted something and the internet did not take it well. −5,000 followers.`,
      isBad: true,
      effect() { gs.followers = Math.max(0, gs.followers - 5000); },
    });
  }

  // Superfan: 1.5% per week, followers > 500
  if (gs.followers > 500 && Math.random() < 0.015) {
    const gain = rand(1000, 3000);
    queueEvent({
      badge: 'FAN LOVE',
      title: 'SUPERFAN',
      text: `Someone online is going absolutely feral over your music and dragging everyone they know to listen. +${fmtFollowers(gain)} followers.`,
      isBad: false,
      effect() { gs.followers += gain; },
    });
  }

  // Food poisoning: 1% per week, 3+ members
  if (gs.members.length >= 3 && Math.random() < 0.01) {
    queueEvent({
      badge: 'SETBACK',
      title: 'FOOD POISONING',
      text: 'The whole band ate at the same sketchy food truck. Everyone is out for a week.',
      isBad: true,
      effect() { gs.members.forEach(m => { if (m.injuredWeeks === 0) m.injuredWeeks = 1; }); },
    });
  }

  // Win condition
  if (gs.followers >= 1000000 && !gs.ended) {
    gs.ended = true;
    queueEvent({
      badge: 'YOU WIN',
      title: 'LABEL DEAL',
      text: 'A major label wants to sign your band. One million followers and counting. You made it.',
      isBad: false,
      effect() { showEndScreen(); },
    });
  }

  // Loss condition: rival hits 1M first
  if (gs.rival.followers >= 1000000 && !gs.ended) {
    gs.ended = true;
    queueEvent({
      badge: 'GAME OVER',
      title: 'TOO LATE',
      text: `${gs.rival.name} just got signed. The label that had its eye on you signed them instead. The window has closed.`,
      isBad: true,
      effect() { showLossScreen(); },
    });
  }
}

function queueEvent(ev) { pendingEvents.push(ev); }

function showNextEvent() {
  const ev = pendingEvents[0];
  if (!ev) { render(); return; }

  if (ev.effect) { ev.effect(); ev.effect = null; save(); } // apply once, persist immediately

  const modal = document.getElementById('event-modal');
  document.getElementById('event-modal-type').textContent    = ev.badge || 'EVENT';
  document.getElementById('event-modal-title').textContent   = ev.title;
  document.getElementById('event-modal-content').textContent = ev.text;
  modal.classList.remove('hidden');

  const card = modal.querySelector('.modal-card');
  card.style.borderColor = ev.isBad ? '#a93226' : '#1a1a1a';
}

function dismissEvent() {
  pendingEvents.shift();
  document.getElementById('event-modal').classList.add('hidden');
  if (pendingEvents.length) {
    showNextEvent();
  } else {
    render();
  }
}

// ─── HIRING ──────────────────────────────────────────────────────────────────

function refreshCandidates() {
  if (!gs) return;

  const f = gs.followers;
  let count = 0, minS = 0, maxS = 0;

  if      (f >= 100000) { count = 4; minS = 40; maxS = 70; }
  else if (f >= 10000)  { count = 3; minS = 25; maxS = 50; }
  else if (f >= 1000)   { count = 2; minS = 15; maxS = 35; }
  else if (f >= 100)    { count = 1; minS = 10; maxS = 25; }
  else                  { gs.candidates = []; return; }

  const usedRoles  = new Set(gs.members.map(m => m.role));
  const availRoles = ROLES.filter(r => !usedRoles.has(r));
  if (!availRoles.length) { gs.candidates = []; return; }

  gs.candidates = [];
  for (let i = 0; i < Math.min(count, availRoles.length); i++) {
    gs.candidates.push({
      id:          uid(),
      name:        randName(),
      role:        availRoles[i],
      technical:   rand(minS, maxS),
      songwriting: rand(minS, maxS),
      stage:       rand(minS, maxS),
    });
  }
}

function openHireModal() {
  if (gs.members.length >= 5) { alert('Band is already full (5 members).'); return; }
  if (!gs.candidates || !gs.candidates.length) {
    alert('No musicians are interested yet. Grow your following first!');
    return;
  }
  renderHireModal();
  document.getElementById('hire-modal').classList.remove('hidden');
}

function closeHireModal() {
  document.getElementById('hire-modal').classList.add('hidden');
}

function hireCandidate(candidateId) {
  if (gs.money < 300) { alert('Not enough money. Hiring costs $300.'); return; }
  const c = gs.candidates.find(x => x.id === candidateId);
  if (!c) return;

  gs.money -= 300;
  const m = makeMember(c.role, c.technical, c.songwriting, c.stage);
  m.name = c.name;
  gs.members.push(m);
  gs.memberActions[m.id] = { type: 'practice' };
  gs.candidates = gs.candidates.filter(x => x.id !== candidateId);

  closeHireModal();
  save();
  render();
}

// ─── SETLIST ─────────────────────────────────────────────────────────────────

function addToSetlist(songId) {
  if (gs.setlist.includes(songId)) return;
  if (gs.setlist.length >= 20) return;
  gs.setlist.push(songId);
  renderSetlist();
  renderBandSlot();
  save();
}

function removeFromSetlist(songId) {
  gs.setlist = gs.setlist.filter(id => id !== songId);
  renderSetlist();
  renderBandSlot();
  save();
}

function toggleAvailableSongs() {
  const el  = document.getElementById('available-songs');
  const btn = document.getElementById('expand-btn');
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? '▼ SONG LIBRARY' : '▲ SONG LIBRARY';
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

function onDragStart(event, songId) {
  draggedSongId = songId;
  event.dataTransfer.effectAllowed = 'move';
}

function dropOnSetlist(event) {
  event.preventDefault();
  if (draggedSongId !== null) addToSetlist(draggedSongId);
  draggedSongId = null;
}

function dropOnAvailable(event) {
  event.preventDefault();
  if (draggedSongId !== null) removeFromSetlist(draggedSongId);
  draggedSongId = null;
}

// ─── RENDERING ───────────────────────────────────────────────────────────────

function render() {
  if (!gs) return;

  document.getElementById('band-name-display').textContent = gs.bandName;
  document.getElementById('week-number').textContent       = gs.week;
  document.getElementById('follower-count-display').textContent = fmtFollowers(gs.followers);
  document.getElementById('money-display').textContent          = fmtMoney(gs.money);

  const hireBtn = document.getElementById('hire-btn');
  hireBtn.disabled = gs.members.length >= 5;

  renderRehearsalRoom();
  renderSetlist();
  renderBandSlot();
  renderRival();
}

function renderRehearsalRoom() {
  document.getElementById('members-area').innerHTML = gs.members.map(renderMember).join('');

  const chem = gs.members.length > 1 ? gs.chemistry : null;
  document.getElementById('chemistry-display').innerHTML = chem !== null
    ? `BAND CHEMISTRY — <span>${chemLabel(chem)}</span>`
    : '';

  document.querySelectorAll('.rehearsal-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.action === gs.rehearsalAction);
  });
}

function renderMember(m) {
  const injured   = m.injuredWeeks > 0;
  const sel       = gs.memberActions?.[m.id]?.type;
  const canCowrite  = gs.members.length >= 2;
  const canLesson   = gs.money >= 150;
  const canWorkshop = gs.money >= 80;

  const actions = [
    { type:'practice', label:'Practice',  sub:'Technical',        tip: null },
    { type:'lesson',   label:'Lesson',    sub:'Technical · $150', tip: !canLesson ? 'Not enough money ($150)' : null },
    { type:'write',    label:'Write',     sub:'Songwriting',      tip: null },
    { type:'cowrite',  label:'Co-write',  sub:'Songwriting · 2x', tip: !canCowrite ? 'Requires 2+ members' : null },
    { type:'busk',     label:'Busk',      sub:'Stage + $',        tip: null },
    { type:'workshop', label:'Workshop',  sub:'Stage · $80',      tip: !canWorkshop ? 'Not enough money ($80)' : null },
  ];

  const btns = actions.map(a => {
    const isSelected = sel === a.type;
    const dis = (a.tip !== null) || injured;
    const tipAttr = dis ? `data-tip="${injured && !a.tip ? 'Member is injured' : a.tip || 'Member is injured'}"` : '';
    return `<button class="action-btn ${isSelected ? 'selected' : ''}"
              onclick="setMemberAction(${m.id}, '${a.type}')"
              ${dis ? 'disabled' : ''} ${tipAttr}>
              ${a.label}<span class="action-cost"> · ${a.sub}</span>
            </button>`;
  }).join('');

  return `
    <div class="member-card">
      <div class="member-avatar-wrap">
        <img class="member-avatar" src="${ROLE_AVATARS[m.role]}" alt="${m.role}">
        ${injured ? `<div class="injured-overlay">INJURED<br>${m.injuredWeeks}w left</div>` : ''}
      </div>
      <div class="member-info">
        <div class="member-name">${m.name}
          <div class="stat-tooltip">
            <div class="stat-row"><span>Technical</span><span>${skillLabel(m.technical)}</span></div>
            <div class="stat-row"><span>Songwriting</span><span>${skillLabel(m.songwriting)}</span></div>
            <div class="stat-row"><span>Stage</span><span>${skillLabel(m.stage)}</span></div>
          </div>
        </div>
        <div class="member-role">${m.role.toUpperCase()}</div>
      </div>
      <div class="action-grid">${btns}</div>
    </div>`;
}

function renderSetlist() {
  const setlistEl   = document.getElementById('setlist-songs');
  const availableEl = document.getElementById('available-songs');
  const countEl     = document.getElementById('setlist-count');

  const inSetlist  = gs.setlist.map(id => gs.songs.find(s => s.id === id)).filter(Boolean);
  const available  = gs.songs.filter(s => !gs.setlist.includes(s.id));

  countEl.textContent = `${inSetlist.length} / 20`;

  setlistEl.innerHTML = inSetlist.length
    ? inSetlist.map(s => songItem(s, true)).join('')
    : '<div class="drop-hint">Drag songs here</div>';

  availableEl.innerHTML = available.length
    ? available.map(s => songItem(s, false)).join('')
    : '<div class="drop-hint">No songs yet</div>';
}

function songItem(song, inSetlist) {
  const typeLabel = song.type === 'cover' ? 'CVR' : 'ORI';
  return `<div class="song-item" draggable="true"
               ondragstart="onDragStart(event, ${song.id})"
               ondblclick="${inSetlist ? `removeFromSetlist(${song.id})` : `addToSetlist(${song.id})`}"
               title="Double-click to ${inSetlist ? 'remove' : 'add'}">
            <span class="song-type ${song.type}">${typeLabel}</span>
            <span class="song-title">${song.title}</span>
            <span class="song-quality">${skillLabel(song.quality)}</span>
          </div>`;
}

function renderBandSlot() {
  const venueEl  = document.getElementById('venues-list');
  const socialEl = document.getElementById('social-list');

  const availableMembers = gs.members.filter(m => m.injuredWeeks === 0).length;

  venueEl.innerHTML = VENUES.map((v, i) => {
    const unlocked    = gs.followers >= v.req;
    const enoughSongs = gs.setlist.length >= v.minSet;
    const hasPlayers  = availableMembers >= 1;
    const dis         = !unlocked || !enoughSongs || !hasPlayers;
    const result      = calcConcertResult(v);
    const hint        = !unlocked
      ? fmtFollowers(v.req) + ' followers required'
      : !enoughSongs
        ? `${v.minSet} songs on setlist required`
        : `${fmtMoney(result.income)} · +${fmtFollowers(result.followers)}`;
    const tip = !hasPlayers
      ? 'No available members — everyone is injured'
      : !unlocked
        ? `Need ${fmtFollowers(v.req)} followers to unlock`
        : !enoughSongs
          ? `Need ${v.minSet} songs on your setlist`
          : null;
    return `<button class="venue-btn" onclick="confirmBandSlot('concert', ${i})"
              ${dis ? 'disabled' : ''} ${tip ? `data-tip="${tip}"` : ''}>
              <span class="venue-name">${v.name}</span>
              <span class="venue-req">${hint}</span>
            </button>`;
  }).join('');

  const hasBand = gs.members.length >= 2;
  const socialBtns = SOCIAL.map((a, i) => {
    const canAfford = gs.money >= a.cost;
    const needsBand = a.name !== 'Movie Night';
    const dis       = (needsBand && !hasBand) || !canAfford;
    const tip       = !canAfford
      ? `Not enough money (${fmtMoney(a.cost)} required)`
      : (needsBand && !hasBand)
        ? 'Requires 2+ band members'
        : null;
    return `<button class="social-btn" onclick="confirmBandSlot('social', ${i})"
              ${dis ? 'disabled' : ''} ${tip ? `data-tip="${tip}"` : ''}>
              <span class="social-name">${a.name}</span>
              <span class="social-detail">+${a.chem} chemistry${a.cost > 0 ? ' · ' + fmtMoney(a.cost) : ' · Free'}</span>
            </button>`;
  }).join('');

  socialEl.innerHTML = `<div class="slot-section-label">— OR HANG OUT —</div>` + socialBtns;
}

function renderHireModal() {
  const el = document.getElementById('hire-candidates');
  if (!gs.candidates?.length) {
    el.innerHTML = '<p style="color:#777;font-size:12px">No musicians interested yet. Grow your following.</p>';
    return;
  }
  el.innerHTML = gs.candidates.map(c =>
    `<div class="candidate-card">
       <div class="candidate-header">${c.name} <span style="color:#777;font-weight:normal">· ${c.role}</span></div>
       <div class="candidate-skills">Tech: ${skillLabel(c.technical)} · Song: ${skillLabel(c.songwriting)} · Stage: ${skillLabel(c.stage)}</div>
       <button onclick="hireCandidate(${c.id})" ${gs.money < 300 ? 'disabled' : ''}>HIRE ($300)</button>
     </div>`
  ).join('');
}

function showEndScreen() {
  document.getElementById('end-stats').innerHTML = [
    ['WEEKS PLAYED',    gs.week],
    ['SONGS WRITTEN',   gs.songsWritten],
    ['BEST SONG',       gs.bestSongScore + ' / 100'],
    ['FINAL FOLLOWERS', fmtFollowers(gs.followers)],
    ['BAND SIZE',       gs.members.length + ' members'],
  ].map(([label, val]) =>
    `<div class="end-stat"><span>${label}</span><strong>${val}</strong></div>`
  ).join('');

  document.getElementById('end-screen').classList.remove('hidden');
  localStorage.removeItem('bandmgr_v1');
}

function showLossScreen() {
  document.getElementById('loss-rival-name').textContent = gs.rival.name;
  document.getElementById('loss-stats').innerHTML = [
    ['WEEKS PLAYED',    gs.week],
    ['YOUR FOLLOWERS',  fmtFollowers(gs.followers)],
    ['THEIR FOLLOWERS', fmtFollowers(gs.rival.followers)],
    ['SONGS WRITTEN',   gs.songsWritten],
  ].map(([label, val]) =>
    `<div class="end-stat"><span>${label}</span><strong>${val}</strong></div>`
  ).join('');

  document.getElementById('loss-screen').classList.remove('hidden');
  localStorage.removeItem('bandmgr_v1');
}

function renderRival() {
  if (!gs.rival) return;
  document.getElementById('rival-name-display').textContent      = gs.rival.name;
  document.getElementById('rival-followers-display').textContent = fmtFollowers(gs.rival.followers);
  const ahead = gs.rival.followers > gs.followers;
  document.getElementById('rival-display').classList.toggle('rival-ahead', ahead);
}

// ─── MUSIC ───────────────────────────────────────────────────────────────────

function toggleMusic() {
  const audio = document.getElementById('title-music');
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function toggleSettings() {
  document.getElementById('settings-menu').classList.toggle('hidden');
}

function resetGame(skipConfirm) {
  if (!skipConfirm && !confirm('Reset everything and start over?')) return;
  localStorage.removeItem('bandmgr_v1');
  location.reload(); // page reload re-triggers DOMContentLoaded which handles music
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  // Video cycling on setup screen
  const setupVideos = ['assets/rock_show1.mp4', 'assets/rock_show2.mp4'];
  let setupVideoIdx = 0;
  const setupVideo = document.getElementById('setup-video');
  setupVideo.src = setupVideos[0];
  setupVideo.addEventListener('ended', () => {
    setupVideoIdx = (setupVideoIdx + 1) % setupVideos.length;
    setupVideo.src = setupVideos[setupVideoIdx];
    setupVideo.play().catch(() => {});
  });

  const titleMusic = document.getElementById('title-music');

  function syncMusicBtn() {
    const btn = document.getElementById('music-btn');
    if (btn) btn.textContent = titleMusic.paused ? '▶' : '⏸';
  }
  titleMusic.addEventListener('play',  syncMusicBtn);
  titleMusic.addEventListener('pause', syncMusicBtn);

  function playTitleMusic() {
    titleMusic.play().catch(() => {});
  }

  if (tryLoad() && gs && !gs.ended) {
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    render();
  } else {
    // Start music when video autoplays (muted video autoplay is allowed; audio piggybacks on it)
    setupVideo.addEventListener('play', () => { titleMusic.play().catch(() => {}); }, { once: true });
    // Fallback: first user interaction
    document.addEventListener('click',   playTitleMusic, { once: true });
    document.addEventListener('keydown', playTitleMusic, { once: true });
  }

  document.getElementById('band-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });

  const tooltip = document.getElementById('tooltip');

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el?.dataset.tip) {
      tooltip.textContent = el.dataset.tip;
      tooltip.style.display = 'block';
    }
  });

  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget?.closest?.('[data-tip]')) {
      tooltip.style.display = 'none';
    }
  });

  document.addEventListener('mousemove', e => {
    if (tooltip.style.display === 'block') {
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 36) + 'px';
    }
  });

  document.addEventListener('click', e => {
    const menu = document.getElementById('settings-menu');
    const btn  = document.getElementById('settings-btn');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btn) {
      menu.classList.add('hidden');
    }
  });
});
