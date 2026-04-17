/**
 * Image Overlay Service - Provides image comparison with overlay/blend modes
 */

export interface OverlayOptions {
  opacity: number // 0-100, opacity of top image
  mode: 'overlay' | 'alternate' | 'side-by-side'
  blinkInterval?: number // ms for alternate mode
}

export interface ImageDiffResult {
  width: number
  height: number
  diffPixels: number
  similarityPercent: number
  imageData: ImageData
}

class ImageOverlayService {
  /**
   * Create blended overlay of two images
   */
  createOverlay(leftImage: HTMLImageElement, rightImage: HTMLImageElement, options: OverlayOptions): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = Math.max(leftImage.width, rightImage.width)
    canvas.height = Math.max(leftImage.height, rightImage.height)
    
    // Draw left image (background)
    ctx.drawImage(leftImage, 0, 0)
    
    // Set opacity and draw right image on top
    ctx.globalAlpha = options.opacity / 100
    ctx.drawImage(rightImage, 0, 0)
    ctx.globalAlpha = 1.0
    
    return canvas
  }

  /**
   * Calculate pixel differences between two images
   */
  calculateDiff(leftImage: HTMLImageElement, rightImage: HTMLImageElement): ImageDiffResult {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    const width = Math.min(leftImage.width, rightImage.width)
    const height = Math.min(leftImage.height, rightImage.height)
    
    canvas.width = width
    canvas.height = height
    
    // Draw both images
    ctx.drawImage(leftImage, 0, 0, width, height)
    const leftData = ctx.getImageData(0, 0, width, height)
    
    ctx.drawImage(rightImage, 0, 0, width, height)
    const rightData = ctx.getImageData(0, 0, width, height)
    
    const diffData = ctx.createImageData(width, height)
    let diffPixels = 0
    
    for (let i = 0; i < leftData.data.length; i += 4) {
      const rDiff = Math.abs(leftData.data[i] - rightData.data[i])
      const gDiff = Math.abs(leftData.data[i + 1] - rightData.data[i + 1])
      const bDiff = Math.abs(leftData.data[i + 2] - rightData.data[i + 2])
      
      const totalDiff = rDiff + gDiff + bDiff
      
      if (totalDiff > 30) { // Threshold for considering a pixel different
        diffPixels++
        // Highlight differences in red
        diffData.data[i] = 255
        diffData.data[i + 1] = 0
        diffData.data[i + 2] = 0
        diffData.data[i + 3] = 255
      } else {
        // Copy from left image
        diffData.data[i] = leftData.data[i]
        diffData.data[i + 1] = leftData.data[i + 1]
        diffData.data[i + 2] = leftData.data[i + 2]
        diffData.data[i + 3] = 255
      }
    }
    
    const totalPixels = width * height
    const similarityPercent = ((totalPixels - diffPixels) / totalPixels) * 100
    
    return {
      width,
      height,
      diffPixels,
      similarityPercent,
      imageData: diffData
    }
  }

  /**
   * Generate side-by-side comparison image
   */
  createSideBySide(leftImage: HTMLImageElement, rightImage: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = leftImage.width + rightImage.width
    canvas.height = Math.max(leftImage.height, rightImage.height)
    
    // Fill background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw images
    ctx.drawImage(leftImage, 0, 0)
    ctx.drawImage(rightImage, leftImage.width, 0)
    
    // Draw divider line
    ctx.strokeStyle = '#ff0000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(leftImage.width, 0)
    ctx.lineTo(leftImage.width, canvas.height)
    ctx.stroke()
    
    return canvas
  }

  /**
   * Export comparison result as PNG
   */
  exportComparison(canvas: HTMLCanvasElement, filename: string = 'comparison.png'): void {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
}

export const imageOverlayService = new ImageOverlayService()
