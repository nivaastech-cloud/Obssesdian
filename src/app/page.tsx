"use client";

import React, { useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Editor } from '../components/Editor';
import { TopBar } from '../components/TopBar';
import { GraphView } from '../components/GraphView';
import { ImportCenter } from '../components/ImportCenter';
import { VoiceCapture } from '../components/VoiceCapture';
import { useStore } from '../store/useStore';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const { initialize, isGraphView } = useStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <main className="flex flex-col h-screen bg-[#171717] text-[#d4d4d4] overflow-hidden font-sans">
      {/* Modals */}
      <AnimatePresence>
        <ImportCenter />
        <VoiceCapture />
      </AnimatePresence>

      <TopBar />
      
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {isGraphView ? (
              <motion.div 
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="absolute inset-0 z-10"
              >
                <GraphView />
              </motion.div>
            ) : (
              <motion.div 
                key="editor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex-1 flex flex-col"
              >
                <Editor />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar Placeholder (Backlinks/Metadata) */}
        <div className="w-72 h-full bg-[#171717] border-l border-[#2c2c2c] hidden xl:flex flex-col overflow-hidden p-6 space-y-8">
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-4">AI Insights</h3>
            <div className="p-4 bg-[#1e1e1e] border border-[#2c2c2c] rounded-xl text-xs text-[#999999] leading-relaxed">
              AI analysis will appear here when you import or record content.
            </div>
          </section>
          
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666666] mb-4">Metadata</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#666666]">Created</span>
                <span className="text-[#999999]">--</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#666666]">Source</span>
                <span className="text-[#999999]">--</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#666666]">Links</span>
                <span className="text-[#999999]">0</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
