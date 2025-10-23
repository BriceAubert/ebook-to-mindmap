// Prompt templates for chapter connection analysis

export const getChapterConnectionsAnalysisPrompt = (chapterSummaries: string) => {
  const userPrompt = `Please help analyze the relationships between chapters in this book and summarize the core content:

${chapterSummaries}

Please analyze from the following aspects:

## 1. Connections between chapters
- How do the chapters develop the discussion step by step?
- Which important viewpoints are repeatedly mentioned in different chapters?
- How do earlier chapters lay the groundwork for later content?

## 2. Core theme of the book
- What is the main message the book wants to convey to readers?
- What are the author's main viewpoints?
- What important concepts deserve special attention?

## 3. Practical value
- What guidance does this book offer for real life?
- What practical knowledge or methods can readers learn?
- Which viewpoints might change our way of thinking?

## 4. Concise summary
- Summarize the essence of the book in a few sentences
- Recommend to what kind of readers
- What is the greatest takeaway from reading this book

Please use clear and accessible language so that ordinary readers can easily understand the value and significance of the book.`
  
  return userPrompt
}