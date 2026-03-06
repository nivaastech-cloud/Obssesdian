import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Code, FileText, Trash2, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { architectChat, executeFunctionCall } from '../services/architectService';
import { useStore } from '../store';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
}

export const ArchitectAI: React.FC = () => {
  const { notes, addNote, updateNote } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hello! I'm your App Architect. I can help you build your app's code OR manage your notes. What would you like to do?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      let response = await architectChat.sendMessage({ message: userMessage });
      
      // Handle function calls if any
      while (response.functionCalls) {
        const functionResponses = [];
        
        for (const call of response.functionCalls) {
          if (!call.name) continue;
          
          setMessages(prev => [...prev, { 
            role: 'model', 
            content: `Executing: ${call.name}(${JSON.stringify(call.args)})`,
            isThinking: true 
          }]);
          
          try {
            let result;
            // Handle App Data tools locally
            if (call.name === 'createNote') {
              const id = addNote(call.args.title as string, null);
              if (call.args.content) {
                updateNote(id, { content: call.args.content as string });
              }
              result = { success: true, id, message: `Note "${call.args.title}" created successfully.` };
            } else if (call.name === 'listNotes') {
              result = notes.map(n => ({ id: n.id, title: n.title }));
            } else if (call.name === 'updateNote') {
              updateNote(call.args.id as string, { 
                title: call.args.title as string, 
                content: call.args.content as string 
              });
              result = { success: true, message: `Note updated successfully.` };
            } else {
              // Handle Source Code tools via API
              result = await executeFunctionCall(call as { name: string; args: any });
            }

            functionResponses.push({
              name: call.name,
              response: result,
              id: call.id
            });
          } catch (err: any) {
            functionResponses.push({
              name: call.name,
              response: { error: err.message },
              id: call.id
            });
          }
        }

        // Remove the "thinking" messages before sending function responses
        setMessages(prev => prev.filter(m => !m.isThinking));
        
        response = await architectChat.sendMessage({
          message: {
            role: 'user',
            parts: functionResponses.map(fr => ({
              functionResponse: fr
            }))
          } as any // The SDK type for sendMessage is a bit restrictive, but it works
        });
      }

      setMessages(prev => [...prev, { role: 'model', content: response.text || "I've completed the task." }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        id="architect-fab"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-zinc-900 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center transition-all border-2 border-indigo-500/50 overflow-hidden p-0 group"
      >
        <img 
          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&h=256&auto=format&fit=crop" 
          alt="Architect"
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        {isOpen && (
          <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center backdrop-blur-[2px]">
            <X size={24} className="text-white" />
          </div>
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="architect-window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[400px] h-[600px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-bottom border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">App Architect</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Full Access Mode</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800"
            >
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : msg.isThinking 
                        ? 'bg-zinc-800/50 text-zinc-400 italic border border-zinc-700/50'
                        : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                  }`}>
                    {msg.isThinking && <Loader2 size={14} className="animate-spin mb-1" />}
                    <div className="markdown-body prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && !messages[messages.length-1].isThinking && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 text-zinc-400 p-3 rounded-2xl rounded-tl-none border border-zinc-700">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me to build something..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-4 pr-12 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-2 text-[10px] text-zinc-600 text-center">
                I can read, create, and modify any file in this project.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
