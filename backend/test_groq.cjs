const Groq = require('groq-sdk');
require('dotenv').config();

async function testGroq() {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log('Model from env:', process.env.GROQ_MODEL);
  console.log('API Key length:', process.env.GROQ_API_KEY?.length);
  try {
    const res = await client.chat.completions.create({
      model: process.env.GROQ_MODEL,
      messages: [{ role: 'user', content: 'Respond with valid JSON: {"status": "ok"}' }],
      response_format: { type: 'json_object' }
    });
    console.log('Success:', res.choices[0].message.content);
  } catch (err) {
    console.error('Groq Error Status:', err.status);
    console.error('Groq Error Message:', err.message);
    console.error('Groq Error Headers:', err.headers);
  }
}
testGroq();
