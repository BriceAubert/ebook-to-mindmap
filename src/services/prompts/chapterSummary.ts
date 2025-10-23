// Prompt templates for chapter summary

export const getFictionChapterSummaryPrompt = (title: string, content: string) => {
  const userPrompt = `Please generate a detailed summary for the following chapter:

Chapter Title: ${title}

Chapter Content:
${content}

Summarize the chapter in natural and fluent language, including main plot developments, important character actions, key points or twists, and the chapter's role and significance in the overall story. The summary should be detailed but concise, about 200-300 words.

Note: If the content is acknowledgments, table of contents, preface, foreword, or other pages without substantive story content, please reply directly with "No summary needed".`
  
  return userPrompt
}

export const getNonFictionChapterSummaryPrompt = (title: string, content: string) => {
  const userPrompt = `Please generate a detailed summary for the following non-fiction (social science) book chapter:

Chapter Title: ${title}

Chapter Content:
${content}

Summarize the chapter in natural and fluent language, including:

- Main viewpoints and key concepts
- Important data, cases, or research findings
- Retain a few insightful original statements
- Provide practical advice or applications for real life

Note: If the content is acknowledgments, table of contents, preface, foreword, references, or other pages without substantive academic content, please reply directly with "No summary needed".`
  
  return userPrompt
}