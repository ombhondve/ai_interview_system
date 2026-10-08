const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function runTestAnalysis() {
  const token = jwt.sign(
    { adminId: '6aba65abb17f11362910f9c1', email: 'admin@recruitai.com', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const https = require('https');
  // First fetch the interview doc to test local buildAnalysisPrompt + analyzeInterview
  const options = {
    hostname: 'ai-interview-system-eewl.vercel.app',
    path: '/api/ai-interviews/admin/reports',
    method: 'GET',
    headers: { 'Cookie': 'recruitai_admin=' + token }
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', async () => {
      const json = JSON.parse(data);
      const inv = json.interviews[0];
      console.log('Testing analysis for interview:', inv._id);
      console.log('Candidate:', inv.candidateId);
      console.log('Project:', inv.projectId);
      console.log('Transcript count:', inv.transcript.length);

      // Now load buildAnalysisPrompt & analyzeInterview from ESM
      const { buildAnalysisPrompt } = await import('./src/modules/interview/interview.prompt.js');
      const { analyzeInterview, sanitizeAnalysis } = await import('./src/modules/interview/interview.analysis.service.js');
      const { generateStructuredAI } = await import('./src/modules/ai/ai.service.js');

      const prompt = buildAnalysisPrompt({
        candidate: inv.candidateId,
        project: inv.projectId,
        verification: null,
        questions: inv.questions,
        transcript: inv.transcript,
      });

      console.log('\n--- PROMPT LENGTH ---', prompt.length);

      try {
        console.log('\n--- CALLING generateStructuredAI ---');
        const raw = await generateStructuredAI([
          { role: 'system', content: 'You are a fair technical hiring evaluator. Return JSON only. Never output HIRE or REJECT.' },
          { role: 'user', content: prompt }
        ]);
        console.log('\n--- RAW AI RESPONSE ---');
        console.log(JSON.stringify(raw, null, 2));

        const sanitized = sanitizeAnalysis(raw);
        console.log('\n--- SANITIZED ANALYSIS ---');
        console.log(JSON.stringify(sanitized, null, 2));
      } catch (err) {
        console.error('Analysis error:', err);
      }
    });
  });
}

runTestAnalysis();
