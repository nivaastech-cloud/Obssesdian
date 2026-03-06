import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Code, FileText, Trash2, FolderOpen, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { architectChat, executeFunctionCall } from '../services/architectService';
import { useStore } from '../store';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  isThinking?: boolean;
  tool_calls?: any[];
  tool_call_id?: string;
}

export const ArchitectAI: React.FC = () => {
  const { notes, addNote, updateNote } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your App Architect (now powered by OpenAI). I can help you build your app's code OR manage your notes. What would you like to do?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (isListening) {
      recognitionRef.current.stop();
    }

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let currentMessages = newMessages.map(m => ({ role: m.role, content: m.content, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id }));
      let response = await architectChat(currentMessages);
      
      while (response.choices[0].message.tool_calls) {
        const toolCalls = response.choices[0].message.tool_calls;
        const assistantMessage = response.choices[0].message;
        
        // Add assistant message with tool calls to history
        currentMessages.push(assistantMessage);
        setMessages(prev => [...prev, { ...assistantMessage, role: 'assistant' }]);

        const toolResponses = [];
        
        for (const call of toolCalls) {
          const functionName = call.function.name;
          const args = JSON.parse(call.function.arguments);
          
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Executing: ${functionName}(${call.function.arguments})`,
            isThinking: true 
          }]);
          
          try {
            let result;
            if (functionName === 'createNote') {
              const id = addNote(args.title, null);
              if (args.content) {
                updateNote(id, { content: args.content });
              }
              result = { success: true, id, message: `Note "${args.title}" created successfully.` };
            } else if (functionName === 'listNotes') {
              result = notes.map(n => ({ id: n.id, title: n.title }));
            } else if (functionName === 'updateNote') {
              updateNote(args.id, { title: args.title, content: args.content });
              result = { success: true, message: `Note updated successfully.` };
            } else {
              result = await executeFunctionCall({ name: functionName, args });
            }

            const toolResponse = {
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result)
            };
            toolResponses.push(toolResponse);
          } catch (err: any) {
            toolResponses.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: err.message })
            });
          }
        }

        // Remove thinking messages
        setMessages(prev => prev.filter(m => !m.isThinking));
        
        // Add tool responses to history
        currentMessages.push(...toolResponses);
        setMessages(prev => [...prev, ...toolResponses as any]);

        // Get next response from model
        response = await architectChat(currentMessages);
      }

      const finalMessage = response.choices[0].message;
      setMessages(prev => [...prev, { role: 'assistant', content: finalMessage.content }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
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
              {messages.filter(msg => msg.role !== 'tool' && (msg.content || msg.isThinking)).map((msg, i) => (
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
                      <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
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
                  placeholder={isListening ? "Listening..." : "Ask me to build something..."}
                  className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-4 pr-24 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors ${isListening ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : ''}`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    onClick={toggleListening}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isListening 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
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
