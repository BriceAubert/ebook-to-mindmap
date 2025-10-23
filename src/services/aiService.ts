import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  getFictionChapterSummaryPrompt,
  getNonFictionChapterSummaryPrompt,
  getChapterConnectionsAnalysisPrompt,
  getOverallSummaryPrompt,
  getTestConnectionPrompt,
  getChapterMindMapPrompt,
  getMindMapArrowPrompt,
} from './prompts'
import type { MindElixirData } from 'mind-elixir'
import { getLanguageInstruction, type SupportedLanguage } from './prompts/utils'

interface Chapter {
  id: string
  title: string
  content: string
  summary?: string
}

interface AIConfig {
  provider: 'gemini' | 'openai'
  apiKey: string
  apiUrl?: string // For OpenAI-compatible API URL
  model?: string
  temperature?: number
}

export class AIService {
  private config: AIConfig | (() => AIConfig)
  private genAI?: GoogleGenerativeAI
  private model: any

  constructor(config: AIConfig | (() => AIConfig)) {
    this.config = config
    
    const currentConfig = typeof config === 'function' ? config() : config
    
    if (currentConfig.provider === 'gemini') {
      this.genAI = new GoogleGenerativeAI(currentConfig.apiKey)
      this.model = this.genAI.getGenerativeModel({ 
        model: currentConfig.model || 'gemini-2.0-flash'
      })
    } else if (currentConfig.provider === 'openai') {
      // OpenAI-compatible configuration
      this.model = {
        apiUrl: currentConfig.apiUrl || 'https://api.openai.com/v1',
        apiKey: currentConfig.apiKey,
        model: currentConfig.model || 'gpt-3.5-turbo'
      }
    }
  }

  private getCurrentConfig(): AIConfig {
    return typeof this.config === 'function' ? this.config() : this.config
  }

