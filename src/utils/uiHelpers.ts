import { toast } from 'sonner'
import { launchMindElixir } from '@mind-elixir/open-desktop'
import { downloadMethodList } from '@mind-elixir/export-mindmap'
import type { MindElixirData, MindElixirInstance } from 'mind-elixir'

/**
 * Scroll to top of the page
 */
export const scrollToTop = () => {
  const scrollContainer = document.querySelector('.scroll-container')
  if (scrollContainer) {
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }
}

/**
 * Open mind map in MindElixir Desktop
 * @param mindmapData Mind map data
 * @param title Mind map title
 */
export const openInMindElixir = async (mindmapData: MindElixirData, title: string) => {
  try {
    await launchMindElixir(mindmapData)
    toast.success(`Successfully sent "${title}" to Mind Elixir Desktop`, {
      duration: 3000,
      position: 'top-center',
    })
  } catch (error) {
    console.error('Failed to launch Mind Elixir:', error)
    toast.error('Failed to launch Mind Elixir', {
      duration: 5000,
      position: 'top-center',
    })
  }
}

/**
 * Download mind map
 * @param mindElixirInstance MindElixir instance
 * @param title Mind map title
 * @param format Export format
 */
export const downloadMindMap = async (mindElixirInstance: MindElixirInstance, title: string, format: string) => {
  try {
    // Find the corresponding download method
    const method = downloadMethodList.find((item) => item.type === format)
    if (!method) {
      throw new Error(`Unsupported format: ${format}`)
    }

  // Execute download
  await method.download(mindElixirInstance)

    toast.success(`${title} successfully exported as ${format} format`, {
      duration: 3000,
      position: 'top-center',
    })
  } catch (error) {
    console.error('Failed to export mind map:', error)
    toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      duration: 5000,
      position: 'top-center',
    })
  }
}
