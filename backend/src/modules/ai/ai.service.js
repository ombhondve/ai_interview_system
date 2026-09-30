import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("GROQ_API_KEY is not configured. AI requests will fail until it is set.");
}

const groq = new Groq({
  apiKey: apiKey || "missing-groq-api-key",
});

const MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";

function extractJson(content) {
  // ---------------------------------------------------------
  // 1. Validate AI response
  // ---------------------------------------------------------

  if (content == null) {
    throw new Error("Groq returned an empty response.");
  }

  if (typeof content !== "string") {
    throw new Error(
      `Groq returned an invalid response type: ${typeof content}.`
    );
  }

  let text = content.trim();

  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  // ---------------------------------------------------------
  // 2. Remove Markdown code fences
  // ------------------------------------------------------

  text = text
    .replace(/^```(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // ---------------------------------------------------------
  // 3. Try parsing the complete response first
  // ---------------------------------------------------------

  try {
    const parsed = JSON.parse(text);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("AI response must be a JSON object.");
    }

    return parsed;
  } catch (directError) {
    // Continue with JSON extraction below.
  }

  // ---------------------------------------------------------
  // 4. Find JSON object inside additional AI text
  // ---------------------------------------------------------

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(
      "Groq returned invalid JSON: no JSON object was found."
    );
  }

  if (lastBrace <= firstBrace) {
    throw new Error(
      "Groq returned invalid JSON: JSON object boundaries are invalid."
    );
  }

  const jsonText = text
    .slice(firstBrace, lastBrace + 1)
    .trim();

  // ---------------------------------------------------------
  // 5. Parse extracted JSON
  // ---------------------------------------------------------

  try {
    const parsed = JSON.parse(jsonText);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("AI response must be a JSON object.");
    }

    return parsed;
  } catch (error) {
    // -------------------------------------------------------
    // 6. Provide useful debugging information
    // -------------------------------------------------------

    const preview = jsonText
      .replace(/\s+/g, " ")
      .slice(0, 500);

    throw new Error(
      `Groq returned invalid JSON. ` +
      `Unable to parse the generated project data. ` +
      `Response preview: ${preview}`
    );
  }
}

/**
 * Generate a normal conversational response.
 *
 * IMPORTANT:
 * WhatsApp chat must return plain text. Do not use
 * response_format: { type: "json_object" } here.
 */
export const generateWhatsAppChatResponse = async (messages) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_completion_tokens: 1000,
    temperature: 0.4,
    stream: false,
  });

  const content =
    response?.choices?.[0]?.message?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    throw new Error(
      "Groq returned an empty WhatsApp chat response."
    );
  }

  return content.trim();
};

export const generateAIResponse = async (messages) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    max_completion_tokens: 2500,
    temperature: 0.2,
    response_format: {
      type: "json_object"
    },

    stream: false
  });

  const content = response?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  console.log("AI generation completed using model:", MODEL);
  return content;
};

export async function generateStructuredAI(messages) {
  try {
    const content =
      await generateAIResponse(messages);

    return extractJson(content);

  } catch (firstError) {
    console.warn(
      "First AI generation failed. Retrying with compact output..."
    );

    const retryMessages = messages.map((message) => {
      if (message.role !== "user") {
        return message;
      }

      return {
        ...message,

        content: `${message.content}

RETRY INSTRUCTION:

The previous response was incomplete.

Generate the same project again.

Keep the JSON compact.

Use short descriptions.

Do not repeat information.

Do not create unnecessary sections.

Maximum 8 items per dynamic section.

Complete the entire JSON object.

Return ONLY valid JSON.`
      };
    });

    const content =
      await generateAIResponse(
        retryMessages
      );

    return extractJson(content);
  }
}
