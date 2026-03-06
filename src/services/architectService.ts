
export const OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "listFiles",
      description: "List files and directories in a given path.",
      parameters: {
        type: "object",
        properties: {
          dir: {
            type: "string",
            description: "The directory path to list. Defaults to root ('.').",
          },
        },
      },
    }
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The relative path to the file to read.",
          },
        },
        required: ["filePath"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description: "Create or update a file with the provided content.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The relative path to the file to write.",
          },
          content: {
            type: "string",
            description: "The content to write to the file.",
          },
        },
        required: ["filePath", "content"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "deleteFile",
      description: "Delete a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The relative path to the file to delete.",
          },
        },
        required: ["filePath"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "createNote",
      description: "Create a new note in the application's database.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title of the note.",
          },
          content: {
            type: "string",
            description: "The content of the note (Markdown supported).",
          },
        },
        required: ["title"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "listNotes",
      description: "List all notes currently in the application's database.",
      parameters: {
        type: "object",
        properties: {},
      },
    }
  },
  {
    type: "function",
    function: {
      name: "updateNote",
      description: "Update an existing note in the application's database.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The ID of the note to update.",
          },
          title: {
            type: "string",
            description: "The new title of the note.",
          },
          content: {
            type: "string",
            description: "The new content of the note.",
          },
        },
        required: ["id"],
      },
    }
  }
];

export const SYSTEM_INSTRUCTION = `You are the "App Architect", an AI assistant with full access to the application's source code AND its internal data (Notes).

You have two primary modes of operation:
1. SOURCE CODE MODE: Use listFiles, readFile, writeFile, deleteFile to modify the app's code.
2. DATA MODE: Use createNote, listNotes, updateNote to manage the user's notes within the app.

When the user says "create a file" or "add a feature", they usually mean SOURCE CODE.
When the user says "create a note", "add a document", or "write something down", they usually mean DATA MODE.

If the user is ambiguous (e.g., "create a file called DocuMent"), you should clarify if they want a source code file or a note in the app. 
HOWEVER, given the current context, if they say "DocuMent" or "Note", they likely mean a note in the app.

Always explain what you are doing.`;

export async function architectChat(messages: any[]) {
  const res = await fetch("/api/architect/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...messages
      ],
      tools: OPENAI_TOOLS,
    }),
  });
  return await res.json();
}

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
