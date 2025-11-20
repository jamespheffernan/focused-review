const Dexie = require('dexie');

// Open the database
const db = new Dexie('reviewhud');
db.version(11).stores({
  projects: 'id, lastReviewed, status, nextReviewDate',
  answers: 'id, projectID, questionID, weekOf, parentAnswerId, parsedDate, [projectID+questionID], [projectID+weekOf]',
  sessions: 'id, startedAt, weeklyReviewId',
  tasks: 'id, projectId, status, completed, [projectId+status], [projectId+completed], dueDate, flagged, lastModified, syncState',
  notionSyncQueue: 'id, projectId, weekOf, status, nextRetry, [projectId+weekOf]',
  questions: 'id, category, [category+order]',
  questionPackages: 'id, order',
  timelineCommitments: 'id, projectId, weekOf, committedDate, [projectId+weekOf]',
  weeklyReviews: 'id, weekOf, state, [weekOf+state]'
});

async function checkDatabase() {
  const currentWeek = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date().getDay() || 7;
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const weekOf = startOfWeek.toISOString().slice(0, 10);
  
  console.log('Current week:', weekOf);
  
  // Check answers for this week
  const answers = await db.answers.where('weekOf').equals(weekOf).toArray();
  console.log(`\nAnswers for this week: ${answers.length}`);
  
  // Group by project
  const answersByProject = {};
  for (const answer of answers) {
    if (!answersByProject[answer.projectID]) {
      answersByProject[answer.projectID] = [];
    }
    answersByProject[answer.projectID].push(answer.questionID);
  }
  
  console.log('\nAnswers by project:');
  for (const [projectId, questions] of Object.entries(answersByProject)) {
    const project = await db.projects.get(projectId);
    console.log(`  ${project?.name || projectId}: ${questions.length} answers`);
    console.log(`    Questions: ${questions.join(', ')}`);
  }
  
  // Check timeline commitments
  const commitments = await db.timelineCommitments.where('weekOf').equals(weekOf).toArray();
  console.log(`\nTimeline commitments for this week: ${commitments.length}`);
  for (const commitment of commitments) {
    console.log(`  ${commitment.projectName}: ${commitment.committedDate}`);
  }
  
  // Check timeline answers specifically
  const timelineAnswers = answers.filter(a => 
    a.questionID.includes('timeline') && a.parsedDate
  );
  console.log(`\nTimeline answers with parsedDate: ${timelineAnswers.length}`);
  for (const answer of timelineAnswers) {
    const project = await db.projects.get(answer.projectID);
    console.log(`  ${project?.name || answer.projectID}: ${answer.questionID} → ${answer.parsedDate}`);
  }
  
  process.exit(0);
}

checkDatabase().catch(console.error);
