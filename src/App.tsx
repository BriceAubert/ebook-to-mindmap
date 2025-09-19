import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Upload, BookOpen, Brain, FileText, Loader2, Network, Trash2, List, ChevronUp, ArrowLeft } from 'lucide-react'
import { EpubProcessor, type ChapterData, type BookData as EpubBookData } from './services/epubProcessor'
import { PdfProcessor, type BookData as PdfBookData } from './services/pdfProcessor'
import { AIService } from './services/aiService'
import { CacheService } from './services/cacheService'
import { ConfigDialog } from './components/project/ConfigDialog'
import type { MindElixirData } from 'mind-elixir'
import type { Summary } from 'node_modules/mind-elixir/dist/types/summary'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { MarkdownCard } from './components/MarkdownCard'
import { MindMapCard } from './components/MindMapCard'
import { EpubReader } from './components/EpubReader'
import { PdfReader } from './components/PdfReader'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { scrollToTop, openInMindElixir, downloadMindMap } from './utils'


const options = { direction: 1, alignment: 'nodes' } as const

interface Chapter {
  id: string
  title: string
  content: string
  summary?: string
  mindMap?: MindElixirData
  processed: boolean
}

interface BookSummary {
  title: string
  author: string
  chapters: Chapter[]
  connections: string
  overallSummary: string
}

interface BookMindMap {
  title: string
  author: string
  chapters: Chapter[]
  combinedMindMap: MindElixirData | null
}

// Import config store
import { useAIConfig, useProcessingOptions, useConfigStore } from './stores/configStore'
const cacheService = new CacheService()

