"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Square,
  Play,
  History
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { aiService } from '../services/ai';
import { cn } from '../utils/cn';

export const VoiceCapture = () => {
  const { isRecording, setRecording, processImportResult } = useStore();
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(prev => prev + finalTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone access denied. Please check your browser settings.');
          } else {
            setError(`Error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  if (!isRecording) return null;

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser.');
      return;
    }
    setError(null);
    setTranscript('');
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processVoiceNote = async () => {
    if (!transcript) return;
    setStatus('loading');
    setError(null);
    try {
      const analysis = await aiService.analyzeContent(transcript, 'voice');
      await processImportResult({
        title: `Voice Note ${new Date().toLocaleString()}`,
        content: transcript,
        sourceType: 'voice',
        metadata: {},
        analysis
      });
      setStatus('success');
      setTimeout(() => {
        setRecording(false);
        setStatus('idle');
        setTranscript('');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || "Failed to process voice note");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[#2c2c2c] flex items-center justify-between bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-all",
              isListening ? "bg-red-500/10 text-red-400 animate-pulse" : "bg-indigo-500/10 text-indigo-400"
            )}>
              <Mic size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Voice Capture</h2>
              <p className="text-xs text-[#666666]">Speak to capture knowledge automatically</p>
            </div>
          </div>
          <button 
            onClick={() => {
              stopListening();
              setRecording(false);
            }}
            className="p-2 text-[#666666] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-[300px]">
          <div className="bg-[#171717] border border-[#2c2c2c] rounded-xl p-6 min-h-[200px] relative">
            {transcript ? (
              <p className="text-sm text-[#d4d4d4] leading-relaxed whitespace-pre-wrap">{transcript}</p>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[#666666] gap-3">
                <Mic size={32} className="opacity-20" />
                <p className="text-xs italic">Click start to begin recording...</p>
              </div>
            )}
            {isListening && (
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] text-[#666666] uppercase font-bold tracking-widest">Recording</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            {!isListening ? (
              <button 
                onClick={startListening}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full transition-all shadow-lg shadow-indigo-600/20"
              >
                <Play size={18} fill="currentColor" />
                Start Recording
              </button>
            ) : (
              <button 
                onClick={stopListening}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full transition-all shadow-lg shadow-red-600/20"
              >
                <Square size={18} fill="currentColor" />
                Stop Recording
              </button>
            )}
          </div>

          {transcript && !isListening && (
            <div className="flex justify-center">
              <button 
                onClick={processVoiceNote}
                disabled={status === 'loading'}
                className="flex items-center gap-2 px-6 py-2 bg-[#2c2c2c] hover:bg-[#3f3f3f] border border-[#3f3f3f] text-[#999999] hover:text-white text-sm font-medium rounded-lg transition-all"
              >
                <History size={16} />
                Process with AI
              </button>
            </div>
          )}
        </div>

        {/* Status Overlay */}
        {status !== 'idle' || error ? (
          <div className="p-4 border-t border-[#2c2c2c] bg-[#171717] flex items-center justify-center gap-3">
            {status === 'loading' && (
              <>
                <Loader2 size={18} className="animate-spin text-indigo-400" />
                <span className="text-sm text-[#999999]">AI is analyzing your voice note...</span>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="text-sm text-green-400">Voice note processed!</span>
              </>
            )}
            {error && (
              <>
                <AlertCircle size={18} className="text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
