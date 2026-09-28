import { generateStructuredAI } from "./ai.service.js";
import {
  resumeAnalysisPrompt,
  projectGenerationPrompt,
} from "./ai.prompt.js";

export const analyzeResume = async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText || typeof resumeText !== "string" || !resumeText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Resume text is required.",
      });
    }

    const data = await generateStructuredAI([
      { role: "system", content: resumeAnalysisPrompt },
      { role: "user", content: resumeText.trim() },
    ]);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Resume analysis error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Resume analysis failed.",
    });
  }
};

export const generateProjectWithAI = async (req, res) => {
  try {
    const data = await generateStructuredAI([
      { role: "system", content: projectGenerationPrompt },
      {
        role: "user",
        content: JSON.stringify(req.body || {}, null, 2),
      },
    ]);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("AI project generation error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "AI project generation failed.",
    });
  }
};
