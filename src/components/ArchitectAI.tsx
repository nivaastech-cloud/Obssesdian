import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Code, FileText, Trash2, FolderOpen, Mic, MicOff, MoreVertical, Settings, Shield, ShieldOff } from 'lucide-react';
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
  const { notes, folders, addNote, updateNote, addFolder, deleteFolder } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveLanguage, setLiveLanguage] = useState('en-US');
  const [selfUpdateMode, setSelfUpdateMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your App Architect. I now support **Global Multilingual Voice** with **Automatic Transliteration**! \n\nYou can speak in **Tamil, Hindi, Spanish, Japanese**, or any language. I will automatically convert your speech into **Latin script (Tanglish/Romanized)** so you can read it easily. \n\n**Note:** For the best LIVE preview, select your language using the button in the settings menu!" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = '46px'; // Reset to min height
        const newHeight = Math.min(textarea.scrollHeight, 600);
        textarea.style.height = `${newHeight}px`;
      }
    };
    
    adjustHeight();
    // Add a small delay to ensure DOM has updated
    const timeoutId = setTimeout(adjustHeight, 0);
    return () => clearTimeout(timeoutId);
  }, [input, liveTranscript, isListening]);

  useEffect(() => {
    // Basic Tamil to Latin transliteration for LIVE preview
    const transliterateLive = (text: string, lang: string) => {
      if (lang !== 'ta-IN') return text;
      
      const charMap: { [key: string]: string } = {
        'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oe', 'ஔ': 'au',
        'க': 'ka', 'ங': 'nga', 'ச': 'cha', 'ஞ': 'nya', 'ட': 'ta', 'ண': 'na', 'த': 'tha', 'ந': 'na', 'ப': 'pa', 'ம': 'ma', 'ய': 'ya', 'ர': 'ra', 'ல': 'la', 'வ': 'va', 'ழ': 'zha', 'ள': 'la', 'ற': 'ra', 'ன': 'na',
        'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo', 'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oe', 'ௌ': 'au', '்': ''
      };

      return text.split('').map(char => charMap[char] || char).join('');
    };

    // Initialize Speech Recognition for LIVE PREVIEW only
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = liveLanguage;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        
        setLiveTranscript(transliterateLive(transcript, liveLanguage));
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
    }
  }, [liveLanguage]);

  const startRecording = async () => {
    try {
      // Start SpeechRecognition FIRST (for live preview)
      if (recognitionRef.current) {
        setLiveTranscript('');
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('SpeechRecognition start error:', e);
          // If already started, ignore
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/ogg') 
          ? 'audio/ogg' 
          : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleTranscription(audioBlob, mimeType);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start MediaRecorder (for high quality final result)
      mediaRecorder.start();
      
      setIsListening(true);
      setRecordingTime(0);
      
      // Start Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
      
      // Cleanup recognition if it started
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsListening(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscription = async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      const extension = mimeType.split('/')[1] || 'webm';
      formData.append('audio', audioBlob, `recording.${extension}`);

      const response = await fetch('/api/architect/transcribe', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMessage = 'Transcription failed';
        try {
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const text = await response.text();
            console.error('Server returned non-JSON error:', text);
            errorMessage = `Server error: ${response.status}`;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Server returned non-JSON success response:', text);
        
        if (text.includes('Cookie check') || text.includes('Authenticate in new window')) {
          throw new Error('Security check required. Please open this app in a new tab or click "Authenticate" if prompted by the platform.');
        }
        
        throw new Error('Invalid response format from server');
      }

      const data = await response.json();
      if (data.text) {
        setInput(prev => prev ? `${prev} ${data.text}` : data.text);
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      alert(err.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (isListening) {
      stopRecording();
    }

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let currentMessages = newMessages.map(m => ({ role: m.role, content: m.content, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id }));
      let response;
      try {
        response = await architectChat(currentMessages, selfUpdateMode);
      } catch (chatErr: any) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${chatErr.message || 'Failed to connect to AI service.'}` 
        }]);
        setIsLoading(false);
        return;
      }
      
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
              const id = addNote(args.title, args.folderId || null);
              if (args.content) {
                updateNote(id, { content: args.content });
              }
              result = { success: true, id, message: `Note "${args.title}" created successfully.` };
            } else if (functionName === 'listNotes') {
              result = notes.map(n => ({ id: n.id, title: n.title, folderId: n.folderId }));
            } else if (functionName === 'updateNote') {
              updateNote(args.id, { title: args.title, content: args.content });
              result = { success: true, message: `Note updated successfully.` };
            } else if (functionName === 'createFolder') {
              addFolder(args.name, args.parentId || null);
              result = { success: true, message: `Folder "${args.name}" created successfully.` };
            } else if (functionName === 'listFolders') {
              result = folders.map(f => ({ id: f.id, name: f.name, parentId: f.parentId }));
            } else if (functionName === 'deleteFolder') {
              deleteFolder(args.id);
              result = { success: true, message: `Folder deleted successfully.` };
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
        response = await architectChat(currentMessages, selfUpdateMode);
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
            className="fixed bottom-24 right-6 z-50 w-[500px] max-h-[85vh] h-[700px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-bottom border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between relative">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selfUpdateMode ? 'bg-indigo-600/20 text-indigo-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
                  {selfUpdateMode ? <Sparkles size={18} /> : <Bot size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">App Architect</h3>
                  <p className={`text-[10px] uppercase tracking-wider font-bold ${selfUpdateMode ? 'text-indigo-500' : 'text-emerald-500'}`}>
                    {selfUpdateMode ? 'Self-Update Mode' : 'Assistant Mode'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <MoreVertical size={18} />
                  </button>

                  <AnimatePresence>
                    {isMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-[60] overflow-hidden"
                      >
                        <div className="p-3 space-y-3">
                          {/* Language Selector */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-zinc-500 font-bold uppercase px-1">Live Preview Language</label>
                            <select 
                              value={liveLanguage}
                              onChange={(e) => setLiveLanguage(e.target.value)}
                              className="w-full text-xs bg-zinc-900 text-zinc-300 border border-zinc-700 rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                            >
                              <option value="en-US">English</option>
                              <option value="ta-IN">Tamil</option>
                              <option value="hi-IN">Hindi</option>
                              <option value="es-ES">Spanish</option>
                              <option value="fr-FR">French</option>
                              <option value="de-DE">German</option>
                              <option value="ja-JP">Japanese</option>
                            </select>
                          </div>

                          <div className="h-[1px] bg-zinc-700" />

                          {/* Self Update Mode Toggle */}
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                              {selfUpdateMode ? <Shield size={14} className="text-indigo-400" /> : <ShieldOff size={14} className="text-zinc-500" />}
                              <span className="text-xs text-zinc-300 font-medium">Self-Update Mode</span>
                            </div>
                            <button
                              onClick={() => setSelfUpdateMode(!selfUpdateMode)}
                              className={`w-10 h-5 rounded-full transition-colors relative ${selfUpdateMode ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                            >
                              <motion.div
                                animate={{ x: selfUpdateMode ? 22 : 2 }}
                                className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                              />
                            </button>
                          </div>
                          <p className="text-[9px] text-zinc-500 px-1 leading-relaxed">
                            {selfUpdateMode 
                              ? "AI can modify the application's source code directly." 
                              : "AI works as a safe assistant and cannot change files."}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>
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
              {isListening && (
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Live Recording</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">{formatTime(recordingTime)}</span>
                </div>
              )}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={isListening ? (liveTranscript || "I'm listening...") : input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder={isListening ? "I'm listening..." : isTranscribing ? "Processing high-quality audio..." : "Ask me to build something..."}
                  className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-4 pr-24 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none scrollbar-thin scrollbar-thumb-zinc-800 ${isListening ? 'border-red-500/50 ring-1 ring-red-500/20' : isTranscribing ? 'border-indigo-500/50 animate-pulse' : ''}`}
                  style={{ minHeight: '46px' }}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <button
                    onClick={toggleListening}
                    disabled={isTranscribing}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    } disabled:opacity-50`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && !liveTranscript.trim())}
                    className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-zinc-600 text-center">
                {isListening ? `${liveTranscript.split(' ').filter(Boolean).length} words spoken` : "I can read, create, and modify any file in this project."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
