"use client";

import React, { useState, useRef } from 'react';
import { 
  X, 
  Globe, 
  FileText, 
  Type, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Upload
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { importService } from '../services/import';
import { cn } from '../utils/cn';

export const ImportCenter = () => {
  const { isImporting, setImporting, processImportResult } = useStore();
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isImporting) return null;

  const handleUrlImport = async () => {
    if (!url) return;
    setStatus('loading');
    setError(null);
    try {
      const result = await importService.importUrl(url);
      await processImportResult(result);
      setStatus('success');
      setTimeout(() => {
        setImporting(false);
        setStatus('idle');
        setUrl('');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || "Failed to import URL");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('loading');
    setError(null);
    try {
      const result = await importService.importFile(file);
      await processImportResult(result);
      setStatus('success');
      setTimeout(() => {
        setImporting(false);
        setStatus('idle');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || "Failed to import file");
    }
  };

  const handleRawTextImport = async () => {
    if (!rawText) return;
    setStatus('loading');
    setError(null);
    try {
      // For raw text, we simulate an import result
      const result = {
        title: "Pasted Content",
        content: rawText,
        sourceType: 'import' as const,
        metadata: {},
        // We'll use AI to analyze it
      };
      // We need to trigger AI manually here or update ImportService to handle raw text
      // Let's just use the AI service directly for raw text
      const { aiService } = await import('../services/ai');
      const analysis = await aiService.analyzeContent(rawText, 'text');
      await processImportResult({ ...result, analysis });
      
      setStatus('success');
      setTimeout(() => {
        setImporting(false);
        setStatus('idle');
        setRawText('');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || "Failed to import text");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#2c2c2c] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[#2c2c2c] flex items-center justify-between bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Center</h2>
              <p className="text-xs text-[#666666]">Import knowledge from URLs, files, or text</p>
            </div>
          </div>
          <button 
            onClick={() => setImporting(false)}
            className="p-2 text-[#666666] hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* URL Import */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
              <Globe size={16} />
              <span>Import from URL</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-[#2c2c2c] border border-[#3f3f3f] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button 
                onClick={handleUrlImport}
                disabled={status === 'loading' || !url}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                Import
              </button>
            </div>
          </section>

          {/* File Import */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
              <FileText size={16} />
              <span>Import from File (PDF, DOCX, Image, Text)</span>
            </div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#3f3f3f] hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group"
            >
              <div className="p-3 bg-[#2c2c2c] rounded-full text-[#666666] group-hover:text-indigo-400 transition-all">
                <Upload size={24} />
              </div>
              <div className="text-center">
                <p className="text-sm text-[#999999]">Click to upload or drag and drop</p>
                <p className="text-xs text-[#666666] mt-1">PDF, DOCX, JPG, PNG, TXT, MD</p>
              </div>
              <input 
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileImport}
                accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png"
              />
            </div>
          </section>

          {/* Raw Text Import */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[#999999]">
              <Type size={16} />
              <span>Paste Raw Text</span>
            </div>
            <textarea 
              placeholder="Paste your content here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full h-32 bg-[#2c2c2c] border border-[#3f3f3f] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
            <div className="flex justify-end">
              <button 
                onClick={handleRawTextImport}
                disabled={status === 'loading' || !rawText}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                Process Text
              </button>
            </div>
          </section>
        </div>

        {/* Status Overlay */}
        {status !== 'idle' && (
          <div className="p-4 border-t border-[#2c2c2c] bg-[#171717] flex items-center justify-center gap-3">
            {status === 'loading' && (
              <>
                <Loader2 size={18} className="animate-spin text-indigo-400" />
                <span className="text-sm text-[#999999]">AI is analyzing and extracting knowledge...</span>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="text-sm text-green-400">Import successful! Notes generated.</span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle size={18} className="text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
