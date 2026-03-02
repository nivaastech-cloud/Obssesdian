import { GoogleGenAI, Type } from "@google/genai";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

export interface AIAtomicNote {
  title: string;
  content: string;
  relatedConcepts: string[];
}

export interface AIAnalysisResult {
  notes: AIAtomicNote[];
  summary: string;
  entities: string[];
}

export class AIService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
  }

  async analyzeContent(content: string, sourceType: string): Promise<AIAnalysisResult> {
    if (!this.ai) {
      // Fallback or error
      throw new Error("Gemini API key not configured");
    }

    const prompt = `
      Analyze the following content from source type: ${sourceType}.
      1. Extract key concepts and create multiple atomic notes (not one big note).
      2. Each note should have a clear title and concise markdown content.
      3. Identify related concepts for linking.
      4. Provide a brief summary of the entire content.
      5. Extract important entities (people, places, technologies, etc.).

      Content:
      ${content.substring(0, 10000)} // Limit to avoid token limits
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              notes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    relatedConcepts: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "content", "relatedConcepts"]
                }
              },
              summary: { type: Type.STRING },
              entities: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["notes", "summary", "entities"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}") as AIAnalysisResult;
      return result;
    } catch (error) {
      console.error("AI Analysis failed:", error);
      // Return a minimal result if AI fails
      return {
        notes: [{ title: "Imported Note", content, relatedConcepts: [] }],
        summary: "Content imported without AI analysis.",
        entities: []
      };
    }
  }
}

export const aiService = new AIService();
