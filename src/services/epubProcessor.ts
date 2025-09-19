import ePub, { Book, type NavItem } from '@ssshooter/epubjs'
import { SKIP_CHAPTER_KEYWORDS } from './constants'


export interface ChapterData {
  id: string
  title: string
  content: string
  // 章节定位信息，用于后续打开对应书页
  href?: string // 章节的href路径（用于定位和调试信息）
  tocItem?: NavItem // 原始的TOC项目信息
  depth?: number // 章节层级深度
}

export interface BookData {
  book: Book // epub.js Book instance
  title: string
  author: string
}

export class EpubProcessor {
  async parseEpub(file: File): Promise<BookData> {
    try {
  // Convert File to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

  // Parse EPUB file using epub.js
      const book = ePub()
      await book.open(arrayBuffer)

  // Wait for book to finish loading
      await book.ready

  // Get book metadata
        const title = book.packaging?.metadata?.title || 'Unknown Title'
        const author = book.packaging?.metadata?.creator || 'Unknown Author'

      return {
        book,
        title,
        author
      }
    } catch (error) {
        throw new Error(`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async extractChapters(book: Book, useSmartDetection: boolean = false, skipNonEssentialChapters: boolean = true, maxSubChapterDepth: number = 0): Promise<ChapterData[]> {
    try {
      const chapters: ChapterData[] = []

      try {
        const toc = book.navigation.toc.filter(item=>!item.href.includes('#'))
        if (toc && toc.length > 0) {

            // Get chapter information
          const chapterInfos = await this.extractChaptersFromToc(book, toc, 0, maxSubChapterDepth)
            console.log(`📚 [DEBUG] Found ${chapterInfos.length} chapter infos`, chapterInfos)
          if (chapterInfos.length > 0) {
            // Extract content based on chapter information
            for (const chapterInfo of chapterInfos) {
              // Check if this chapter should be skipped
              if (skipNonEssentialChapters && this.shouldSkipChapter(chapterInfo.title)) {
                  console.log(`⏭️ [DEBUG] Skipping non-essential chapter: "${chapterInfo.title}"`)
                continue
              }

                console.log(`📄 [DEBUG] Extracting chapter "${chapterInfo.title}" (href: ${chapterInfo.href})`)

              const chapterContent = await this.extractContentFromHref(book, chapterInfo.href, chapterInfo.subitems)

              if (chapterContent.trim().length > 100) {
                chapters.push({
                  id: `chapter-${chapters.length + 1}`,
                  title: chapterInfo.title,
                  content: chapterContent,
                  href: chapterInfo.href,
                  tocItem: chapterInfo.tocItem,
                  depth: chapterInfo.depth
                })
              }
            }
          }
        }
      } catch (tocError) {
          console.warn(`⚠️ [DEBUG] Unable to get EPUB table of contents:`, tocError)
      }
  // Apply smart chapter detection
      const finalChapters = this.detectChapters(chapters, useSmartDetection)
        console.log(`📊 [DEBUG] Finally extracted ${finalChapters.length} chapters`)

      return finalChapters
    } catch (error) {
        console.error(`❌ [DEBUG] Failed to extract chapters:`, error)
  throw new Error(`Failed to extract chapters: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractChaptersFromToc(book: Book, toc: NavItem[], currentDepth: number = 0, maxDepth: number = 0): Promise<{ title: string, href: string, subitems?: NavItem[], tocItem: NavItem, depth: number }[]> {
    const chapterInfos: { title: string, href: string, subitems?: NavItem[], tocItem: NavItem, depth: number }[] = []   

    for (const item of toc) {
      try {
        if (item.subitems && item.subitems.length > 0 && maxDepth > 0 && currentDepth < maxDepth) {
          const subChapters = await this.extractChaptersFromToc(book, item.subitems, currentDepth + 1, maxDepth)
          chapterInfos.push(...subChapters)
        } else if (item.href) {
          const chapterInfo: { title: string, href: string, subitems?: NavItem[], tocItem: NavItem, depth: number } = {
            title: item.label || `Chapter ${chapterInfos.length + 1}`,
            href: item.href,
            subitems: item.subitems,
            tocItem: item, // 保存原始TOC项目信息
            depth: currentDepth // 保存章节层级深度
          }
          chapterInfos.push(chapterInfo)
        }
      } catch (error) {
          console.warn(`⚠️ [DEBUG] Skipping chapter "${item.label}":`, error)
      }
    }

    return chapterInfos
  }

  private async extractContentFromHref(book: Book, href: string, subitems?: NavItem[]): Promise<string> {
    try {
        console.log(`🔍 [DEBUG] Trying to get chapter content by href: ${href}`)

  // Clean href, remove anchor part
      const cleanHref = href.split('#')[0]

      let allContent = ''

  // First get main chapter content
      const mainContent = await this.getSingleChapterContent(book, cleanHref)
      if (mainContent) {
        allContent += mainContent
      }

  // If there are subitems, also get their content
      if (subitems && subitems.length > 0) {

        for (const subitem of subitems) {
          if (subitem.href) {
            const subContent = await this.getSingleChapterContent(book, subitem.href.split('#')[0])
            if (subContent) {
              allContent += '\n\n' + subContent
            }
          }
        }
      }
        console.log(`✅ [DEBUG] allContent`, allContent.length)

      return allContent
    } catch (error) {
        console.warn(`❌ [DEBUG] Failed to extract chapter content (href: ${href}):`, error)
      return ''
    }
  }

  private async getSingleChapterContent(book: Book, href: string): Promise<string> {
    try {
      let section = null
      const spineItems = book.spine.spineItems

      for (let i = 0; i < spineItems.length; i++) {
        const spineItem = spineItems[i]

        if (spineItem.href === href || spineItem.href.endsWith(href)) {
          section = book.spine.get(i)
          break
        }
      }

      if (!section) {
          console.warn(`❌ [DEBUG] Unable to get chapter: ${href}`)
        return ''
      }

  // Read chapter content
      const chapterHTML = await section.render(book.load.bind(book))

  // Extract plain text content
      const { textContent } = this.extractTextFromXHTML(chapterHTML)

  // Unload chapter content to free memory
      section.unload()

      return textContent
    } catch (error) {
        console.warn(`❌ [DEBUG] Failed to get single chapter content (href: ${href}):`, error)
      return ''
    }
  }

  private shouldSkipChapter(title: string): boolean {
    if (!title) return false
    
    return SKIP_CHAPTER_KEYWORDS.some(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase())
    )
  }

  private extractTextFromXHTML(xhtmlContent: string): { textContent: string } {
    try {
      console.log(`🔍 [DEBUG] 开始解析XHTML内容，长度: ${xhtmlContent.length}`)

      // 创建一个临时的DOM解析器
      const parser = new DOMParser()
      const doc = parser.parseFromString(xhtmlContent, 'application/xhtml+xml')

  // Check for parse errors
      const parseError = doc.querySelector('parsererror')
      if (parseError) {
          console.warn(`⚠️ [DEBUG] DOM parse error, will use regex fallback:`, parseError.textContent)
  throw new Error('DOM parse failed')
      }

  // Extract main body content
      const body = doc.querySelector('body')
      if (!body) {
        throw new Error('未找到body元素')
      }

  // Remove script and style tags
      const scripts = body.querySelectorAll('script, style')
      scripts.forEach(el => el.remove())

  // Get plain text content
      let textContent = body.textContent || ''

  // Clean text: remove extra whitespace
      textContent = textContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()

        console.log(`✨ [DEBUG] Cleaned text length: ${textContent.length}`)

      return { textContent }
    } catch (error) {
        console.warn(`⚠️ [DEBUG] DOM parse failed, using regex fallback:`, error)
  // If DOM parsing fails, use regex as a fallback
      return this.extractTextWithRegex(xhtmlContent)
    }
  }

  private extractTextWithRegex(xhtmlContent: string): { title: string; textContent: string } {
  console.log(`🔧 [DEBUG] Using regex fallback to parse content, length: ${xhtmlContent.length}`)

  // Remove XML declaration and DOCTYPE
    let cleanContent = xhtmlContent
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')

    // Remove script and style tags and their contents
    cleanContent = cleanContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Extract title
    const titleMatch = cleanContent.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''

  // Remove HTML tags
    let textContent = cleanContent.replace(/<[^>]*>/g, ' ')

  // Decode HTML entities
    textContent = textContent
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")

  // Clean whitespace characters
    textContent = textContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()

    console.log(`✨ [DEBUG] Regular expression solution - Title: "${title}", text length: ${textContent.length}`)

    return { title, textContent }
  }

  // 新增方法：获取章节的HTML内容（不影响原有功能）
  async getSingleChapterHTML(book: Book, href: string): Promise<string> {
    try {
      let section = null
      const spineItems = book.spine.spineItems

      for (let i = 0; i < spineItems.length; i++) {
        const spineItem = spineItems[i]

        if (spineItem.href === href || spineItem.href.endsWith(href)) {
          section = book.spine.get(i)
          break
        }
      }

      if (!section) {
        console.warn(`❌ [DEBUG] 无法获取章节HTML: ${href}`)
        return ''
      }

      // 读取章节内容
      const chapterHTML = await section.render(book.load.bind(book))

      // 卸载章节内容以释放内存
      section.unload()

      return chapterHTML
    } catch (error) {
      console.warn(`❌ [DEBUG] 获取章节HTML失败 (href: ${href}):`, error)
      return ''
    }
  }

  private detectChapters(chapters: ChapterData[], useSmartDetection: boolean): ChapterData[] {
    if (!useSmartDetection) {
      return chapters
    }

    console.log(`🧠 [DEBUG] 启用EPUB智能章节检测，原始章节数: ${chapters.length}`)

    const chapterPatterns = [
      /^第[一二三四五六七八九十\d]+章[\s\S]*$/m,
      /^Chapter\s+\d+[\s\S]*$/mi,
      /^第[一二三四五六七八九十\d]+节[\s\S]*$/m,
      /^\d+\.[\s\S]*$/m,
      /^[一二三四五六七八九十]、[\s\S]*$/m
    ]

    const detectedChapters: ChapterData[] = []
    let currentChapter: ChapterData | null = null
    let chapterCount = 0

    for (const chapter of chapters) {
      const content = chapter.content.trim()
  if (content.length < 100) continue // Skip chapters with too little content

  // Check if this is the start of a new chapter
      let isNewChapter = false
      let chapterTitle = chapter.title

  // If the original title is unclear, try to extract from content
      if (!chapterTitle || chapterTitle.includes('章节') || chapterTitle.includes('Chapter')) {
        for (const pattern of chapterPatterns) {
          const match = content.match(pattern)
          if (match) {
            // Extract chapter title (use first 100 characters as title)
            const titleMatch = content.match(/^(.{1,100})/)
            chapterTitle = titleMatch ? titleMatch[1].trim() : `Chapter ${chapterCount + 1}`
            isNewChapter = true
            break
          }
        }
      }

      if (isNewChapter || !currentChapter) {
  // Save previous chapter
        if (currentChapter && currentChapter.content.trim().length > 200) {
          detectedChapters.push({
            id: currentChapter.id,
            title: currentChapter.title,
            content: currentChapter.content.trim(),
            href: currentChapter.href,
            tocItem: currentChapter.tocItem,
            depth: currentChapter.depth
          })
        }

  // Start new chapter
        chapterCount++
        currentChapter = {
          id: chapter.id || `chapter-${chapterCount}`,
          title: chapterTitle || `Chapter ${chapterCount}`,
          content: content,
          href: chapter.href,
          tocItem: chapter.tocItem,
          depth: chapter.depth
        }

        console.log(`📖 [DEBUG] 检测到新章节: "${chapterTitle}"`)
      } else {
  // Merge into current chapter
        currentChapter.content += '\n\n' + content
      }
    }

  // Save last chapter
    if (currentChapter && currentChapter.content.trim().length > 200) {
      detectedChapters.push({
        id: currentChapter.id,
        title: currentChapter.title,
        content: currentChapter.content.trim(),
        href: currentChapter.href,
        tocItem: currentChapter.tocItem,
        depth: currentChapter.depth
      })
    }

  console.log(`🔍 [DEBUG] EPUB chapter detection complete, found ${detectedChapters.length} chapters`)

    return detectedChapters.length > 0 ? detectedChapters : chapters
  }
}