  async summarizeChapter(title: string, content: string, bookType: 'fiction' | 'non-fiction' = 'non-fiction', outputLanguage: SupportedLanguage = 'en', customPrompt?: string): Promise<string> {
    try {
      let prompt = bookType === 'fiction'
        ? getFictionChapterSummaryPrompt(title, content)
        : getNonFictionChapterSummaryPrompt(title, content)

      // If there is a custom prompt, append it to the original prompt
      if (customPrompt && customPrompt.trim()) {
        prompt += `\n\nAdditional requirements: ${customPrompt.trim()}`
      }

      const summary = await this.generateContent(prompt, outputLanguage)

      if (!summary || summary.trim().length === 0) {
        throw new Error('AI returned an empty summary')
      }

      return summary.trim()
    } catch (error) {
      throw new Error(`Chapter summary failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeConnections(chapters: Chapter[], outputLanguage: SupportedLanguage = 'en'): Promise<string> {
    try {
      // Build chapter summary information
      const chapterSummaries = chapters.map((chapter) => 
        `${chapter.title}:\n${chapter.summary || 'No summary'}`
      ).join('\n\n')

      const prompt = getChapterConnectionsAnalysisPrompt(chapterSummaries)

      const connections = await this.generateContent(prompt, outputLanguage)

      if (!connections || connections.trim().length === 0) {
        throw new Error('AI returned an empty connection analysis')
      }

      return connections.trim()
    } catch (error) {
      throw new Error(`Chapter connection analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateOverallSummary(
    bookTitle: string, 
    chapters: Chapter[], 
    connections: string,
    outputLanguage: SupportedLanguage = 'en'
  ): Promise<string> {
    try {
      // Build simplified chapter information
      const chapterInfo = chapters.map((chapter, index) => 
        `Chapter ${index + 1}: ${chapter.title}, Content: ${chapter.summary || 'No summary'}`
      ).join('\n')

      const prompt = getOverallSummaryPrompt(bookTitle, chapterInfo, connections)

      const summary = await this.generateContent(prompt, outputLanguage)

      if (!summary || summary.trim().length === 0) {
        throw new Error('AI returned an empty overall summary')
      }

      return summary.trim()
    } catch (error) {
      throw new Error(`Overall summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateChapterMindMap(content: string, outputLanguage: SupportedLanguage = 'en', customPrompt?: string): Promise<MindElixirData> {
    try {
      const basePrompt = getChapterMindMapPrompt()
      let prompt = basePrompt + `Chapter content:\n${content}`

      // If there is a custom prompt, append it to the original prompt
      if (customPrompt && customPrompt.trim()) {
        prompt += `\n\nAdditional requirements: ${customPrompt.trim()}`
      }

      const mindMapJson = await this.generateContent(prompt, outputLanguage)

      if (!mindMapJson || mindMapJson.trim().length === 0) {
        throw new Error('AI returned empty mind map data')
      }
      
      // Try to parse JSON
      try {
        return JSON.parse(mindMapJson.trim())
      } catch (parseError) {
        // Try to extract JSON from code block
        const jsonMatch = mindMapJson.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch && jsonMatch[1]) {
          try {
            return JSON.parse(jsonMatch[1].trim())
          } catch (extractError) {
            throw new Error('AI returned mind map data in incorrect format')
          }
        }
        throw new Error('AI returned mind map data in incorrect format')
      }
    } catch (error) {
      throw new Error(`Chapter mind map generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateMindMapArrows(combinedMindMapData: any, outputLanguage: SupportedLanguage = 'en'): Promise<any> {
    try {
      const basePrompt = getMindMapArrowPrompt()
      const prompt = basePrompt + `\n\nCurrent mind map data:\n${JSON.stringify(combinedMindMapData, null, 2)}`

      const arrowsJson = await this.generateContent(prompt, outputLanguage)

      if (!arrowsJson || arrowsJson.trim().length === 0) {
        throw new Error('AI returned empty arrow data')
      }

      // Try to parse JSON
      try {
        return JSON.parse(arrowsJson.trim())
      } catch (parseError) {
        // Try to extract JSON from code block
        const jsonMatch = arrowsJson.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch && jsonMatch[1]) {
          try {
            return JSON.parse(jsonMatch[1].trim())
          } catch (extractError) {
            throw new Error('AI returned arrow data in incorrect format')
          }
        }
        throw new Error('AI returned arrow data in incorrect format')
      }
    } catch (error) {
      throw new Error(`Mind map arrow generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateCombinedMindMap(bookTitle: string, chapters: Chapter[], customPrompt?: string): Promise<MindElixirData> {
    try {
      const basePrompt = getChapterMindMapPrompt()
      const chaptersContent = chapters.map(item=>item.content).join('\n\n ------------- \n\n')
      let prompt = `${basePrompt}
        Please generate a complete mind map for the entire book "${bookTitle}", integrating the content of all chapters.
        Chapter content:\n${chaptersContent}`

      // If there is a custom prompt, append it to the original prompt
      if (customPrompt && customPrompt.trim()) {
        prompt += `\n\nAdditional requirements: ${customPrompt.trim()}`
      }

      const mindMapJson = await this.generateContent(prompt, 'en')

      if (!mindMapJson || mindMapJson.trim().length === 0) {
        throw new Error('AI returned empty mind map data')
      }
      
      // Try to parse JSON
      try {
        return JSON.parse(mindMapJson.trim())
      } catch (parseError) {
        // Try to extract JSON from code block
        const jsonMatch = mindMapJson.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch && jsonMatch[1]) {
          try {
            return JSON.parse(jsonMatch[1].trim())
          } catch (extractError) {
            throw new Error('AI returned mind map data in incorrect format')
          }
        }
        throw new Error('AI returned mind map data in incorrect format')
      }
    } catch (error) {
      throw new Error(`Combined mind map generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Unified content generation method
  private async generateContent(prompt: string, outputLanguage?: SupportedLanguage): Promise<string> {
    const config = this.getCurrentConfig()
    const language = outputLanguage || 'en'
    const systemPrompt = getLanguageInstruction(language)
    
    if (config.provider === 'gemini') {
      // Gemini API does not directly support system prompt; merge system prompt into user prompt
      const finalPrompt = `${prompt}\n\n**${systemPrompt}**`
      const result = await this.model.generateContent(finalPrompt, {
        generationConfig: {
          temperature: config.temperature || 0.7
        }
      })
      const response = await result.response
      return response.text()
    } else if (config.provider === 'openai') {
      const messages: Array<{role: 'system' | 'user', content: string}> = [
        {
          role: 'user',
          content: prompt + '\n\n' + systemPrompt
        }
      ]
      
      const response = await fetch(`${this.model.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.model.apiKey}`
        },
        body: JSON.stringify({
          model: this.model.model,
          messages,
          temperature: config.temperature || 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0]?.message?.content || ''
    }
    
    throw new Error('Unsupported AI provider')
  }

  // Helper method: test API connection
  async testConnection(): Promise<boolean> {
    try {
      const text = await this.generateContent(getTestConnectionPrompt())
      return text.includes('connection successful') || text.includes('success')
    } catch (error) {
      return false
    }
  }
}

// Maintain backward compatibility
export class AiService extends AIService {
  constructor(apiKey: string) {
    super({ provider: 'gemini', apiKey })
  }
}