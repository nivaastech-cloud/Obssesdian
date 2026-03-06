import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

const listFilesDeclaration: FunctionDeclaration = {
  name: "listFiles",
  parameters: {
    type: Type.OBJECT,
    description: "List files and directories in a given path.",
    properties: {
      dir: {
        type: Type.STRING,
        description: "The directory path to list. Defaults to root ('.').",
      },
    },
  },
};

const readFileDeclaration: FunctionDeclaration = {
  name: "readFile",
  parameters: {
    type: Type.OBJECT,
    description: "Read the contents of a file.",
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The relative path to the file to read.",
      },
    },
    required: ["filePath"],
  },
};

const writeFileDeclaration: FunctionDeclaration = {
  name: "writeFile",
  parameters: {
    type: Type.OBJECT,
    description: "Create or update a file with the provided content.",
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The relative path to the file to write.",
      },
      content: {
        type: Type.STRING,
        description: "The content to write to the file.",
      },
    },
    required: ["filePath", "content"],
  },
};

const deleteFileDeclaration: FunctionDeclaration = {
  name: "deleteFile",
  parameters: {
    type: Type.OBJECT,
    description: "Delete a file.",
    properties: {
      filePath: {
        type: Type.STRING,
        description: "The relative path to the file to delete.",
      },
    },
    required: ["filePath"],
  },
};

const createNoteDeclaration: FunctionDeclaration = {
  name: "createNote",
  parameters: {
    type: Type.OBJECT,
    description: "Create a new note in the application's database.",
    properties: {
      title: {
        type: Type.STRING,
        description: "The title of the note.",
      },
      content: {
        type: Type.STRING,
        description: "The content of the note (Markdown supported).",
      },
    },
    required: ["title"],
  },
};

const listNotesDeclaration: FunctionDeclaration = {
  name: "listNotes",
  parameters: {
    type: Type.OBJECT,
    description: "List all notes currently in the application's database.",
    properties: {},
  },
};

const updateNoteDeclaration: FunctionDeclaration = {
  name: "updateNote",
  parameters: {
    type: Type.OBJECT,
    description: "Update an existing note in the application's database.",
    properties: {
      id: {
        type: Type.STRING,
        description: "The ID of the note to update.",
      },
      title: {
        type: Type.STRING,
        description: "The new title of the note.",
      },
      content: {
        type: Type.STRING,
        description: "The new content of the note.",
      },
    },
    required: ["id"],
  },
};

const tools = [
  {
    functionDeclarations: [
      listFilesDeclaration,
      readFileDeclaration,
      writeFileDeclaration,
      deleteFileDeclaration,
      createNoteDeclaration,
      listNotesDeclaration,
      updateNoteDeclaration,
    ],
  },
];

export const architectChat = ai.chats.create({
  model: "gemini-3.1-pro-preview",
  config: {
    systemInstruction: `You are the "App Architect", an AI assistant with full access to the application's source code AND its internal data (Notes).
    
    You have two primary modes of operation:
    1. SOURCE CODE MODE: Use listFiles, readFile, writeFile, deleteFile to modify the app's code.
    2. DATA MODE: Use createNote, listNotes, updateNote to manage the user's notes within the app.
    
    When the user says "create a file" or "add a feature", they usually mean SOURCE CODE.
    When the user says "create a note", "add a document", or "write something down", they usually mean DATA MODE.
    
    If the user is ambiguous (e.g., "create a file called DocuMent"), you should clarify if they want a source code file or a note in the app. 
    HOWEVER, given the current context, if they say "DocuMent" or "Note", they likely mean a note in the app.
    
    Always explain what you are doing.`,
    tools,
  },
});

export async function executeFunctionCall(call: { name: string; args: any }) {
  const { name, args } = call;
  
  switch (name) {
    case "listFiles": {
      const res = await fetch(`/api/architect/list?dir=${encodeURIComponent(args.dir || ".")}`);
      return await res.json();
    }
    case "readFile": {
      const res = await fetch(`/api/architect/read?filePath=${encodeURIComponent(args.filePath)}`);
      return await res.json();
    }
    case "writeFile": {
      const res = await fetch("/api/architect/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await res.json();
    }
    case "deleteFile": {
      const res = await fetch(`/api/architect/delete?filePath=${encodeURIComponent(args.filePath)}`, {
        method: "DELETE",
      });
      return await res.json();
    }
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}
