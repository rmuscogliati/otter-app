// ======= defaults.js — STARTING data only. Everything here is editable in the app. =======
// Privacy: no research-idea text may ever be placed in this file (ideas arrive only via
// "Import ideas from file" or a backup import, both on the device).

const Defaults = (() => {
  const task = (id, time, endTime, title, desc, areaId, o = {}) => ({
    id, srcId: id, time, endTime, title, desc: desc || '', areaId: areaId || null,
    core: !!o.core, optional: !!o.optional, infoOnly: !!o.info,
    xp: o.info ? 0 : (o.xp ?? 10), tag: o.tag || '', ...(o.wt ? { workoutTemplateId: o.wt } : {})
  });

  const areas = [
    { id: 'a1', name: 'Gym', color: '#E8590C', mascot: 'jaguar', icon: 'ph-barbell', order: 1, streakType: 'weekly', measure: 'tasks', target: 4, restDays: [], workingDaysOnly: false },
    { id: 'a2', name: 'Research', color: '#1C7ED6', mascot: 'anteater', icon: 'ph-flask', order: 2, streakType: 'weekly', measure: 'tasks', target: 3, restDays: [], workingDaysOnly: false },
    { id: 'a3', name: 'Clinical work', color: '#0CA678', mascot: 'capybara', icon: 'ph-stethoscope', order: 3, streakType: 'daily', measure: 'tasks', target: 1, restDays: [], workingDaysOnly: true },
    { id: 'a4', name: 'Medical study', color: '#7048E8', mascot: 'tamarin', icon: 'ph-book-open-text', order: 4, streakType: 'weekly', measure: 'tasks', target: 3, restDays: [], workingDaysOnly: false },
    { id: 'a5', name: 'MedTwins', color: '#D6336C', mascot: 'toucan', icon: 'ph-video-camera', order: 5, streakType: 'weekly', measure: 'tasks', target: 1, restDays: [], workingDaysOnly: false },
    { id: 'a6', name: 'German', color: '#E8A400', mascot: 'macaw', icon: 'ph-translate', order: 6, streakType: 'daily', measure: 'tasks', target: 1, restDays: [], workingDaysOnly: false }
  ].map(a => ({ ...a, pebblesStart: 0, protectWithModes: true, paused: false, archived: false, messages: null }));

  // Accelerated German plan (B1 → B2/C1, speaking and writing first, about 19 h 15 a week):
  // every day Anki, ChatGPT speaking, writing and LingQ; Goethe lesson Tuesday 18:00–19:30.
  // Per day: [speaking min, writing min, resources title, resources detail, LingQ title].
  const german = {
    0: [30, 30, 'Goethe exercises + short story', '30 min Goethe exercises, then 25 min short story. Retell the story in your next speaking session.', 'LingQ: favourite content'],
    1: [25, 25, 'Goethe exercises', '', 'LingQ: news + audio'],
    2: [20, 20, '', '', 'LingQ: video / audio'],
    3: [25, 25, 'Grammar book + short story', '20 min grammar book, then 15 min short story. Retell the story in your next speaking session.', 'LingQ: news + audio'],
    4: [25, 25, 'Grammar book: recurring errors', 'Focus on the errors that keep coming back', 'LingQ: video / audio'],
    5: [25, 25, 'Goethe exercises: difficult tasks', 'Review the tasks you found hard', 'LingQ: news + audio'],
    6: [30, 30, 'Goethe exercises: exam skills', 'Rotate the exam skills (reading, listening, writing, speaking)', 'LingQ: video / audio']
  };
  const SPEAK = 'ChatGPT Voice: "Speak German with me at B1-B2 level. Ask one question at a time. Let me finish, then correct my three main errors and ask me to repeat the corrected sentences." End by retelling the topic without notes.';
  const WRITE = 'About half writing, half correcting and rewriting: a short email, an opinion or a Goethe task.';
  const LINGQ = 'Read and listen to the same item, then give a brief spoken summary.';
  const ANKI = 'Reviews take 30–45 min. Finished in 30? Use the rest for speaking or correcting writing.';
  // Fitness plan: 3 gym + 3 easy cardio sessions, Thursday rest. Lifts 12 / 10 / 8, abs 3 × 25 or controlled max.
  const CARDIO_EASY = 'Easy: effort 3–4/10, full sentences possible. Weeks 1–2: 25 min · weeks 3–4: 30 min · then 35 → 40 → 45 min (1–2+ weeks per stage).';
  const CARDIO_LONG = 'Easy, longer. Weeks 1–2: 30 min · weeks 3–4: 35 min · then 40 → 45 → 60 min. After 4 consistent weeks, optional: 8 min warm-up, 4 × (1 min at 7/10 + 2 min easy), 5 min cool-down.';
  const gymWeek = {
    1: ['Gym — Train A (Push) + abs', 'Bench, incline bench, shoulder press, lateral raises, dips or triceps pulldown, abs · 12/10/8, 1–2 reps in reserve', 'wt_a'],
    3: ['Gym — Train B (Pull) + abs', 'Deadlift, lat pulldown or pull-up, chin-up or close-grip pulldown, seated row, biceps curls, abs · 12/10/8', 'wt_b'],
    5: ['Gym — Train C (Legs)', 'Leg press, lunges (per leg), leg extension, leg curls, calf raises · 12/10/8', 'wt_c']
  };
  // The German study block (Anki → speaking → break → writing → break → [resources] → LingQ) from a start time.
  function germanBlock(p, dw, start) {
    const [sp, wr, res, resDesc, lq] = german[dw];
    const out = [];
    let m = U.toMin(start);
    const add = (key, mins, title, desc, areaId, o) => { out.push(task(p + key, U.fromMin(m), U.fromMin(m + mins), title, desc, areaId, o)); m += mins; };
    add('anki', 45, 'Anki', ANKI, 'a6', { core: true, xp: 15 });
    add('speak', sp, `Speaking (${sp} min)`, SPEAK, 'a6', { xp: 15, tag: 'speaking' });
    add('brk1', dw === 0 || dw === 6 ? 10 : 5, 'Break', '', null, { info: true, tag: 'downtime' });
    add('write', wr, `Writing (${wr} min)`, WRITE, 'a6', { xp: 15 });
    add('brk2', dw === 2 ? 5 : 10, 'Break', '', null, { info: true, tag: 'downtime' });
    if (res) add('res', dw === 0 || dw === 6 ? 55 : 35, res, resDesc, 'a6', { xp: 15 });
    add('lingq', 20, lq, LINGQ, 'a6', { xp: 10 });
    return out;
  }
  // Work 09:00–17:00 Monday to Thursday; Friday is a non-clinical day (German first, then research and study).
  function weekdayTasks(dw) {
    const p = `w${dw}_`, gw = gymWeek[dw];
    if (dw === 5) return fridayTasks(p, gw);
    const list = [
      task(p + 'ward', '09:00', '12:00', 'Ward round', 'Write your jobs list after the round', 'a3', { info: true, tag: 'ward' }),
      task(p + 'lunch', '12:00', '13:00', 'Lunch break', '', null, { info: true, tag: 'downtime' }),
      task(p + 'clin', '13:00', '17:00', 'Clinical work', '', 'a3', { info: true }),
      task(p + 'travel', '17:00', '17:40', 'Travel home', '', null, { info: true, tag: 'downtime' }),
      task(p + 'wind', '23:30', '24:00', 'Wind down', 'Prepare for bed, sleep at midnight (aim for 7–9 h of sleep)', null, { tag: 'downtime' })
    ];
    if (dw === 2) {
      list.push(
        task(p + 'settle', '17:40', '18:00', 'Snack and prepare for class', 'Allow travel time if in person', null, { info: true, tag: 'downtime' }),
        task(p + 'goethe', '18:00', '19:30', 'Goethe lesson', 'Covers the day\'s Goethe / grammar slot', 'a6', { xp: 30, tag: 'speaking' }),
        task(p + 'dinner', '19:30', '20:00', 'Dinner', '', null, { info: true, tag: 'downtime' }),
        ...germanBlock(p, dw, '20:00'),
        task(p + 'gym', '21:55', '22:20', 'Easy walk (Tuesday cardio)', CARDIO_EASY, 'a1', { core: true, xp: 30, tag: 'gym', wt: 'wt_cardio' }),
        task(p + 'free', '22:20', '23:30', 'Free time', 'Partner, hobbies, projects', null, { info: true, tag: 'downtime' }));
    } else {
      list.push(
        task(p + 'settle', '17:40', '18:10', 'Snack and reset', '', null, { info: true, tag: 'downtime' }),
        gw ? task(p + 'gym', '18:10', '19:30', gw[0], gw[1], 'a1', { core: true, xp: 30, tag: 'gym', wt: gw[2] })
          : task(p + 'rest', '18:10', '19:30', 'Rest day', 'No gym or cardio today. Ordinary comfortable movement is enough.', null, { info: true, tag: 'downtime' }),
        task(p + 'dinner', '19:30', '20:15', 'Dinner and shower', '', null, { info: true, tag: 'downtime' }),
        ...germanBlock(p, dw, '20:15'),
        task(p + 'free', '23:00', '23:30', 'Free time', 'Partner, hobbies, projects', null, { info: true, tag: 'downtime' }));
    }
    return list.sort(U.by(t => t.time));
  }
  function fridayTasks(p, gw) {
    return [
      ...germanBlock(p, 5, '09:00'),
      task(p + 'brk3', '11:45', '12:00', 'Break', '', null, { info: true, tag: 'downtime' }),
      task(p + 'lunch', '12:00', '13:00', 'Lunch break', '', null, { info: true, tag: 'downtime' }),
      task(p + 'research', '13:00', '15:00', 'Research block', 'Next action on an active project (Research tab)', 'a2', { xp: 30 }),
      task(p + 'brk4', '15:00', '15:15', 'Break', '', null, { info: true, tag: 'downtime' }),
      task(p + 'study', '15:15', '16:45', 'Study block', 'Question bank or topic reviews: Osmosis, Passmed, PasTest, Quesmed, eMRCS, anatomy flashcards', 'a4', { xp: 30 }),
      task(p + 'free', '16:45', '18:10', 'Free time', '', null, { info: true, tag: 'downtime' }),
      task(p + 'gym', '18:10', '19:30', gw[0], gw[1], 'a1', { core: true, xp: 30, tag: 'gym', wt: gw[2] }),
      task(p + 'dinner', '19:30', '20:15', 'Dinner and shower', '', null, { info: true, tag: 'downtime' }),
      task(p + 'free2', '20:15', '23:30', 'Free time', 'Partner, hobbies, projects', null, { info: true, tag: 'downtime' }),
      task(p + 'wind', '23:30', '24:00', 'Wind down', 'Prepare for bed, sleep at midnight (aim for 7–9 h of sleep)', null, { tag: 'downtime' })
    ].sort(U.by(t => t.time));
  }
  function weekendTasks(dw) {
    const p = dw === 6 ? 'sat_' : 'sun_';
    const list = germanBlock(p, dw, '10:00');
    if (dw === 6) list.push(task(p + 'gym', '16:00', '16:30', 'Easy bike or walk', 'Especially gentle. ' + CARDIO_EASY, 'a1', { core: true, xp: 30, tag: 'gym', wt: 'wt_cardio' }));
    if (dw === 0) list.push(
      task(p + 'gym', '16:00', '16:45', 'Longer outdoor cardio', CARDIO_LONG, 'a1', { core: true, xp: 30, tag: 'gym', wt: 'wt_cardio' }),
      task(p + 'review', '18:00', '18:30', 'Weekly review', 'Otto guides you through it', null, { xp: 20, tag: 'review' }),
      task(p + 'fitcheck', '18:30', '18:45', 'Fitness check-in', 'Waist; 7-day average of morning weight; weekly steps and cardio minutes; sleep (aim 7–9 h). Every 2 weeks: no change for 2–3 weeks → eat 100–150 kcal/day less OR walk about 1,000 more steps a day (one change at a time); losing over 0.75%/week for 2 weeks → eat 100–200 kcal/day more.', 'a1', { xp: 10 }));
    return list.sort(U.by(t => t.time));
  }
  // After a difficult shift: Anki stays (aim for 30 min), plus 10 min each of speaking, writing and LingQ.
  const shortGerman = [
    task('sg_speak', '21:00', '21:10', 'Speaking (10 min)', SPEAK, 'a6', { xp: 10, tag: 'speaking' }),
    task('sg_write', '21:10', '21:20', 'Writing (10 min)', WRITE, 'a6', { xp: 10 }),
    task('sg_lingq', '21:20', '21:30', 'LingQ (10 min)', LINGQ, 'a6', { xp: 10 })
  ];

  const dayTemplates = [
    ...[1, 2, 3, 4].map(dw => ({ id: `tpl_d${dw}`, name: `Workday 9–5 (${U.DOW3[dw]})`, modeId: 'm_normal', tasks: weekdayTasks(dw) })),
    { id: 'tpl_d5', name: 'Friday (German, research, study)', modeId: 'm_normal', tasks: weekdayTasks(5) },
    { id: 'tpl_d6', name: 'Weekend (Saturday)', modeId: 'm_normal', tasks: weekendTasks(6) },
    { id: 'tpl_d0', name: 'Weekend (Sunday)', modeId: 'm_normal', tasks: weekendTasks(0) },
    { id: 'tpl_dayoff', name: 'Day off', modeId: 'm_dayoff', tasks: [
      task('off_anki', '10:00', '10:15', 'Anki', 'Due reviews', 'a6', { core: true, xp: 15 }),
      task('off_gym', '11:00', '12:30', 'Gym or rest day', '', 'a1', { optional: true, xp: 30, tag: 'gym' }),
      task('off_enjoy', '16:00', '16:45', 'Enjoyable German reading or watching', '', 'a6'),
      task('off_free', '19:00', '23:00', 'Free time', '', null, { info: true, tag: 'downtime' })] },
    { id: 'tpl_oncall', name: 'On-call / night shift', modeId: 'm_night', tasks: [
      task('oc_shift', '20:00', '24:00', 'Shift', 'Look after yourself first', 'a3', { info: true }),
      task('oc_anki', '17:00', '17:05', '5 min Anki (if you can)', '', 'a6', { optional: true, xp: 5 })] },
    { id: 'tpl_study', name: 'Study day', modeId: 'm_normal', tasks: [
      task('st_anki', '08:30', '08:45', 'Anki', 'Due reviews', 'a6', { core: true, xp: 15 }),
      task('st_s1', '09:00', '12:00', 'Study block', 'Topic map / question bank', 'a4', { xp: 30 }),
      task('st_lunch', '12:00', '13:00', 'Lunch break', '', null, { info: true, tag: 'downtime' }),
      task('st_s2', '13:00', '16:00', 'Study block', 'Spaced reviews and weak topics', 'a4', { xp: 30 }),
      task('st_gym', '17:00', '18:30', 'Gym', '', 'a1', { core: true, xp: 30, tag: 'gym' })] },
    { id: 'tpl_minimum', name: 'Minimum routine', modeId: 'm_minimum', tasks: [
      task('min_anki', '20:30', '20:35', '5 min Anki', 'Just the due cards you can manage', 'a6', { core: true, xp: 10 }),
      task('min_german', '20:35', '20:40', '5 min easy German', 'A podcast, a song, anything light', 'a6', { core: true, xp: 10 })] },
    { id: 'tpl_goethe', name: 'Live Goethe class (evening)', modeId: 'm_goethe', tasks: [
      task('goe_class', '19:00', '21:15', 'Live Goethe class', 'Replaces the evening German study blocks', 'a6', { xp: 30, tag: 'speaking' })] },
    { id: 'tpl_shortgerman', name: 'Short German (after a difficult shift)', modeId: 'm_shortgerman', tasks: shortGerman }
  ].map(t => ({ ...t, kind: 'day' }));

  const weekPlans = [{ id: 'wp_normal', name: 'Normal term', days: { 0: 'tpl_d0', 1: 'tpl_d1', 2: 'tpl_d2', 3: 'tpl_d3', 4: 'tpl_d4', 5: 'tpl_d5', 6: 'tpl_d6' } }];

  // action: 'none' keeps the day's plan; 'replace' swaps in templateId; 'replaceArea' keeps everything
  // except that area's non-core tasks, then adds templateId's tasks.
  const modes = [
    { id: 'm_normal', name: 'Normal', action: 'none', templateId: '', areaId: '', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-sun' },
    { id: 'm_minimum', name: 'Minimum routine', action: 'replace', templateId: 'tpl_minimum', areaId: '', protectsStreak: false, isMinimum: true, quiet: false, nonWorking: false, icon: 'ph-moon' },
    { id: 'm_goethe', name: 'Live Goethe class', action: 'replaceArea', templateId: 'tpl_goethe', areaId: 'a6', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-chalkboard-teacher' },
    { id: 'm_shortgerman', name: 'Short German (difficult shift)', action: 'replaceArea', templateId: 'tpl_shortgerman', areaId: 'a6', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-battery-low' },
    { id: 'm_night', name: 'Night shift / on-call', action: 'replace', templateId: 'tpl_oncall', areaId: '', protectsStreak: true, isMinimum: false, quiet: true, nonWorking: false, icon: 'ph-flashlight' },
    { id: 'm_dayoff', name: 'Day off / weekend', action: 'replace', templateId: 'tpl_dayoff', areaId: '', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: true, icon: 'ph-umbrella' },
    { id: 'm_recovery', name: 'Recovery week', action: 'none', templateId: '', areaId: '', protectsStreak: true, isMinimum: false, quiet: true, nonWorking: false, icon: 'ph-heart' }
  ];

  const stagesOf = (names, stale = 21) => names.map((n, i) => ({ id: `s${i + 1}`, name: n, staleDays: stale }));
  const boards = [
    { id: 'b1', name: 'Research pipeline', areaId: 'a2', projectType: true, order: 1, staleDays: 30,
      stages: stagesOf(['Idea', 'Protocol', 'Ethics', 'Data collection', 'Analysis', 'Writing', 'Submitted', 'Revisions', 'Published'], 30) },
    { id: 'b_sr', name: 'Systematic review / evidence map', areaId: 'a2', projectType: true, order: 2, staleDays: 30,
      stages: stagesOf(['Idea', 'Feasibility check', 'Scoping search', 'Protocol / PROSPERO', 'Search', 'Screening', 'Data extraction', 'Analysis', 'Writing', 'Submitted', 'Revisions', 'Published'], 30) },
    { id: 'b_pd', name: 'Public-data / document analysis', areaId: 'a2', projectType: true, order: 3, staleDays: 30,
      stages: stagesOf(['Idea', 'Feasibility check', 'Data pilot', 'Protocol', 'Data collection', 'Analysis', 'Writing', 'Submitted', 'Revisions', 'Published'], 30) },
    { id: 'b_ps', name: 'Prospective / multicentre / partnership study', areaId: 'a2', projectType: true, order: 4, staleDays: 45,
      stages: stagesOf(['Idea', 'Partners & governance', 'Protocol', 'Ethics', 'Recruitment', 'Data collection', 'Analysis', 'Writing', 'Submitted', 'Revisions', 'Published'], 45) },
    { id: 'b2', name: 'MedTwins content', areaId: 'a5', projectType: false, order: 5, staleDays: 14, video: true,
      stages: stagesOf(['Idea', 'Research', 'Script', 'Film', 'Edit', 'Thumbnail', 'Upload', 'Promote'], 14),
      stageChecklists: { s7: ['No patient-identifiable information', 'Consistent with professional social-media guidance'] } }
  ];

  const guidelines = [
    { id: 'gl_strobe', name: 'STROBE (observational studies)', items: ['Title and abstract', 'Background / rationale', 'Objectives', 'Study design', 'Setting', 'Participants', 'Variables', 'Data sources / measurement', 'Bias', 'Study size', 'Quantitative variables', 'Statistical methods', 'Participant numbers at each stage', 'Descriptive data', 'Outcome data', 'Main results', 'Other analyses', 'Key results', 'Limitations', 'Interpretation', 'Generalisability', 'Funding'] },
    { id: 'gl_consort', name: 'CONSORT (randomised trials)', items: ['Title and abstract', 'Background and objectives', 'Trial design', 'Participants', 'Interventions', 'Outcomes', 'Sample size', 'Randomisation: sequence generation', 'Allocation concealment', 'Implementation', 'Blinding', 'Statistical methods', 'Participant flow diagram', 'Recruitment', 'Baseline data', 'Numbers analysed', 'Outcomes and estimation', 'Ancillary analyses', 'Harms', 'Limitations', 'Generalisability', 'Interpretation', 'Registration', 'Protocol', 'Funding'] },
    { id: 'gl_prisma', name: 'PRISMA (systematic reviews)', items: ['Title', 'Abstract', 'Rationale', 'Objectives', 'Eligibility criteria', 'Information sources', 'Search strategy', 'Selection process', 'Data collection process', 'Data items', 'Risk-of-bias assessment', 'Effect measures', 'Synthesis methods', 'Reporting-bias assessment', 'Certainty assessment', 'Study selection (flow diagram)', 'Study characteristics', 'Risk of bias in studies', 'Results of individual studies', 'Results of syntheses', 'Reporting biases', 'Certainty of evidence', 'Discussion', 'Registration and protocol', 'Support', 'Competing interests', 'Data, code and materials'] },
    { id: 'gl_care', name: 'CARE (case reports)', items: ['Title', 'Keywords', 'Abstract', 'Introduction', 'Patient information (de-identified)', 'Clinical findings', 'Timeline', 'Diagnostic assessment', 'Therapeutic intervention', 'Follow-up and outcomes', 'Discussion', 'Patient perspective', 'Informed consent'] }
  ];

  // Your routine: each lift 3 working sets of 12 / 10 / 8 (warm-up sets extra), 1–2 reps in reserve; abs 3 × 25 or controlled max.
  // Rest 2–3 min on big compound lifts, 60–90 s on accessories. Add the smallest increment after two visits hitting every target.
  const lift = (name, muscle, note) => ({ name, muscle, sets: 3, reps: 12, scheme: '12-10-8', ...(note ? { note } : {}) });
  const abs = () => ({ name: 'Abs', muscle: 'Core', sets: 3, reps: 25, scheme: '25-25-25', note: 'or controlled max; stop before technique breaks' });
  const BIG = 'rest 2–3 min';
  const workoutTemplates = [
    { id: 'wt_a', name: 'Train A — Push', exercises: [lift('Bench press', 'Chest', BIG), lift('Incline bench press', 'Chest', BIG), lift('Shoulder press', 'Shoulders', BIG), lift('Lateral raises', 'Shoulders'), lift('Dips / triceps pulldown', 'Triceps'), abs()] },
    { id: 'wt_b', name: 'Train B — Pull', exercises: [lift('Deadlift', 'Hamstrings', 'leave about 3 reps in reserve; reset between reps; stop before form slips; rest 2–3 min'), lift('Lat pulldown / pull-up', 'Back', BIG), lift('Chin-up / close-grip pulldown', 'Back'), lift('Seated row', 'Back'), lift('Biceps curls', 'Biceps'), abs()] },
    { id: 'wt_c', name: 'Train C — Legs', exercises: [lift('Leg press', 'Quads', BIG), lift('Lunges', 'Quads', 'per leg'), lift('Leg extension', 'Quads'), lift('Leg curls', 'Hamstrings'), lift('Calf raises', 'Calves')] },
    { id: 'wt_cardio', name: 'Cardio — easy', cardio: true, exercises: [] }
  ];
  // The starting templates of earlier versions (a migration removes them only if never edited).
  const oldWorkoutTemplates = [
    { id: 'wt_push', name: 'Push', exercises: [['Bench press', 'Chest'], ['Overhead press', 'Shoulders'], ['Incline dumbbell press', 'Chest'], ['Lateral raise', 'Shoulders'], ['Triceps pushdown', 'Triceps']] },
    { id: 'wt_pull', name: 'Pull', exercises: [['Pull-up', 'Back'], ['Barbell row', 'Back'], ['Lat pulldown', 'Back'], ['Face pull', 'Shoulders'], ['Biceps curl', 'Biceps']] },
    { id: 'wt_legs', name: 'Legs', exercises: [['Squat', 'Quads'], ['Romanian deadlift', 'Hamstrings'], ['Leg press', 'Quads'], ['Leg curl', 'Hamstrings'], ['Calf raise', 'Calves']] },
    { id: 'wt_full', name: 'Full body', exercises: [['Squat', 'Quads'], ['Bench press', 'Chest'], ['Barbell row', 'Back'], ['Overhead press', 'Shoulders'], ['Plank', 'Core']] }
  ].map(t => ({ ...t, exercises: t.exercises.map(([name, muscle]) => ({ name, muscle, sets: 3, reps: 8 })) }));
  const studyResources = ['Osmosis', 'Passmed', 'PasTest', 'Quesmed', 'eMRCS', 'Anatomy flashcards', 'Surgical skills practice (home)'];
  const wardJobTemplates = ['MRI request', 'CT request', 'X-ray request', 'Senior review', 'Medication review', 'Bloods', 'Chase results', 'Referral', 'Discharge summary / TTO', 'Consent', 'Physio / OT', 'Update family', 'Fluids / drug chart', 'Wound check'];

  const otterMessages = {
    morning: ['Morning! One small step at a time.', 'New day, fresh water. Let\'s swim.', 'Coffee first, then we conquer.'],
    normal: ['You\'ve got this. I\'ll be right here.', 'Tick one thing and the rest gets easier.', 'Steady paddling wins the river.'],
    streak: ['{streak} days in a row! Look at you go.', 'Your streak is {streak} days strong.', '{streak} days. I\'m doing a happy flip!'],
    atRisk: ['Still time for {task}. Want to give it a go?', 'Just {task} left. Small and doable!', 'One more splash: {task}.'],
    complete: ['All done! Time to float and relax.', 'Day complete! I\'m doing a backflip.', 'Everything ticked. Proud of you.'],
    minimum: ['Long day? Minimum routine still counts.', 'Rest is part of the plan. Five minutes is plenty.', 'Gentle day. I\'ve got the blanket ready.'],
    night: ['Night shift? Your streak is safe. Look after yourself.', 'Torch on, streak protected. Eat something good.', 'Sleep when you can. I\'ll guard the streak.'],
    deadline: ['Heads-up: {deadline} is {days}.', '{deadline} is coming up {days}. Want to plan a slot?'],
    review: ['Clipboard ready! Let\'s look at your week.', 'Review time. Fifteen calm minutes.'],
    pebble: ['I saved your streak with a pebble!', 'Pebble used. Your streak lives on.'],
    lowEnergy: ['Low battery? Let\'s keep it tiny today.', 'Be kind to yourself. Minimum routine is ready.']
  };

  const areaMessages = {
    zero: ['Let\'s start a fresh streak together!', 'Day one is the best day to begin.'],
    going: ['{streak} and counting!', 'Nice rhythm: {streak} in a row.'],
    met: ['Done for now. That counts!', 'Target hit. I\'m celebrating!'],
    atRisk: ['Still possible today: {task}.', 'A little bit of {area} keeps the streak alive.'],
    rest: ['Rest day. Recharge!', 'No pressure today.']
  };

  const reviewSteps = [
    { id: 'rs_look', type: 'lastWeek', title: 'Look back at last week', prompt: 'What went well? What would you change?', enabled: true },
    { id: 'rs_inbox', type: 'inbox', title: 'Clear the inbox', prompt: '', enabled: true },
    { id: 'rs_check', type: 'boards', title: 'Boards, waiting-on and deadlines', prompt: '', enabled: true },
    { id: 'rs_prio', type: 'priorities', title: 'Choose priorities for next week', prompt: 'Pick 1–3 priorities per area.', enabled: true },
    { id: 'rs_place', type: 'schedule', title: 'Place them into days', prompt: '', enabled: true },
    { id: 'rs_backup', type: 'backup', title: 'Back up your data', prompt: '', enabled: true }
  ];

  const specialties = ['Spine', 'Cardiac', 'Vascular', 'Plastics', 'Orthopaedics (non-spine)', 'Cross-specialty', 'Workforce & training', 'Global surgery & population outcomes', 'Global & Indigenous health'];

  const canDo = {
    B1: ['I can explain my job in German', 'I can describe my daily routine', 'I can talk about my plans for next year', 'I can write a short personal email', 'I can follow the main points of a clear news report'],
    B2: ['I can give a 3-minute presentation on a medical topic', 'I can argue for and against an opinion', 'I can write a structured formal letter', 'I can understand a TV documentary without subtitles', 'I can discuss a patient case with a colleague']
  };

  const portfolioTargets = [
    { name: 'Case-based discussions', target: 4 },
    { name: 'Procedure assessments', target: 6 },
    { name: 'Reflections', target: 6 },
    { name: 'Mini clinical evaluations', target: 4 }
  ];

  const medtwins = {
    videoEveryDays: 14, // goal: one video published every 2 weeks
    scriptTemplate: 'HOOK (first 10 seconds):\n\nWHY IT MATTERS:\n\nMAIN POINTS:\n1.\n2.\n3.\n\nTAKE-HOME MESSAGE:\n\nCALL TO ACTION:\n\nSOURCES:\n',
    filmChecklist: ['Camera charged and storage free', 'Microphone tested', 'Lighting set up', 'Script or bullet points ready', 'Quiet room, phone on silent', 'Backup recording running'],
    repurposeChecklist: ['Shorts / vertical clip', 'Instagram post or reel', 'Community post', 'Pinned comment with sources', 'Shared with twin']
  };

  function settings() {
    const today = U.todayStr();
    return {
      id: 'global', otterName: 'Otto', theme: 'auto', animations: 'on', showMascots: true,
      streakRule: 'core', streakRulePercentage: 80, streakRuleMinTasks: 3,
      ruleHistory: [{ from: '2000-01-01', rule: 'core', pct: 80, min: 3 }],
      pebblesStart: 0, longestStreak: 0, startDate: today,
      weekPlanSchedule: [{ from: '2000-01-01', weekPlanId: 'wp_normal' }],
      deadlineWindow: 14, reviewDay: 0, topicIntervals: [1, 7, 30, 90],
      energy: { enabled: true, time: '17:00', burnoutAvg: 2, burnoutDays: 5, lastAsked: '' },
      sleep: { enabled: false },
      focus: { minutes: 25 },
      reminders: { coreAfter21: true, deadlines: true, topics: true, waiting: true, certs: true, stuck: true, backup: true, videoGoal: true, dismissed: {} },
      lastBackupAt: '', milestonesShown: {},
      otter: { equipped: [], messagesOn: true, messages: U.clone(otterMessages) },
      reviewSteps: U.clone(reviewSteps),
      research: { activeLimit: 3, specialties: [...specialties] },
      gym: { restSec: 90, deloadFrom: '', autoMoveGym: true },
      german: { examDate: '', currentLevel: 'B1', targetLevel: 'B2' },
      study: { weakPct: 60, watchDay: 0, watchTime: '17:00', resources: [...studyResources] },
      clinical: { jobTemplates: [...wardJobTemplates] },
      medtwins: U.clone(medtwins),
      holidays: [], migrations: {}
    };
  }

  return { task, areas, dayTemplates, weekPlans, modes, boards, guidelines, workoutTemplates, oldWorkoutTemplates, gymWeek, studyResources, wardJobTemplates, otterMessages, areaMessages,
    reviewSteps, specialties, canDo, portfolioTargets, medtwins, settings, weekdayTasks, weekendTasks };
})();
window.Defaults = Defaults;
