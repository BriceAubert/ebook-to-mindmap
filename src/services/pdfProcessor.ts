import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker?worker&url'
import { SKIP_CHAPTER_KEYWORDS } from './constants'
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Set PDF.js worker - use local file
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export interface ChapterData {
  id: string
  title: string
  content: string
  // PDF特有的页面信息
  startPage?: number
  endPage?: number
  pageIndex?: number
}

export interface BookData {
  title: string
  author: string
  totalPages: number
  // 保存PDF文档实例用于后续页面渲染
  pdfDocument?: any
}

export class PdfProcessor {

  async parsePdf(file: File): Promise<BookData> {
    try {
      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // Use PDF.js to parse PDF file
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      // Get PDF metadata
      const metadata = await pdf.getMetadata()
      console.log('metadata', metadata)
      const title = (metadata.info as any)?.Title || file.name.replace('.pdf', '') || 'Unknown Title'
      const author = (metadata.info as any)?.Author || 'Unknown Author'

      console.log(`📚 [DEBUG] PDF parsing completed:`, {
        title,
        author,
        totalPages: pdf.numPages
      })

      return {
        title,
        author,
        totalPages: pdf.numPages,
        pdfDocument: pdf
      }
    } catch (error) {
      throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async extractChapters(file: File, useSmartDetection: boolean = false, skipNonEssentialChapters: boolean = true, maxSubChapterDepth: number = 0): Promise<ChapterData[]> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      // Convert File to ArrayBuffer
      const chapters: ChapterData[] = []
      const totalPages = pdf.numPages

      // Use PDF.js to parse the PDF file
      console.log(`📚 [DEBUG] Starting to extract PDF content, total pages: ${totalPages}`)

      // First, try to get chapters using the PDF's outline (bookmarks/table of contents)
      try {
        const outline = await pdf.getOutline()
        if (outline && outline.length > 0) {
          const chapterInfos = await this.extractChaptersFromOutline(pdf, outline, 0, maxSubChapterDepth)
          console.log(chapterInfos, 'chapterInfos')
          if (chapterInfos.length > 0) {
            // Extract content based on chapter information
            for (let i = 0; i < chapterInfos.length; i++) {
              const chapterInfo = chapterInfos[i]
              // Check if this chapter should be skipped
              if (skipNonEssentialChapters && this.shouldSkipChapter(chapterInfo.title)) {
                console.log(`⏭️ [DEBUG] Skipping non-essential chapter: "${chapterInfo.title}"`)
                continue
              }
              const nextChapterInfo = chapterInfos[i + 1]
              const startPage = chapterInfo.pageIndex + 1
              const endPage = nextChapterInfo ? nextChapterInfo.pageIndex : totalPages
              console.log(`📄 [DEBUG] Extracting chapter "${chapterInfo.title}" (pages ${startPage}-${endPage})`)
              const chapterContent = await this.extractTextFromPages(pdf, startPage, endPage)
              if (chapterContent.trim().length > 100) {
                chapters.push({
                  id: `chapter-${chapters.length + 1}`,
                  title: chapterInfo.title,
                  content: chapterContent,
                  startPage: startPage,
                  endPage: endPage,
                  pageIndex: chapterInfo.pageIndex
                })
              }
            }
          }
        }
      } catch (outlineError) {
        console.warn(`⚠️ [DEBUG] Unable to get PDF outline:`, outlineError)
      }

      // Extract content based on chapter information
      // If no chapters were obtained from the outline, use a fallback method
      if (chapters.length === 0) {
        console.log(`📖 [DEBUG] Using fallback chapter extraction method, smart detection: ${useSmartDetection}`)
        // Get all page texts
        const allPageTexts: string[] = []
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          console.log(`📖 [DEBUG] Processing page ${pageNum}/${totalPages}`)
          try {
            const page = await pdf.getPage(pageNum)
            const textContent = await page.getTextContent()
            // Extract page text
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ')
              .trim()
            allPageTexts.push(pageText)
            console.log(`📄 [DEBUG] Page ${pageNum} text length: ${pageText.length} characters`)
          } catch (pageError) {
            console.warn(`❌ [DEBUG] Skipping page ${pageNum}:`, pageError)
            allPageTexts.push('')
          }
        }
        let detectedChapters: ChapterData[] = []
        // Only use if the user has enabled smart detection
        if (useSmartDetection) {
          console.log(`🧠 [DEBUG] Smart chapter detection enabled`)
          detectedChapters = this.detectChapters(allPageTexts)
        }
        if (detectedChapters.length === 0) {
          // If no chapters were detected, group by pages
          const pagesPerChapter = Math.max(1, Math.floor(totalPages / 10)) // max 10 pages per chapter
          for (let i = 0; i < totalPages; i += pagesPerChapter) {
            const endPage = Math.min(i + pagesPerChapter, totalPages)
            const chapterContent = allPageTexts
              .slice(i, endPage)
              .join('\n\n')
              .trim()
            if (chapterContent.length > 100) {
              chapters.push({
                id: `chapter-${Math.floor(i / pagesPerChapter) + 1}`,
                title: `Part ${Math.floor(i / pagesPerChapter) + 1} (pages ${i + 1}-${endPage})`,
                content: chapterContent,
                startPage: i + 1,
                endPage: endPage
              })
            }
          }
        } else {
          // Use detected chapters
          chapters.push(...detectedChapters)
        }
      }
      console.log(`📊 [DEBUG] Finally extracted ${chapters.length} chapters`)
      if (chapters.length === 0) {
        throw new Error('No valid chapter content found')
      }
      return chapters
    } catch (error) {
      console.error(`❌ [DEBUG] Failed to extract chapters:`, error)
      throw new Error(`Failed to extract chapters: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractChaptersFromOutline(pdf: any, outline: any[], currentDepth: number = 0, maxDepth: number = 0): Promise<{ title: string, pageIndex: number }[]> {
    const chapterInfos: { title: string, pageIndex: number }[] = []

    for (const item of outline) {
      try {
        // Recursively process subchapters
        if (item.items && item.items.length > 0) {
          // Only recursively process subchapters if maxDepth > 0 and currentDepth < maxDepth
          if (maxDepth > 0 && currentDepth < maxDepth) {
            const subChapters = await this.extractChaptersFromOutline(pdf, item.items, currentDepth + 1, maxDepth)
            chapterInfos.push(...subChapters)
          }
        } else if (item.dest) {
          // Handle destination reference
          // Use detected chapters
          let destArray
          if (typeof item.dest === 'string') {
            destArray = await pdf.getDestination(item.dest)
          } else {
            destArray = item.dest
          }

          if (destArray && destArray[0]) {
            throw new Error('No valid chapter content found')
            const ref = destArray[0]
            const pageIndex = await pdf.getPageIndex(ref)

            chapterInfos.push({
              title: item.title || `Chapter ${chapterInfos.length + 1}`,
              pageIndex: pageIndex
            })
            console.log(`📖 [DEBUG] Chapter: "${item.title}" -> page ${pageIndex + 1}`)
          }
        }
      } catch (error) {
        console.warn(`⚠️ [DEBUG] Skipping chapter "${item.title}":`, error)
      }
    }

  // Sort by page index
    chapterInfos.sort((a, b) => a.pageIndex - b.pageIndex)

    return chapterInfos
  }

  private async extractTextFromPages(pdf: any, startPage: number, endPage: number): Promise<string> {
    const pageTexts: string[] = []

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()

        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim()

        if (pageText.length > 0) {
          pageTexts.push(pageText)
        }
      } catch (error) {
        console.warn(`⚠️ [DEBUG] 跳过第${pageNum}页:`, error)
      }
    }

    return pageTexts.join('\n\n')
  }

  private detectChapters(pageTexts: string[]): ChapterData[] {
    const chapters: ChapterData[] = []
    const chapterPatterns = [
      /^第[一二三四五六七八九十\d]+章[\s\S]*$/m,
      /^Chapter\s+\d+[\s\S]*$/mi,
      /^第[一二三四五六七八九十\d]+节[\s\S]*$/m,
      /^\d+\.[\s\S]*$/m,
      /^[一二三四五六七八九十]、[\s\S]*$/m
    ]

    let currentChapter: { title: string; content: string; startPage: number } | null = null
    let chapterCount = 0

    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i].trim()
      if (pageText.length < 50) continue // Skip pages with too little content

      // Check if this is the start of a new chapter
      let isNewChapter = false
      let chapterTitle = ''

      for (const pattern of chapterPatterns) {
        const match = pageText.match(pattern)
        if (match) {
          // Extract chapter title (use first 100 chars as title)
          const titleMatch = pageText.match(/^(.{1,100})/)
          chapterTitle = titleMatch ? titleMatch[1].trim() : `章节 ${chapterCount + 1}`
          isNewChapter = true
          break
        }
      }

      if (isNewChapter) {
        // Save previous chapter
        if (currentChapter && currentChapter.content.trim().length > 200) {
          chapters.push({
            id: `chapter-${chapterCount}`,
            title: currentChapter.title,
            content: currentChapter.content.trim(),
            startPage: currentChapter.startPage
          })
        }

        // Start new chapter
        chapterCount++
        currentChapter = {
          title: chapterTitle,
          content: pageText,
          startPage: i + 1
        }

        console.log(`📖 [DEBUG] 检测到新章节: "${chapterTitle}" (第${i + 1}页)`)
      } else if (currentChapter) {
        // Add to current chapter
        currentChapter.content += '\n\n' + pageText
      } else {
        // If no chapter yet, create the first chapter
        chapterCount++
        currentChapter = {
          title: `第 ${chapterCount} 章`,
          content: pageText,
          startPage: i + 1
        }
      }
    }

    // Save the last chapter
    if (currentChapter && currentChapter.content.trim().length > 200) {
      chapters.push({
        id: `chapter-${chapterCount}`,
        title: currentChapter.title,
        content: currentChapter.content.trim(),
        startPage: currentChapter.startPage
      })
    }

  console.log(`🔍 [DEBUG] Chapter detection complete, found ${chapters.length} chapters`)

    return chapters
  }

  // Check if a chapter should be skipped
  private shouldSkipChapter(title: string): boolean {
    const normalizedTitle = title.toLowerCase().trim()
    return SKIP_CHAPTER_KEYWORDS.some(keyword =>
      normalizedTitle.includes(keyword.toLowerCase())
    )
  }

  // 新增方法：获取PDF页面的渲染内容（用于阅读器显示）
  async getPageContent(pdfDocument: PDFDocumentProxy, pageNumber: number): Promise<{ textContent: string; canvas?: HTMLCanvasElement }> {
    try {
      const page = await pdfDocument.getPage(pageNumber)
      
      // 获取文本内容
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim()

      // 创建canvas用于渲染PDF页面
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      canvas.height = viewport.height
      canvas.width = viewport.width

      if (context) {
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }
        await page.render(renderContext).promise
      }

      return {
        textContent: pageText,
        canvas: canvas
      }
    } catch (error) {
      console.warn(`❌ [DEBUG] 获取页面内容失败 (页面 ${pageNumber}):`, error)
      return { textContent: '' }
    }
  }

  // 新增方法：获取章节的所有页面内容（用于阅读器显示）
  async getChapterPages(pdfDocument: any, chapter: ChapterData): Promise<{ textContent: string; canvas?: HTMLCanvasElement }[]> {
    const pages: { textContent: string; canvas?: HTMLCanvasElement }[] = []
    
    if (!chapter.startPage || !chapter.endPage) {
      return pages
    }

    for (let pageNum = chapter.startPage; pageNum <= chapter.endPage; pageNum++) {
      const pageContent = await this.getPageContent(pdfDocument, pageNum)
      pages.push(pageContent)
    }

    return pages
  }
}