# EPUB Structure Explanation

## Relationship Between TOC (Table of Contents) and Spine

### Spine

- **Definition**: Defines the **linear reading order** of all content files in the EPUB
- **Purpose**: Tells the reader in what order to display content
- **Features**:
  - Contains all content files (HTML/XHTML)
  - Strictly arranged in reading order
  - Each file has a spineIndex (0, 1, 2, ...)
  - Acts as the "skeleton" of the EPUB
  - Used for programmatic precise positioning

### TOC (Table of Contents)

- **Definition**: Provides the **navigation structure** for the reader
- **Purpose**: Allows readers to quickly jump to chapters of interest
- **Features**:
  - May not include all files in the spine
  - May have hierarchical structure (chapter, section, subsection)
  - Mainly for user navigation
  - Acts as a user-facing "index"
  - Provides meaningful chapter titles

## Structure Comparison

```
EPUB Structure:
├── Spine (Linear Order)
│   ├── 0: cover.html
│   ├── 1: preface.html
│   ├── 2: chapter1.html
│   ├── 3: chapter2.html
│   ├── 4: chapter3.html
│   └── 5: appendix.html
│
└── TOC (Navigation)
    ├── Preface → preface.html (spineIndex: 1)
    ├── Chapter 1 → chapter1.html (spineIndex: 2)
    ├── Chapter 2 → chapter2.html (spineIndex: 3)
    └── Chapter 3 → chapter3.html (spineIndex: 4)
    // Note: cover.html and appendix.html may not be in the TOC
```

## Practical Differences

### Content Included in Spine but Not in TOC:

- Cover page
- Copyright page
- Blank pages
- Appendix (sometimes)

### Advantages of TOC:

- Meaningful chapter titles
- Hierarchical structure
- User-friendly

### Advantages of Spine:

- Complete content coverage
- Precise position indexing
- More reliable for programmatic operations

## Application in Code

### ChapterData Field Explanation

```typescript
export interface ChapterData {
  id: string;
  title: string;
  content: string;
  // Chapter positioning info, used to open the corresponding book page later
  spineIndex?: number; // Index position in spine (main positioning method)
  href?: string; // Chapter href path (backup positioning and debugging info)
  tocItem?: NavItem; // Original TOC item info
  depth?: number; // Chapter hierarchical depth
}
```

### Why Combine Both:

- Use **TOC** to get meaningful chapter titles and structure
- Use **Spine** to get precise position index for navigation
- `href` (from TOC) and `spineIndex` (from Spine) bridge these two systems

### Usage Example:

```typescript
// Get chapter info (title, hierarchy) from TOC
const toc = book.navigation.toc;

// Find corresponding spineIndex via href
const spineIndex = this.getSpineIndex(book, chapterInfo.href);

// Jump to chapter (prefer spineIndex)
const jumpToChapter = (chapterData: ChapterData) => {
  if (chapterData.spineIndex !== undefined) {
    book.rendition.display(chapterData.spineIndex);
  } else if (chapterData.href) {
    book.rendition.display(chapterData.href);
  }
};
```

## Summary

TOC and Spine are two core organizational structures of EPUB:

- **TOC** is user-oriented, providing navigation and titles
- **Spine** is program-oriented, providing precise positioning
- Using both together enables chapter management that is both user-friendly and programmatically reliable
