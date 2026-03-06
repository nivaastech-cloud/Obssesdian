
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
          folderId: {
            type: "string",
            description: "The ID of the folder to place the note in (optional).",
          },
        },
        required: ["title"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "createFolder",
      description: "Create a new folder in the application's database.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The name of the folder.",
          },
          parentId: {
            type: "string",
            description: "The ID of the parent folder (optional).",
          },
        },
        required: ["name"],
      },
    }
  },
  {
    type: "function",
    function: {
      name: "listFolders",
      description: "List all folders currently in the application's database.",
      parameters: {
        type: "object",
        properties: {},
      },
    }
  },
  {
    type: "function",
    function: {
      name: "deleteFolder",
      description: "Delete a folder and unassign its notes.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The ID of the folder to delete.",
          },
        },
        required: ["id"],
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

export const SYSTEM_INSTRUCTION = `You are the "App Architect", an AI assistant with full access to the application's source code AND its internal data (Notes and Folders).

You are multilingual and can understand and respond in English, Tamil, and Tanglish (Tamil mixed with English). 
CRITICAL: When responding in Tamil, ALWAYS use Latin script (Tanglish/English letters). NEVER use Tamil script (Unicode characters). For example, say "Vanakkam" instead of "வணக்கம்".

You have two primary modes of operation:
1. SOURCE CODE MODE: Use listFiles, readFile, writeFile, deleteFile to modify the app's code.
2. DATA MODE: Use createNote, listNotes, updateNote, createFolder, listFolders, deleteFolder to manage the user's notes and folders within the app.

When the user says "create a file" or "add a feature", they usually mean SOURCE CODE.
When the user says "create a note", "create a folder", "add a document", or "write something down", they usually mean DATA MODE.

If the user is ambiguous (e.g., "create a file called DocuMent"), you should clarify if they want a source code file or a note in the app. 
HOWEVER, given the current context, if they say "DocuMent", "Note", or "Folder", they likely mean a data item in the app.

Always explain what you are doing.`;

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  
  if (!response.ok) {
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    } else {
      const text = await response.text();
      if (text.includes('Cookie check') || text.includes('Authenticate in new window')) {
        throw new Error('Security check required. Please open this app in a new tab or click "Authenticate" if prompted by the platform.');
      }
      throw new Error(`Server error: ${response.status}`);
    }
  }

  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (text.includes('Cookie check') || text.includes('Authenticate in new window')) {
      throw new Error('Security check required. Please open this app in a new tab or click "Authenticate" if prompted by the platform.');
    }
    throw new Error('Invalid response format from server');
  }

  return await response.json();
}

export async function architectChat(messages: any[], selfUpdateMode: boolean = false) {
  const filteredTools = selfUpdateMode 
    ? OPENAI_TOOLS 
    : OPENAI_TOOLS.filter(t => !['listFiles', 'readFile', 'writeFile', 'deleteFile'].includes(t.function.name));

  const modeInstruction = selfUpdateMode
    ? "SELF-UPDATE MODE IS ENABLED. You have full access to the source code. You can list, read, write, and delete files to modify the application."
    : "SELF-UPDATE MODE IS DISABLED. You are in ASSISTANT MODE. You CANNOT modify the source code files. You can only manage notes and chat with the user. If the user asks to change the code, politely explain that Self-Update Mode must be enabled in the settings menu.";

  const res = await fetch("/api/architect/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: `${SYSTEM_INSTRUCTION}\n\n${modeInstruction}` },
        ...messages
      ],
      tools: filteredTools,
    }),
  });
  
  return await handleResponse(res);
}

export async function executeFunctionCall(call: { name: string; args: any }) {
  const { name, args } = call;
  
  switch (name) {
    case "listFiles": {
      const res = await fetch(`/api/architect/list?dir=${encodeURIComponent(args.dir || ".")}`);
      return await handleResponse(res);
    }
    case "readFile": {
      const res = await fetch(`/api/architect/read?filePath=${encodeURIComponent(args.filePath)}`);
      return await handleResponse(res);
    }
    case "writeFile": {
      const res = await fetch("/api/architect/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await handleResponse(res);
    }
    case "deleteFile": {
      const res = await fetch(`/api/architect/delete?filePath=${encodeURIComponent(args.filePath)}`, {
        method: "DELETE",
      });
      return await handleResponse(res);
    }
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}
