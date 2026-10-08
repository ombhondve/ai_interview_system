const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.STORAGE_MONGODB_URI);
  const client = mongoose.connection.getClient();
  const adminDb = client.db().admin();
  const dbs = await adminDb.listDatabases();
  
  for (const dbInfo of dbs.databases) {
    const db = client.db(dbInfo.name);
    const collections = await db.listCollections().toArray();
    for (const c of collections) {
      const docsWithTurns = await db.collection(c.name).find({
        $or: [
          { 'transcript.30': { $exists: true } },
          { 'analysis.summary': { $regex: 'transcript turns', $options: 'i' } }
        ]
      }).toArray();
      if (docsWithTurns.length > 0) {
        console.log(`FOUND in db=${dbInfo.name}, col=${c.name}, count=${docsWithTurns.length}:`);
        for (const doc of docsWithTurns) {
          console.log('ID:', doc._id);
          console.log('status:', doc.status);
          console.log('phase:', doc.phase);
          console.log('transcript.length:', doc.transcript?.length);
          console.log('analysis:', JSON.stringify(doc.analysis, null, 2));
          console.log('analysisError:', doc.analysisError);
          console.log('candidateStrengths:', doc.candidateStrengths);
          console.log('candidateWeaknesses:', doc.candidateWeaknesses);
          console.log('technicalAreas:', doc.technicalAreas);
          console.log('knowledgeGaps:', doc.knowledgeGaps);
          console.log('projectOwnershipAssessment:', doc.projectOwnershipAssessment);
          console.log('startedAt:', doc.startedAt);
          console.log('endedAt:', doc.endedAt);
          console.log('recordingStatus:', doc.recordingStatus);
        }
      }
    }
  }
  await mongoose.disconnect();
}
check().catch(console.error);
