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

  // German rotation (Focused | Reading/listening | Use the language), Monday–Friday.
  const german = {
    1: ['Grammar book', 'One small topic', 'LingQ video', '', 'Explain the video aloud', ''],
    2: ['Goethe coursework', '', 'Short-story book', '', 'Retell the story aloud', ''],
    3: ['Grammar book: practise', "Recall Monday's rule and practise", 'LingQ News', '', 'Spoken news summary and opinion', ''],
    4: ['Goethe coursework', '', 'LingQ video', 'Revisit or related topic', 'Write 4–6 sentences', 'Check and correct'],
    5: ['Goethe catch-up + weekly review', '', 'Short-story book', 'Continue', 'Record a short summary of my week', '']
  };
  // Gym week: Push → Pull → Cardio (recovery between upper body and legs) → Legs → Cardio (easy run after legs).
  const gymWeek = {
    1: ['Gym — Train A (Push)', 'Bench, incline bench, shoulder press, lateral raises, triceps, abs · 12-10-8', 'wt_a'],
    2: ['Gym — Train B (Pull)', 'Lat pulldown/pull-up, chin-up, seated row, biceps curls, deadlift, abs · 12-10-8', 'wt_b'],
    3: ['Cardio — run', 'Log distance and time', 'wt_cardio'],
    4: ['Gym — Train C (Legs)', 'Leg press, lunges, leg extension, leg curls, calf raises · 12-10-8', 'wt_c'],
    5: ['Cardio — run', 'Easy run after legs day. Log distance and time', 'wt_cardio']
  };
  function weekdayTasks(dw) {
    const p = `w${dw}_`, g = german[dw], gw = gymWeek[dw];
    return [
      task(p + 'ward', '08:00', '12:00', 'Ward round', 'Write your jobs list after the round', 'a3', { info: true, tag: 'ward' }),
      task(p + 'lunch', '12:00', '13:00', 'Lunch break', '', null, { info: true, tag: 'downtime' }),
      task(p + 'clin', '13:00', '17:40', 'Clinical work', '', 'a3', { info: true }),
      task(p + 'settle', '17:40', '18:10', 'Settle in', 'Snack, relax, change', 'a1', { optional: true, tag: 'downtime' }),
      task(p + 'gym', '18:10', '19:30', gw[0], gw[1], 'a1', { core: true, xp: 30, tag: 'gym', wt: gw[2] }),
      task(p + 'dinner', '19:30', '20:30', 'Dinner and shower', '', null, { info: true, tag: 'downtime' }),
      task(p + 'anki', '20:30', '20:40', 'Anki', 'Due reviews; attempt the answer before revealing it', 'a6', { core: true, xp: 15 }),
      task(p + 'focus', '20:40', '21:10', g[0], g[1] || 'Focused learning', 'a6', { xp: 15 }),
      task(p + 'read', '21:10', '21:30', g[2], g[3] || 'Reading / listening', 'a6'),
      task(p + 'use', '21:30', '21:40', g[4], g[5] || 'Use the language', 'a6', { tag: 'speaking' }),
      task(p + 'duo', '21:40', '21:45', 'Duolingo', 'Short session or skip', 'a6', { optional: true, xp: 5 }),
      task(p + 'free', '21:45', '23:30', 'Free time', 'Partner, hobbies, projects', null, { info: true, tag: 'downtime' }),
      task(p + 'wind', '23:30', '24:00', 'Wind down', 'Prepare for bed, sleep at midnight', null, { tag: 'downtime' })
    ];
  }
  function weekendTasks(dw) {
    const p = dw === 6 ? 'sat_' : 'sun_';
    const list = [
      task(p + 'anki', '09:30', '09:45', 'Anki', 'Due reviews', 'a6', { core: true, xp: 15 }),
      task(p + 'talk', '10:00', '10:45', 'German conversation with tutor/partner', '30–45 min, once across the weekend', 'a6', { optional: true, xp: 20, tag: 'speaking' }),
      task(p + 'enjoy', '16:00', '16:45', 'Enjoyable German reading or watching', '', 'a6')
    ];
    if (dw === 6) list.push(task(p + 'gym', '11:00', '12:30', 'Gym or rest day', 'Optional', 'a1', { optional: true, xp: 30, tag: 'gym' }));
    if (dw === 0) list.push(task(p + 'review', '18:00', '18:30', 'Weekly review', 'Otto guides you through it', null, { xp: 20, tag: 'review' }));
    return list.sort(U.by(t => t.time));
  }

  const dayTemplates = [
    ...[1, 2, 3, 4, 5].map(dw => ({ id: `tpl_d${dw}`, name: `Normal workday (${U.DOW3[dw]})`, modeId: 'm_normal', tasks: weekdayTasks(dw) })),
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
      task('goe_class', '19:00', '21:15', 'Live Goethe class', 'Replaces the evening German study blocks', 'a6', { xp: 30, tag: 'speaking' })] }
  ].map(t => ({ ...t, kind: 'day' }));

  const weekPlans = [{ id: 'wp_normal', name: 'Normal term', days: { 0: 'tpl_d0', 1: 'tpl_d1', 2: 'tpl_d2', 3: 'tpl_d3', 4: 'tpl_d4', 5: 'tpl_d5', 6: 'tpl_d6' } }];

  // action: 'none' keeps the day's plan; 'replace' swaps in templateId; 'replaceArea' keeps everything
  // except that area's non-core tasks, then adds templateId's tasks.
  const modes = [
    { id: 'm_normal', name: 'Normal', action: 'none', templateId: '', areaId: '', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-sun' },
    { id: 'm_minimum', name: 'Minimum routine', action: 'replace', templateId: 'tpl_minimum', areaId: '', protectsStreak: false, isMinimum: true, quiet: false, nonWorking: false, icon: 'ph-moon' },
    { id: 'm_goethe', name: 'Live Goethe class', action: 'replaceArea', templateId: 'tpl_goethe', areaId: 'a6', protectsStreak: false, isMinimum: false, quiet: false, nonWorking: false, icon: 'ph-chalkboard-teacher' },
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

  // Your routine: every lift 12-10-8 (3 sets, weight up each set); abs 3 × 25 or max.
  const lift = (name, muscle) => ({ name, muscle, sets: 3, reps: 12, scheme: '12-10-8' });
  const abs = () => ({ name: 'Abs', muscle: 'Core', sets: 3, reps: 25, scheme: '25-25-25', note: 'or max' });
  const workoutTemplates = [
    { id: 'wt_a', name: 'Train A — Push', exercises: [lift('Bench press', 'Chest'), lift('Incline bench press', 'Chest'), lift('Shoulder press', 'Shoulders'), lift('Lateral raises', 'Shoulders'), lift('Triceps dips / triceps pushdown', 'Triceps'), abs()] },
    { id: 'wt_b', name: 'Train B — Pull', exercises: [lift('Lat pulldown / pull-up', 'Back'), lift('Chin-up / close-grip pulldown', 'Back'), lift('Seated row', 'Back'), lift('Biceps curls', 'Biceps'), lift('Deadlift', 'Hamstrings'), abs()] },
    { id: 'wt_c', name: 'Train C — Legs', exercises: [lift('Leg press', 'Quads'), lift('Lunges', 'Quads'), lift('Leg extension', 'Quads'), lift('Leg curls', 'Hamstrings'), lift('Calf raises', 'Calves')] },
    { id: 'wt_cardio', name: 'Cardio — run', cardio: true, exercises: [] }
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
