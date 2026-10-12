import Groq from "groq-sdk";

// Initialize Groq client lazily when needed
let groqClient = null;
let model = null;

function getGroqClient() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey && process.env.NODE_ENV !== 'test') {
      console.warn("GROQ_API_KEY is not configured. AI requests will fail until it is set.");
    }
    
    groqClient = new Groq({
      apiKey: apiKey || "dummy-key-for-initialization",
    });
    
    model = process.env.GROQ_MODEL || "llama3-70b-8192";
  }
  return { client: groqClient, model };
}

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

  const { client, model } = getGroqClient();
  
  const response = await client.chat.completions.create({
    model,
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

export const generateAIResponse = async (messages, options = {}) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const { client, model } = getGroqClient();
  const correlationId = options.correlationId || `req_${Date.now()}`;
  const maxCompletionTokens = options.max_completion_tokens || 2500;

  console.log(
    `[ai-provider] request started correlationId=${correlationId} model=${model} maxCompletionTokens=${maxCompletionTokens}`
  );

  const response = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: maxCompletionTokens,
    temperature: options.temperature ?? 0.2,
    response_format: {
      type: "json_object"
    },
    stream: false
  });

  const choice = response?.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason || "unknown";
  const usage = response?.usage || {};

  console.log(
    `[ai-provider] response received correlationId=${correlationId} model=${model} finishReason=${finishReason} promptTokens=${usage.prompt_tokens || 'unknown'} completionTokens=${usage.completion_tokens || 'unknown'} totalTokens=${usage.total_tokens || 'unknown'} contentChars=${typeof content === "string" ? content.length : 0}`
  );

  if (finishReason === "length") {
    throw new Error(
      `AI response was truncated due to output length limit (finish_reason=length). Completion tokens: ${usage.completion_tokens || maxCompletionTokens}.`
    );
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Groq returned an empty response.");
  }

  return content;
};

export async function generateStructuredAI(messages, options = {}) {
  const correlationId = options.correlationId || `req_${Date.now()}`;
  try {
    const content = await generateAIResponse(messages, {
      correlationId,
      max_completion_tokens: options.max_completion_tokens || 2500
    });

    return extractJson(content);
  } catch (firstError) {
    console.warn(
      `[ai-provider] First AI generation failed correlationId=${correlationId} error="${firstError.message}". Retrying with compact schema instructions...`
    );

    // On retry, adjust system prompt instructions rather than appending a bloated instruction
    // to the large user prompt, avoiding exceeding request budget.
    const retryMessages = messages.map((message) => {
      if (message.role === "system") {
        return {
          ...message,
          content: `${message.content}\n\nIMPORTANT RETRY INSTRUCTION: Keep JSON concise. Summarize evidence briefly (<100 chars per item). Output ONLY valid, complete JSON matching the required schema.`
        };
      }
      return message;
    });

    const content = await generateAIResponse(retryMessages, {
      correlationId: `${correlationId}_retry`,
      max_completion_tokens: options.retry_max_completion_tokens || 2000
    });

    return extractJson(content);
  }
}

