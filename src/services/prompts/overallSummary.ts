// Prompt templates for overall book summary

export const getOverallSummaryPrompt = (bookTitle: string, chapterInfo: string, connections: string) => {
  const userPrompt = `Book chapter structure:
${chapterInfo}

Chapter connection analysis:
${connections}

The above are the key contents of "${bookTitle}". Please generate a comprehensive summary report to help readers quickly grasp the essence of the book.`
  
  return userPrompt
}