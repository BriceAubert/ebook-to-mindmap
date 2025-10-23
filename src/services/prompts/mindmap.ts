export const getChapterMindMapPrompt = ()=> {
  const userPrompt = `\`\`\`ts
export interface NodeObj {
  topic: string
  id: string
  tags?: string[]
  children?: NodeObj[]
}
// Summarize the content of nodes from start to end under the same parent id
export interface Summary {
  id: string
  label: string
  /**
   * parent node id of the summary
   */
  parent: string
  /**
   * start index of the summary
   */
  start: number
  /**
   * end index of the summary
   */
  end: number
}
\`\`\`

Reply to the user with JSON in the format {
  nodeData: NodeObj
  summaries?: Summary[]
}, which is a recursive structure representing **mind map data**.

**Note!! nodeData and summaries must be at the same level!!**

**Strictly follow these rules**：
- Node IDs should use incrementing numbers
- Do not always use sibling relationships; apply parent-child hierarchy appropriately
- Optionally insert tags into nodes: core, case, practice, golden quote
- Summary is a tool to summarize multiple sibling nodes under the same parent; use curly braces to display summary text beside specified child nodes. Since nodes may be distributed on both sides, do not summarize the root node
- Add summaries appropriately, do not add unnecessary summaries
- Add a golden quote node at the end to record a few key quotes from the chapter
- Add emojis to express the meaning of nodes where appropriate
- Ensure the JSON format is correct; do not return anything except JSON
- If the content is acknowledgments, table of contents, preface, foreword, references, publisher introduction, citation notes, etc., please reply directly with "{nodeData:null}"
`
  
  return userPrompt
}

export const getMindMapArrowPrompt = () => {
  const userPrompt = `You need to add arrow connections to the existing mind map to show relationships between different nodes.
\`\`\`ts
export interface NodeObj {
  topic: string
  id: string
  tags?: string[]
  children?: NodeObj[]
}

export interface Arrow {
  id: string
  /**
   * label of arrow
   */
  label: string
  /**
   * id of start node
   */
  from: string
  /**
   * id of end node
   */
  to: string
  /**
   * offset of control point from start point
   */
  delta1: {
    x: number
    y: number
  }
  /**
   * offset of control point from end point
   */
  delta2: {
    x: number
    y: number
  }
  /**
   * whether the arrow is bidirectional
   */
  bidirectional?: boolean
}
\`\`\`

Reply with JSON in the format  {
  arrows?: Arrow[]
}.


**Strictly follow these rules**：
- Arrow can add connections between any nodes; label indirectly explains the relationship between two nodes; delta default value is 50,50. **Direct parent-child relationships do not need arrows**
- **Do not use Arrow for direct parent-child relationships**
- Add no more than 6 Arrows; only link the most critical node relationships
- Ensure the JSON format is correct; do not return anything except JSON
`
  
  return userPrompt
}