function App() {
  const { t } = useTranslation()
  const [currentStepIndex, setCurrentStepIndex] = useState(1) // 1: 配置步骤, 2: 处理步骤
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [extractingChapters, setExtractingChapters] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [bookSummary, setBookSummary] = useState<BookSummary | null>(null)
  const [bookMindMap, setBookMindMap] = useState<BookMindMap | null>(null)
  const [extractedChapters, setExtractedChapters] = useState<ChapterData[] | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [bookData, setBookData] = useState<{ title: string; author: string } | null>(null)
  const [fullBookData, setFullBookData] = useState<EpubBookData | PdfBookData | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [currentReadingChapter, setCurrentReadingChapter] = useState<ChapterData | null>(null)



  // Use zustand store to manage config
  const aiConfig = useAIConfig()
  const processingOptions = useProcessingOptions()

  // Destructure state values from store
  const { apiKey } = aiConfig
  const { processingMode, bookType, useSmartDetection, skipNonEssentialChapters } = processingOptions

  // zustand's persist middleware will automatically handle config loading and saving

  // Listen to scroll event to control back-to-top button display
  useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container')
    if (!scrollContainer) return

    const handleScroll = () => {
      setShowBackToTop(scrollContainer.scrollTop > 300)
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])



  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && (selectedFile.name.endsWith('.epub') || selectedFile.name.endsWith('.pdf'))) {
      setFile(selectedFile)
  // Reset chapter extraction state
      setExtractedChapters(null)
      setSelectedChapters(new Set())
      setBookData(null)
      setFullBookData(null)
      setBookSummary(null)
      setBookMindMap(null)
      setCurrentReadingChapter(null)
    } else {
      toast.error(t('upload.invalidFile'), {
        duration: 3000,
        position: 'top-center',
      })
    }
  }, [t])

  // Function to clear chapter cache
  const clearChapterCache = (chapterId: string) => {
    if (!file) return

    const type = processingMode === 'summary' ? 'summary' : 'mindmap'
    if (cacheService.clearChapterCache(file.name, chapterId, type)) {
  toast.success('Cache cleared. Content will be regenerated next time.', {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // Function to clear specific type of cache
  const clearSpecificCache = (cacheType: 'connections' | 'overall_summary' | 'combined_mindmap' | 'merged_mindmap') => {
    if (!file) return

    const displayNames = {
      connections: 'Chapter Connections',
      overall_summary: 'Book Summary',
      combined_mindmap: 'Whole Book Mind Map',
      merged_mindmap: 'Merged Chapter Mind Map'
    }

    if (cacheService.clearSpecificCache(file.name, cacheType)) {
  toast.success(`Cleared ${displayNames[cacheType]} cache. Content will be regenerated next time.`, {
        duration: 3000,
        position: 'top-center',
      })
    } else {
  toast.info(`No ${displayNames[cacheType]} cache found to clear.`, {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // Chapter selection handler
  const handleChapterSelect = useCallback((chapterId: string, checked: boolean) => {
    setSelectedChapters(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(chapterId)
      } else {
        newSet.delete(chapterId)
      }
      return newSet
    })
  }, [])

  // Select all/deselect all handler
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!extractedChapters) return

    if (checked) {
      setSelectedChapters(new Set(extractedChapters.map(chapter => chapter.id)))
    } else {
      setSelectedChapters(new Set())
    }
  }, [extractedChapters])

  // Function to clear whole book cache
  const clearBookCache = () => {
    if (!file) return

    const mode = processingMode === 'combined-mindmap' ? 'combined_mindmap' : processingMode as 'summary' | 'mindmap'
    const deletedCount = cacheService.clearBookCache(file.name, mode)

    const modeNames = {
      'summary': 'Text Summary',
      'mindmap': 'Chapter Mind Map',
      'combined-mindmap': 'Whole Book Mind Map'
    }

    if (deletedCount > 0) {
  toast.success(`Cleared ${deletedCount} ${modeNames[processingMode]} cache items. Content will be regenerated next time.`, {
        duration: 3000,
        position: 'top-center',
      })
    } else {
  toast.info(`No ${modeNames[processingMode]} cache found to clear.`, {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // Function to extract chapters
  const extractChapters = useCallback(async () => {
    if (!file) {
      toast.error(t('upload.pleaseSelectFile'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }

    setExtractingChapters(true)
    setProgress(0)
    setCurrentStep('')

    try {
      let extractedBookData: { title: string; author: string }
      let chapters: ChapterData[]

      const isEpub = file.name.endsWith('.epub')
      const isPdf = file.name.endsWith('.pdf')

      if (isEpub) {
        const processor = new EpubProcessor()
  setCurrentStep('Parsing EPUB file...')
        const bookData = await processor.parseEpub(file)
        extractedBookData = { title: bookData.title, author: bookData.author }
        setFullBookData(bookData) // 保存完整的BookData对象
        setProgress(50)

  setCurrentStep('Extracting chapter content...')
        chapters = await processor.extractChapters(bookData.book, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth)
      } else if (isPdf) {
        const processor = new PdfProcessor()
  setCurrentStep('Parsing PDF file...')
        const bookData = await processor.parsePdf(file)
        extractedBookData = { title: bookData.title, author: bookData.author }
        setFullBookData(bookData) // 保存完整的BookData对象
        setProgress(50)

  setCurrentStep('Extracting chapter content...')
        chapters = await processor.extractChapters(file, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth)
      } else {
  throw new Error('Unsupported file format')
      }
      setProgress(100)

      setBookData(extractedBookData)
      setExtractedChapters(chapters)
      // All chapters are selected by default
      setSelectedChapters(new Set(chapters.map(chapter => chapter.id)))
      setCurrentStep(t('progress.chaptersExtracted', { count: chapters.length }))

      toast.success(t('progress.successfullyExtracted', { count: chapters.length }), {
        duration: 3000,
        position: 'top-center',
      })
    } catch (err) {
  toast.error(err instanceof Error ? err.message : t('progress.extractionError'), {
        duration: 5000,
        position: 'top-center',
      })
    } finally {
      setExtractingChapters(false)
    }
  }, [file, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth, t])

  const processEbook = useCallback(async () => {
    if (!extractedChapters || !bookData || !apiKey) {
      toast.error(t('chapters.extractAndApiKey'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }
    if (!file) return

    if (selectedChapters.size === 0) {
      toast.error(t('chapters.selectAtLeastOne'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }

    // Clear previous content when starting a new task
    setCurrentStepIndex(2)
    setBookSummary(null)
    setBookMindMap(null)
    setProcessing(true)
    setProgress(0)
    setCurrentStep('')

    try {
      const aiService = new AIService(() => {
        const currentState = useConfigStore.getState()
        const currentAiConfig = currentState.aiConfig
        return {
          provider: currentAiConfig.provider,
          apiKey: currentAiConfig.apiKey,
          apiUrl: currentAiConfig.provider === 'openai' ? currentAiConfig.apiUrl : undefined,
          model: currentAiConfig.model || undefined,
          temperature: currentAiConfig.temperature
        }
      })

  // Only process selected chapters
      const chapters = extractedChapters.filter(chapter => selectedChapters.has(chapter.id))

      const totalChapters = chapters.length
      const processedChapters: Chapter[] = []

  // Initialize state based on mode
      if (processingMode === 'summary') {
        setBookSummary({
          title: bookData.title,
          author: bookData.author,
          chapters: [],
          connections: '',
          overallSummary: ''
        })
      } else if (processingMode === 'mindmap' || processingMode === 'combined-mindmap') {
        setBookMindMap({
          title: bookData.title,
          author: bookData.author,
          chapters: [],
          combinedMindMap: null
        })
      }

  // Step 3: Process chapters one by one
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
  setCurrentStep(`Processing chapter ${i + 1}/${totalChapters}: ${chapter.title}`)

        let processedChapter: Chapter

        if (processingMode === 'summary') {
          // Text summary mode
          let summary = cacheService.getString(file.name, 'summary', chapter.id)

          if (!summary) {
            summary = await aiService.summarizeChapter(chapter.title, chapter.content, bookType, processingOptions.outputLanguage, customPrompt)
            cacheService.setCache(file.name, 'summary', summary, chapter.id)
          }

          processedChapter = {
            ...chapter,
            summary,
            processed: true
          }

          processedChapters.push(processedChapter)

          setBookSummary(prevSummary => ({
            ...prevSummary!,
            chapters: [...processedChapters]
          }))
        } else if (processingMode === 'mindmap') {
          // Chapter mind map mode
          let mindMap = cacheService.getMindMap(file.name, 'mindmap', chapter.id)

          if (!mindMap) {
            mindMap = await aiService.generateChapterMindMap(chapter.content, processingOptions.outputLanguage, customPrompt)
            cacheService.setCache(file.name, 'mindmap', mindMap, chapter.id)
          }

          if (!mindMap.nodeData) continue // Skip chapters that don't need a summary
          processedChapter = {
            ...chapter,
            mindMap,
            processed: true
          }

          processedChapters.push(processedChapter)

          setBookMindMap(prevMindMap => ({
            ...prevMindMap!,
            chapters: [...processedChapters]
          }))
        } else if (processingMode === 'combined-mindmap') {
          // Whole book mind map mode - only collect chapter content, do not generate individual mind maps
          processedChapter = {
            ...chapter,
            processed: true
          }

          processedChapters.push(processedChapter)

          setBookMindMap(prevMindMap => ({
            ...prevMindMap!,
            chapters: [...processedChapters]
          }))
        }

  setProgress(20 + (i + 1) / totalChapters * 60)
      }

      if (processingMode === 'summary') {
        // Text summary mode follow-up steps
        // Step 4: Analyze chapter connections
        setCurrentStep('Analyzing chapter connections...')
        let connections = cacheService.getString(file.name, 'connections')
        if (!connections) {
          console.log('🔄 [DEBUG] Cache miss, analyzing chapter connections')
          connections = await aiService.analyzeConnections(processedChapters, processingOptions.outputLanguage)
          cacheService.setCache(file.name, 'connections', connections)
          console.log('💾 [DEBUG] Chapter connections cached')
        } else {
          console.log('✅ [DEBUG] Using cached chapter connections')
        }

        setBookSummary(prevSummary => ({
          ...prevSummary!,
          connections
        }))
        setProgress(85)

        // Step 5: Generate overall book summary
        setCurrentStep('Generating overall book summary...')
        let overallSummary = cacheService.getString(file.name, 'overall_summary')
        if (!overallSummary) {
          console.log('🔄 [DEBUG] Cache miss, generating overall book summary')
          overallSummary = await aiService.generateOverallSummary(
            bookData.title,
            processedChapters,
            connections!,
            processingOptions.outputLanguage
          )
          cacheService.setCache(file.name, 'overall_summary', overallSummary)
          console.log('💾 [DEBUG] Overall book summary cached')
        } else {
          console.log('✅ [DEBUG] Using cached overall book summary')
        }

        setBookSummary(prevSummary => ({
          ...prevSummary!,
          overallSummary
        }))
      } else if (processingMode === 'mindmap') {
        // Chapter mind map mode follow-up steps
        // Step 4: Merge chapter mind maps
        setCurrentStep('Merging chapter mind maps...')
        let combinedMindMap = cacheService.getMindMap(file.name, 'merged_mindmap')
        if (!combinedMindMap) {
          console.log('🔄 [DEBUG] Cache miss, merging chapter mind maps')
          // Create root node
          const rootNode = {
            topic: bookData.title,
            id: '0',
            tags: ['Whole Book'],
            children: processedChapters.map((chapter, index) => ({
              topic: chapter.title,
              id: `chapter_${index + 1}`,
              children: chapter.mindMap?.nodeData?.children || []
            }))
          }

          combinedMindMap = {
            nodeData: rootNode,
            arrows: [],
            summaries: processedChapters.reduce((acc, chapter) => acc.concat(chapter.mindMap?.summaries || []), [] as Summary[])
          }

          cacheService.setCache(file.name, 'merged_mindmap', combinedMindMap)
          console.log('💾 [DEBUG] Merged mind map cached')
        } else {
          console.log('✅ [DEBUG] Using cached merged mind map')
        }

        setProgress(85)

        setBookMindMap(prevMindMap => ({
          ...prevMindMap!,
          combinedMindMap
        }))
      } else if (processingMode === 'combined-mindmap') {
        // Whole book mind map mode follow-up steps
        // Step 4: Generate whole book mind map
        setCurrentStep('Generating whole book mind map...')
        let combinedMindMap = cacheService.getMindMap(file.name, 'combined_mindmap')
        if (!combinedMindMap) {
          console.log('🔄 [DEBUG] Cache miss, generating whole book mind map')
          combinedMindMap = await aiService.generateCombinedMindMap(bookData.title, processedChapters, customPrompt)
          cacheService.setCache(file.name, 'combined_mindmap', combinedMindMap)
          console.log('💾 [DEBUG] Whole book mind map cached')
        } else {
          console.log('✅ [DEBUG] Using cached whole book mind map')
        }

        setBookMindMap(prevMindMap => ({
          ...prevMindMap!,
          combinedMindMap
        }))
        setProgress(85)
      }

      setProgress(100)
  setCurrentStep('Processing complete!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('progress.processingError'), {
        duration: 5000,
        position: 'top-center',
      })
    } finally {
      setProcessing(false)
    }
  }, [extractedChapters, bookData, apiKey, file, selectedChapters, processingMode, bookType, customPrompt, processingOptions.outputLanguage, t])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex justify-center gap-4 h-screen overflow-auto scroll-container">
      <Toaster />
      <div className="max-w-6xl space-y-6 w-[800px] shrink-0">
        <div className="text-center space-y-2 relative">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            {t('app.title')}
          </h1>
          <p className="text-gray-600">{t('app.description')}</p>
          <LanguageSwitcher />
        </div>

        {currentStepIndex === 1 ? (
          <>
            {/* File upload and configuration */}
            <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('upload.title')}
            </CardTitle>
            <CardDescription>
              {t('upload.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">{t('upload.selectFile')}</Label>
              <Input
                id="file"
                type="file"
                accept=".epub,.pdf"
                onChange={handleFileChange}
                disabled={processing}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                {t('upload.selectedFile')}: {file?.name || t('upload.noFileSelected')}
              </div>
              <div className="flex items-center gap-2">
                <ConfigDialog processing={processing} file={file} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBookCache}
                  disabled={processing}
                  className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('upload.clearCache')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Button
                onClick={extractChapters}
                disabled={!file || extractingChapters || processing}
                className="w-full"
              >
                {extractingChapters ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('upload.extractingChapters')}
                  </>
                ) : (
                  <>
                    <List className="mr-2 h-4 w-4" />
                    {t('upload.extractChapters')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
            {/* 章节信息 */}
            {extractedChapters && bookData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    {t('chapters.title')}
                  </CardTitle>
                  <CardDescription>
                    {bookData.title} - {bookData.author} | {t('chapters.totalChapters', { count: extractedChapters.length })}，{t('chapters.selectedChapters', { count: selectedChapters.size })}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedChapters.size === extractedChapters.length}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                    <Label htmlFor="select-all" className="text-sm font-medium">
                      {t('chapters.selectAll')}
                    </Label>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {extractedChapters.map((chapter) => (
                      <div key={chapter.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <Checkbox
                          id={`chapter-${chapter.id}`}
                          checked={selectedChapters.has(chapter.id)}
                          onCheckedChange={(checked) => handleChapterSelect(chapter.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={`chapter-${chapter.id}`}
                          className="text-sm truncate cursor-pointer flex-1"
                          title={chapter.title}
                        >
                          {chapter.title}
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentReadingChapter(chapter)}
                        >
                          <BookOpen className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* 自定义提示词输入框 */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-prompt" className="text-sm font-medium">
                      {t('chapters.customPrompt')}
                    </Label>
                    <Textarea
                      id="custom-prompt"
                      placeholder={t('chapters.customPromptPlaceholder')}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="min-h-20 resize-none"
                      disabled={processing || extractingChapters}
                    />
                    <p className="text-xs text-gray-500">
                      {t('chapters.customPromptDescription')}
                    </p>
                  </div>

                  <Button
                    onClick={() => {
                      if (!apiKey) {
                        toast.error(t('chapters.apiKeyRequired'), {
                          duration: 3000,
                          position: 'top-center',
                        })
                        return
                      }
                      processEbook()
                    }}
                    disabled={!extractedChapters || processing || extractingChapters || selectedChapters.size === 0}
                    className="w-full"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('chapters.processing')}
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        {t('chapters.startProcessing')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* 步骤2: 处理过程和结果显示 */}
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStepIndex(1)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('common.backToConfig')}
              </Button>
              <div className="text-lg font-medium text-gray-700">
                {bookData ? `${bookData.title} - ${bookData.author}` : '处理中...'}
              </div>
            </div>
            {/* 处理进度 */}
            {(processing || extractingChapters) && (
              <Card>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{currentStep}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 结果展示 */}
            {(bookSummary || bookMindMap) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {processingMode === 'summary' ? (
                      <><BookOpen className="h-5 w-5" />{t('results.summaryTitle', { title: bookSummary?.title })}</>
                    ) : processingMode === 'mindmap' ? (
                      <><Network className="h-5 w-5" />{t('results.chapterMindMapTitle', { title: bookMindMap?.title })}</>
                    ) : (
                      <><Network className="h-5 w-5" />{t('results.wholeMindMapTitle', { title: bookMindMap?.title })}</>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {t('results.author', { author: bookSummary?.author || bookMindMap?.author })} | {t('results.chapterCount', { count: bookSummary?.chapters.length || bookMindMap?.chapters.length })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {processingMode === 'summary' && bookSummary ? (
                    <Tabs defaultValue="chapters" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="chapters">{t('results.tabs.chapterSummary')}</TabsTrigger>
                        <TabsTrigger value="connections">{t('results.tabs.connections')}</TabsTrigger>
                        <TabsTrigger value="overall">{t('results.tabs.overallSummary')}</TabsTrigger>
                      </TabsList>

                      <TabsContent value="chapters" className="grid grid-cols-1 gap-4">
                        {bookSummary.chapters.map((chapter, index) => (
                          <MarkdownCard
                            key={chapter.id}
                            id={chapter.id}
                            title={chapter.title}
                            content={chapter.content}
                            markdownContent={chapter.summary || ''}
                            index={index}
                            defaultCollapsed={index > 0}
                            onClearCache={clearChapterCache}
                            onReadChapter={() => {
                              // 根据章节ID找到对应的ChapterData
                              const chapterData = extractedChapters?.find(ch => ch.id === chapter.id)
                              if (chapterData) {
                                setCurrentReadingChapter(chapterData)
                              }
                            }}
                          />
                        ))}
                      </TabsContent>

                      <TabsContent value="connections">
                        <MarkdownCard
                          id="connections"
                          title={t('results.tabs.connections')}
                          content={bookSummary.connections}
                          markdownContent={bookSummary.connections}
                          index={0}
                          showClearCache={true}
                          showViewContent={false}
                          showCopyButton={true}
                          onClearCache={() => clearSpecificCache('connections')}
                        />
                      </TabsContent>

                      <TabsContent value="overall">
                        <MarkdownCard
                          id="overall"
                          title={t('results.tabs.overallSummary')}
                          content={bookSummary.overallSummary}
                          markdownContent={bookSummary.overallSummary}
                          index={0}
                          showClearCache={true}
                          showViewContent={false}
                          showCopyButton={true}
                          onClearCache={() => clearSpecificCache('overall_summary')}
                        />
                      </TabsContent>
                    </Tabs>
                  ) : processingMode === 'mindmap' && bookMindMap ? (
                    <Tabs defaultValue="chapters" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="chapters">{t('results.tabs.chapterMindMaps')}</TabsTrigger>
                        <TabsTrigger value="combined">{t('results.tabs.combinedMindMap')}</TabsTrigger>
                      </TabsList>

                      <TabsContent value="chapters" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bookMindMap.chapters.map((chapter, index) => (
                          chapter.mindMap && (
                            <MindMapCard
                              key={chapter.id}
                              id={chapter.id}
                              title={chapter.title}
                              content={chapter.content}
                              mindMapData={chapter.mindMap}
                              index={index}
                              showCopyButton={false}
                              onClearCache={clearChapterCache}
                              onOpenInMindElixir={openInMindElixir}
                              onDownloadMindMap={downloadMindMap}
                              mindElixirOptions={options}
                            />
                          )
                        ))}
                      </TabsContent>

                      <TabsContent value="combined">
                        {bookMindMap.combinedMindMap ? (
                          <MindMapCard
                            id="combined"
                            title={t('results.tabs.combinedMindMap')}
                            content=""
                            mindMapData={bookMindMap.combinedMindMap}
                            index={0}
                            onOpenInMindElixir={(mindmapData) => openInMindElixir(mindmapData, t('results.combinedMindMapTitle', { title: bookMindMap.title }))}
                            onDownloadMindMap={downloadMindMap}
                            onClearCache={() => clearSpecificCache('merged_mindmap')}
                            showClearCache={true}
                            showViewContent={false}
                            showCopyButton={false}
                            mindMapClassName="w-full h-[600px] mx-auto"
                            mindElixirOptions={options}
                          />
                        ) : (
                          <Card>
                            <CardContent>
                              <div className="text-center text-gray-500 py-8">
                                {t('results.generatingMindMap')}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : processingMode === 'combined-mindmap' && bookMindMap ? (
                    bookMindMap.combinedMindMap ? (
                      <MindMapCard
                        id="whole-book"
                        title={t('results.tabs.combinedMindMap')}
                        content=""
                        mindMapData={bookMindMap.combinedMindMap}
                        index={0}
                        onOpenInMindElixir={(mindmapData) => openInMindElixir(mindmapData, t('results.combinedMindMapTitle', { title: bookMindMap.title }))}
                        onDownloadMindMap={downloadMindMap}
                        onClearCache={() => clearSpecificCache('combined_mindmap')}
                        showClearCache={true}
                        showViewContent={false}
                        showCopyButton={false}
                        mindMapClassName="w-full h-[600px] mx-auto"
                        mindElixirOptions={options}
                      />
                    ) : (
                      <Card>
                        <CardContent>
                          <div className="text-center text-gray-500 py-8">
                            {t('results.generatingMindMap')}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  ) : null}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
      
      {/* 阅读组件插入到这里 */}
      {currentReadingChapter && file && (
        file.name.endsWith('.epub') ? (
          <EpubReader
            className="w-[800px] shrink-0 sticky top-0"
            chapter={currentReadingChapter}
            bookData={fullBookData || undefined}
            onClose={() => setCurrentReadingChapter(null)}
          />
        ) : file.name.endsWith('.pdf') ? (
          <PdfReader
            className="w-[800px] shrink-0 sticky top-0"
            chapter={currentReadingChapter}
            bookData={fullBookData || undefined}
            onClose={() => setCurrentReadingChapter(null)}
          />
        ) : null
      )}

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 hover:bg-blue-700"
          size="icon"
          aria-label={t('common.backToTop')}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}

export default App
