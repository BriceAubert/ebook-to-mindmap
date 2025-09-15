git clone https://github.com/SSShooter/ebook-to-mindmap

# Ebook to Mind Map

An AI-powered intelligent ebook parsing tool that supports converting EPUB and PDF ebooks into structured mind maps and text summaries.

## ✨ Features

### 📚 Multi-format Support

- **EPUB Files**: Full support for parsing and processing EPUB ebooks
- **PDF Files**: Intelligent parsing of PDF documents, supporting chapter extraction based on table of contents and smart detection

### 🤖 AI-driven Content Processing

- **Multiple AI Services**: Supports Google Gemini and OpenAI GPT models
- **Three Processing Modes**:
  - 📝 **Text Summary Mode**: Generate chapter summaries, analyze chapter connections, and output a book-wide summary
  - 🧠 **Chapter Mind Map Mode**: Generate independent mind maps for each chapter
  - 🌐 **Book-wide Mind Map Mode**: Integrate the entire book into a complete mind map

### 🎯 Intelligent Chapter Handling

- **Smart Chapter Detection**: Automatically identify and extract book chapter structures
- **Chapter Filtering**: Skip non-core content such as prefaces, tables of contents, acknowledgments, etc.
- **Flexible Selection**: Users can freely choose which chapters to process
- **Subchapter Support**: Configurable extraction depth for subchapters

### 💾 Efficient Caching Mechanism

- **Smart Caching**: Automatically cache AI processing results to avoid redundant computation
- **Cache Management**: Clear cache by mode to save storage space
- **Offline Viewing**: Processed content can be viewed offline

### 🎨 Modern Interface

- **Responsive Design**: Adapts to all screen sizes
- **Real-time Progress**: Visualized processing steps and current progress
- **Interactive Mind Map**: Supports zooming, dragging, node expand/collapse
- **Content Preview**: View original chapter content

## 🚀 Quick Start

### Requirements

- Node.js 18+
- pnpm (recommended) or npm

### Install Dependencies

```bash
# Clone the project

cd ebook-to-mindmap

# Install dependencies
pnpm install
# or
npm install
# or
yarn install
```

### Start Development Server

```bash
pnpm dev
# or
npm run dev
# or
yarn run dev
```

Visit `http://localhost:5173` to start using.

## 📖 User Guide

### 1. Configure AI Service

First-time users need to configure the AI service:

1. Click the "Configure" button
2. Select an AI service provider:
   - **Google Gemini** (recommended): Requires Gemini API Key
   - **OpenAI GPT**: Requires OpenAI API Key and API URL
3. Enter the corresponding API Key
4. Select a model (optional, default model is fine)

#### Get API Key

**Google Gemini API Key**:

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Log in with your Google account
3. Create a new API Key
4. Copy the API Key into the configuration

**OpenAI API Key**:

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Log in and go to the API Keys page
3. Create a new API Key
4. Copy the API Key into the configuration

There are also some [free options](https://github.com/SSShooter/Video-Summary/blob/master/guide/index.md) for reference.

### 2. Upload Ebook File

1. Click the "Select EPUB or PDF File" button
2. Choose the ebook file to process
3. Supported formats: `.epub`, `.pdf`

### 3. Configure Processing Options

Set processing parameters in the configuration dialog:

#### Processing Mode

- **Text Summary Mode**: Suitable for scenarios requiring text summaries
- **Chapter Mind Map Mode**: Generate independent mind maps for each chapter
- **Book-wide Mind Map Mode**: Generate a unified mind map for the entire book

#### Book Type

- **Fiction**: For novels and stories
- **Non-fiction**: For textbooks, reference books, technical books, etc.

#### Advanced Options

- **Smart Chapter Detection**: Use AI to intelligently identify chapter boundaries
- **Skip Irrelevant Chapters**: Automatically skip prefaces, tables of contents, acknowledgments, etc.
- **Subchapter Depth**: Set the extraction depth for subchapters (0-3)

### 4. Extract Chapters

1. Click the "Extract Chapters" button
2. The system will automatically parse the file and extract the chapter structure
3. After extraction, a chapter list will be displayed
4. You can select which chapters to process (all selected by default)

### 5. Start Processing

1. Confirm the selected chapters
2. Click the "Start Processing" button
3. The system will display processing progress and current steps
4. Results will be shown upon completion

### 6. View Results

Depending on the selected processing mode, you can view different types of results:

#### Text Summary Mode

- **Chapter Summaries**: Detailed summary for each chapter
- **Chapter Connections**: Analyze logical relationships between chapters
- **Book Summary**: Core content summary for the entire book

#### Mind Map Mode

- **Interactive Mind Map**: Zoomable, draggable mind map
- **Node Details**: Click nodes to view detailed content
- **Export Function**: Export as image or other formats

## 🛠️ Technical Architecture

### Core Tech Stack

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **File Parsing**:
  - EPUB: @smoores/epub + epubjs
  - PDF: pdfjs-dist
- **Mind Map**: mind-elixir
- **AI Services**:
  - Google Gemini: @google/generative-ai
  - OpenAI: Custom implementation

## 🔧 Advanced Features

### Cache Management

The system automatically caches AI processing results for efficiency:

- **Auto Caching**: Results are automatically saved locally
- **Smart Reuse**: Identical content is not processed repeatedly
- **Cache Cleaning**: Clear specific types of cache by mode
- **Storage Optimization**: Cached data is compressed to save space

### Batch Processing

- **Chapter Selection**: Batch select/deselect chapters
- **Concurrent Processing**: Multiple chapters can be processed in parallel (API limits apply)
- **Resume from Breakpoint**: Resume from last position if interrupted

### Export Function

- **Mind Map Export**: Export as PNG, SVG, etc.
- **Text Summary Export**: Export as Markdown, TXT, etc.
- **Data Backup**: Export processed result data

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

Thanks to the following open source projects:

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [mind-elixir](https://github.com/ssshooter/mind-elixir-core)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [epub.js](https://github.com/futurepress/epub.js/)

---

If you have any questions or suggestions, feel free to submit an issue or contact the developer.
