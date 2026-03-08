"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Edit3, 
  Eye, 
  Clock, 
  Link as LinkIcon, 
  ChevronRight,
  Share2,
  Trash2
} from 'lucide-react';
import { useStore } from '../store';
import { Note } from '../types';
import { cn } from '../utils/cn';

export const Editor = () => {
  const { activeNoteId, notes, updateNote, handleWikiLink, deleteNote } = useStore();
  const [isPreview, setIsPreview] = useState(false);
  const activeNote = notes.find(n => n.id === activeNoteId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [activeNote?.content]);

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#666666] italic">
        Select or create a note to start writing
      </div>
    );
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNote(activeNote.id, { content: e.target.value });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNote(activeNote.id, { title: e.target.value });
  };

  const backlinks = notes.filter(n => n.linksTo.includes(activeNote.id));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = activeNote.content.substring(0, cursorPosition);
      
      const lastNewLine = textBeforeCursor.lastIndexOf('\n');
      const currentLineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
      const currentLineText = textBeforeCursor.substring(currentLineStart);

      if (currentLineText.startsWith('/')) {
        const title = currentLineText.substring(1).trim();
        if (title) {
          e.preventDefault();
          const textAfterCursor = activeNote.content.substring(cursorPosition);
          const newContent = textBeforeCursor.substring(0, currentLineStart) + `[[${title}]]\n` + textAfterCursor;
          updateNote(activeNote.id, { content: newContent });
          handleWikiLink(title);
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
      <div className="h-12 border-b border-[#2c2c2c] flex items-center justify-between px-6 bg-[#1e1e1e]/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 text-xs text-[#666666]">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>Updated {new Date(activeNote.updatedAt).toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <LinkIcon size={12} />
            <span>{activeNote.linksTo.length} links</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#171717] rounded-lg p-0.5 border border-[#2c2c2c]">
            <button 
              onClick={() => setIsPreview(false)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                !isPreview ? "bg-[#2c2c2c] text-[#ffffff] shadow-sm" : "text-[#666666] hover:text-[#999999]"
              )}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button 
              onClick={() => setIsPreview(true)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                isPreview ? "bg-[#2c2c2c] text-[#ffffff] shadow-sm" : "text-[#666666] hover:text-[#999999]"
              )}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
          <button 
            onClick={() => deleteNote(activeNote.id)}
            className="p-2 text-[#666666] hover:text-red-400 transition-colors"
            title="Delete Note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 lg:p-16 max-w-4xl mx-auto w-full">
        <input 
          type="text"
          value={activeNote.title}
          onChange={handleTitleChange}
          className="w-full bg-transparent text-4xl font-bold text-[#ffffff] focus:outline-none mb-8 placeholder-[#2c2c2c]"
          placeholder="Note Title"
        />

        {isPreview ? (
          <div className="prose prose-invert prose-zinc max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => {
                  if (typeof children === 'string') {
                    const parts = children.split(/(\[\[.*?\]\])/g);
                    return (
                      <p>
                        {parts.map((part, i) => {
                          if (part.startsWith('[[') && part.endsWith(']]')) {
                            const title = part.slice(2, -2);
                            return (
                              <span 
                                key={i}
                                onClick={() => handleWikiLink(title)}
                                className="text-[#a882ff] hover:text-[#c0a3ff] cursor-pointer underline decoration-[#a882ff]/30 underline-offset-4"
                              >
                                {title}
                              </span>
                            );
                          }
                          return part;
                        })}
                      </p>
                    );
                  }
                  return <p>{children}</p>;
                }
              }}
            >
              {activeNote.content || '_No content yet. Start typing..._'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={activeNote.content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-[#d4d4d4] focus:outline-none resize-none font-mono leading-relaxed min-h-[50vh]"
            placeholder="Type [[Link]] or /Note Title + Enter to connect..."
          />
        )}

        {backlinks.length > 0 && (
          <div className="mt-24 pt-8 border-t border-[#2c2c2c]">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#666666] mb-4">Backlinks</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {backlinks.map(backlink => (
                <div 
                  key={backlink.id}
                  onClick={() => handleWikiLink(backlink.title)}
                  className="p-3 rounded-lg bg-[#171717] border border-[#2c2c2c] hover:border-[#3f3f3f] cursor-pointer transition-all group"
                >
                  <div className="text-sm font-medium text-[#999999] group-hover:text-[#a882ff] transition-colors">{backlink.title}</div>
                  <div className="text-xs text-[#666666] mt-1 line-clamp-1">{backlink.content.slice(0, 100)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
