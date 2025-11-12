/**
 * K线图弹窗网格布局管理器
 */

export interface GridConfig {
  rows: number
  cols: number
  windowWidth: number
  windowHeight: number
  gap: number // 窗口间距
}

export interface WindowPosition {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_WINDOW_WIDTH = 800
const DEFAULT_WINDOW_HEIGHT = 600
const GAP = 0 // 窗口间距（设置为0，让弹窗可以紧密排列）
const EDGE_MARGIN = 0 // 距离屏幕边缘的距离（设置为0，充分利用屏幕空间）
const SCROLLBAR_WIDTH = 15 // 浏览器滚动条宽度

/**
 * 根据窗口数量计算最优网格配置
 * @param windowCount 窗口数量
 * @param screenWidth 屏幕宽度
 * @param screenHeight 屏幕高度
 * @param savedWindowSize 用户保存的窗口大小（可选）
 */
export function calculateGridConfig(
  windowCount: number,
  screenWidth: number,
  screenHeight: number,
  savedWindowSize?: { width: number; height: number }
): GridConfig {
  // 可用区域（减去边距和滚动条）
  const availableWidth = screenWidth - EDGE_MARGIN * 2 - SCROLLBAR_WIDTH
  const availableHeight = screenHeight - EDGE_MARGIN * 2

  // 单个窗口：居中显示，使用保存的大小或默认大小
  if (windowCount === 1) {
    const width = savedWindowSize?.width || DEFAULT_WINDOW_WIDTH
    const height = savedWindowSize?.height || DEFAULT_WINDOW_HEIGHT
    return {
      rows: 1,
      cols: 1,
      windowWidth: Math.min(width, availableWidth),
      windowHeight: Math.min(height, availableHeight),
      gap: 0,
    }
  }

  // 2个窗口：1×2（左右平分）
  if (windowCount === 2) {
    const windowWidth = (availableWidth - GAP) / 2
    const windowHeight = Math.min(
      savedWindowSize?.height || DEFAULT_WINDOW_HEIGHT,
      availableHeight
    )
    return {
      rows: 1,
      cols: 2,
      windowWidth,
      windowHeight,
      gap: GAP,
    }
  }

  // 3-4个窗口：2×2
  if (windowCount <= 4) {
    const windowWidth = (availableWidth - GAP) / 2
    const windowHeight = (availableHeight - GAP) / 2
    return {
      rows: 2,
      cols: 2,
      windowWidth,
      windowHeight,
      gap: GAP,
    }
  }

  // 5-6个窗口：3×2
  if (windowCount <= 6) {
    const windowWidth = (availableWidth - GAP) / 2
    const windowHeight = (availableHeight - GAP * 2) / 3
    return {
      rows: 3,
      cols: 2,
      windowWidth,
      windowHeight,
      gap: GAP,
    }
  }

  // 7-9个窗口：3×3
  if (windowCount <= 9) {
    const windowWidth = (availableWidth - GAP * 2) / 3
    const windowHeight = (availableHeight - GAP * 2) / 3
    return {
      rows: 3,
      cols: 3,
      windowWidth,
      windowHeight,
      gap: GAP,
    }
  }

  // 10+个窗口：动态计算接近正方形的网格
  const cols = Math.ceil(Math.sqrt(windowCount))
  const rows = Math.ceil(windowCount / cols)
  const windowWidth = (availableWidth - GAP * (cols - 1)) / cols
  const windowHeight = (availableHeight - GAP * (rows - 1)) / rows

  return {
    rows,
    cols,
    windowWidth,
    windowHeight,
    gap: GAP,
  }
}

/**
 * 根据网格配置计算所有窗口的位置
 * @param gridConfig 网格配置
 * @param windowCount 窗口数量
 */
export function calculateWindowPositions(
  gridConfig: GridConfig,
  windowCount: number
): WindowPosition[] {
  const positions: WindowPosition[] = []

  // 单个窗口：居中显示
  if (windowCount === 1) {
    const x = (window.innerWidth - gridConfig.windowWidth) / 2
    const y = (window.innerHeight - gridConfig.windowHeight) / 2
    positions.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: gridConfig.windowWidth,
      height: gridConfig.windowHeight,
    })
    return positions
  }

  // 多个窗口：网格排列（无间距，紧密排列）
  for (let i = 0; i < windowCount; i++) {
    const row = Math.floor(i / gridConfig.cols)
    const col = i % gridConfig.cols

    const x = col * gridConfig.windowWidth
    const y = row * gridConfig.windowHeight

    positions.push({
      x,
      y,
      width: gridConfig.windowWidth,
      height: gridConfig.windowHeight,
    })
  }

  return positions
}
