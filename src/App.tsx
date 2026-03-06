import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Editor } from './components/Editor';
import { GraphView } from './components/GraphView';
import { ArchitectAI } from './components/ArchitectAI';
import { useStore } from './store';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { isGraphView, addNote, setSearchQuery } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N -> New Note
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        addNote('Untitled Note', null);
      }
      // Cmd/Ctrl + Shift + F -> Search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNote]);

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {isGraphView ? (
              <motion.div 
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
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
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute inset-0 z-0"
              >
                <Editor />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <ArchitectAI />
    </div>
  );
}
