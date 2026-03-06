import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({
  apiKey: process.env.groq || process.env.GROQ_API_KEY,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

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
        
        // Fallback to Gemini if Groq fails
        if (groqError.status === 429 || groqError.message?.includes('quota') || groqError.status === 401) {
          console.warn("Groq issue detected. Falling back to Gemini...");
          
          const geminiContents = messages
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content || "" }]
            }));

          const systemInstruction = messages.find((m: any) => m.role === 'system')?.content;

          const geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey || geminiKey === "MY_GEMINI_API_KEY" || geminiKey.length < 10) {
            return res.status(500).json({
              error: "Groq failed and no valid Gemini API key found for fallback. Please check your Groq API key or provide a valid Gemini API key in secrets."
            });
          }

          const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: geminiContents,
            config: {
              systemInstruction: systemInstruction
            }
          });

          return res.json({
            choices: [{
              message: {
                role: "assistant",
                content: result.text + "\n\n*(Note: Switched to Gemini fallback due to Groq API issues)*"
              }
            }]
          });
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
