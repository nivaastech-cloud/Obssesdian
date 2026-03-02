import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { Readability } from '@mozilla/readability';
import { aiService, AIAnalysisResult } from './ai';
import { SourceType } from '../types/index';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ImportResult {
  title: string;
  content: string;
  sourceType: SourceType;
  metadata: {
    sourceUrl?: string;
    fileName?: string;
  };
  analysis?: AIAnalysisResult;
}

export class ImportService {
  async importUrl(url: string): Promise<ImportResult> {
    try {
      // CORS might be an issue here. In a real app, use a proxy.
      const response = await fetch(url);
      const html = await response.text();
      
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const reader = new Readability(doc);
      const article = reader.parse();
      
      if (!article) throw new Error("Failed to parse article content");

      const content = article.textContent || article.content;
      const analysis = await aiService.analyzeContent(content, 'url');

      return {
        title: article.title || 'Imported URL',
        content,
        sourceType: 'import',
        metadata: { sourceUrl: url },
        analysis
      };
    } catch (error) {
      console.error("URL Import failed:", error);
      throw error;
    }
  }

  async importFile(file: File): Promise<ImportResult> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    let content = '';
    let sourceType: SourceType = 'import';

    try {
      if (extension === 'pdf') {
        content = await this.extractPdfText(file);
      } else if (extension === 'docx') {
        content = await this.extractDocxText(file);
      } else if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
        content = await this.extractOcrText(file);
      } else if (['txt', 'md'].includes(extension || '')) {
        content = await file.text();
      } else {
        throw new Error("Unsupported file type");
      }

      const analysis = await aiService.analyzeContent(content, extension || 'file');

      return {
        title: file.name,
        content,
        sourceType,
        metadata: { fileName: file.name },
        analysis
      };
    } catch (error) {
      console.error("File Import failed:", error);
      throw error;
    }
  }

  private async extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  }

  private async extractDocxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractOcrText(file: File): Promise<string> {
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    return text;
  }
}

export const importService = new ImportService();
