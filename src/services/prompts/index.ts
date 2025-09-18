// Prompt模板统一导出文件

export {
  getFictionChapterSummaryPrompt,
  getNonFictionChapterSummaryPrompt
} from './chapterSummary'

export {
  getChapterConnectionsAnalysisPrompt
} from './connectionAnalysis'

export {
  getOverallSummaryPrompt
} from './overallSummary'

// 测试连接的prompt
export const getTestConnectionPrompt = () => 'Please reply "Connection successful"'

export {
  getChapterMindMapPrompt,
  getMindMapArrowPrompt
} from './mindmap'