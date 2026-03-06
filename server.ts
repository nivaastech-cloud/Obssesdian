import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fs_sync from "fs";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: "uploads/" });

const groq = new Groq({
  apiKey: process.env.groq || process.env.GROQ_API_KEY,
});

const getGeminiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.length < 10) {
    return null;
  }
  return key;
};

const getAI = () => {
  const apiKey = getGeminiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Architect APIs
  app.post("/api/architect/chat", async (req, res) => {
    try {
      const { messages, tools } = req.body;
      
      try {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          tools: tools,
        });
        return res.json(response);
      } catch (groqError: any) {
        console.error("Groq Error:", groqError);
        
        const isRateLimit = groqError.status === 429 || 
                          groqError.code === 'rate_limit_exceeded' || 
                          groqError.message?.toLowerCase().includes('rate limit') ||
                          groqError.message?.toLowerCase().includes('quota');
        
        const isAuthError = groqError.status === 401 || 
                           groqError.message?.toLowerCase().includes('api key');

        // Fallback to Gemini if Groq fails due to rate limits or auth issues
        if (isRateLimit || isAuthError || groqError.status >= 500) {
          console.warn(`Groq issue detected (${groqError.status || groqError.code}). Falling back to Gemini...`);
          
          const geminiContents = messages
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => {
              let text = m.content || "";
              
              // If it's a tool call message with no content, add a placeholder
              if (!text && m.tool_calls) {
                text = "[Assistant is calling tools...]";
              }
              // If it's a tool response message, add a placeholder
              if (m.role === 'tool') {
                text = `[Tool Result: ${m.content}]`;
              }

              return {
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: text || "..." }]
              };
            });

          const systemInstruction = messages.find((m: any) => m.role === 'system')?.content;

          const ai = getAI();
          if (!ai) {
            console.error("No valid Gemini API key found for fallback.");
            return res.status(500).json({
              error: `Groq Rate Limit Reached: ${groqError.message}. Additionally, no valid Gemini API key was found for fallback. Please set GEMINI_API_KEY in secrets.`
            });
          }

          try {
            const result = await ai.models.generateContent({
              model: "gemini-3-flash-preview", // Using the recommended model
              contents: geminiContents,
              config: {
                systemInstruction: systemInstruction
              }
            });

            return res.json({
              choices: [{
                message: {
                  role: "assistant",
                  content: (result.text || "I'm sorry, I couldn't generate a response.") + "\n\n*(Note: Switched to Gemini fallback due to Groq API issues)*"
                }
              }]
            });
          } catch (geminiError: any) {
            console.error("Gemini Fallback Error:", geminiError);
            return res.status(500).json({
              error: `Both Groq and Gemini failed. Groq: ${groqError.message}. Gemini: ${geminiError.message}`
            });
          }
        }
        throw groqError;
      }
    } catch (error: any) {
      console.error("Architect Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/architect/list", async (req, res) => {
    try {
      const { dir = "." } = req.query;
      const absolutePath = path.resolve(process.cwd(), dir as string);
      
      // Security: Prevent accessing outside project root
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }

      const files = await fs.readdir(absolutePath, { withFileTypes: true });
      const result = files.map(file => ({
        name: file.name,
        isDirectory: file.isDirectory(),
        path: path.join(dir as string, file.name)
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/architect/read", async (req, res) => {
    try {
      const { filePath } = req.query;
      const absolutePath = path.resolve(process.cwd(), filePath as string);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }

      const content = await fs.readFile(absolutePath, "utf-8");
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/architect/write", async (req, res) => {
    try {
      const { filePath, content } = req.body;
      const absolutePath = path.resolve(process.cwd(), filePath as string);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf-8");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/architect/delete", async (req, res) => {
    try {
      const { filePath } = req.query;
      const absolutePath = path.resolve(process.cwd(), filePath as string);
      
      if (!absolutePath.startsWith(process.cwd())) {
        return res.status(403).json({ error: "Access denied" });
      }

      await fs.unlink(absolutePath);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/architect/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Groq/OpenAI Whisper API requires a file with a valid extension to detect the format
      const ext = path.extname(req.file.originalname) || ".webm";
      const newPath = req.file.path + ext;
      
      // Rename the temp file to include the extension
      await fs.rename(req.file.path, newPath);

      let transcription;
      try {
        transcription = await groq.audio.transcriptions.create({
          file: fs_sync.createReadStream(newPath),
          model: "whisper-large-v3",
          response_format: "json",
        });
      } catch (whisperError: any) {
        console.warn("Whisper transcription failed, falling back to Gemini:", whisperError.message);
        
        // Gemini fallback for transcription
        const ai = getAI();
        if (ai) {
          const audioBuffer = await fs.readFile(newPath);
          const base64Audio = audioBuffer.toString('base64');
          
          const geminiRes = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/webm", // Assuming webm as default from ext
                    data: base64Audio
                  }
                },
                { text: "Transcribe the audio exactly. Return ONLY the transcription text." }
              ]
            }]
          });
          
          transcription = { text: geminiRes.text || "" };
        } else {
          console.error("No valid Gemini API key found for transcription fallback.");
          throw whisperError;
        }
      }

      if (!transcription || !transcription.text) {
        throw new Error("Transcription returned empty result");
      }

      let text = transcription.text;

      // Transliteration step: Convert non-Latin scripts to Latin script (Romanization/Tanglish)
      // This ensures Tamil words are written in English letters as requested.
      try {
        try {
          const translitResponse = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
              { 
                role: "system", 
                content: "You are a transliteration expert. Your task is to convert any non-Latin script (like Tamil, Hindi, Arabic, etc.) into Latin script (Romanization). For Tamil, specifically use 'Tanglish' (Tamil words written in English letters). Keep the original words and language exactly as they are, just change the script to English letters. If the text is already in Latin script, return it exactly as is. Do not translate, only transliterate. NEVER return Tamil script or other non-Latin characters. Return ONLY the transliterated text." 
              },
              { role: "user", content: text }
            ],
          });
          text = translitResponse.choices[0].message.content || text;
        } catch (groqTranslitError: any) {
          console.warn("Groq transliteration failed, falling back to Gemini:", groqTranslitError.message);
          
          // Gemini fallback for transliteration
          const ai = getAI();
          if (ai) {
            const geminiRes = await ai.models.generateContent({
              model: "gemini-2.0-flash",
              contents: [{ role: "user", parts: [{ text: `Transliterate the following text to Latin script (Tanglish for Tamil). Return ONLY the transliterated text: "${text}"` }] }],
              config: {
                systemInstruction: "You are a transliteration expert. Convert non-Latin script to Latin script. For Tamil use Tanglish. Return ONLY the transliterated text. No explanations."
              }
            });
            text = geminiRes.text || text;
          } else {
            console.error("No valid Gemini API key found for transliteration fallback.");
          }
        }
      } catch (translitError) {
        console.error("Transliteration Error:", translitError);
        // Fallback to original text if transliteration fails
      }

      // Clean up temp file
      await fs.unlink(newPath);

      res.json({ text });
    } catch (error: any) {
      console.error("Transcription Error:", error);
      
      // Attempt cleanup if file exists
      if (req.file && req.file.path) {
        try {
          const ext = path.extname(req.file.originalname) || ".webm";
          if (fs_sync.existsSync(req.file.path + ext)) {
            await fs.unlink(req.file.path + ext);
          } else if (fs_sync.existsSync(req.file.path)) {
            await fs.unlink(req.file.path);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      res.status(500).json({ error: error.message });
    }
  });

  // Global error handler for JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error("Global Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
