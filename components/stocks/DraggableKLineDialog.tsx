'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

interface DraggableKLineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stockId: string
  stockName: string
  stockCode: string
  tsCode: string
}

interface DialogSize {
  width: number
  height: number
}

interface DialogPosition {
  x: number
  y: number
}

type ResizeHandle =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | null

const MIN_WIDTH = 400
const MIN_HEIGHT = 300
const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

export function DraggableKLineDialog({
  open,
  onOpenChange,
  stockId,
  stockName,
  stockCode,
  tsCode,
}: DraggableKLineDialogProps) {
  const t = useTranslations('MyStocks.kline')

  // 从localStorage读取保存的大小，如果没有则使用默认值
  // 使用统一的key，所有弹窗共享同一个大小设置
  const getSavedSize = useCallback((): DialogSize => {
    if (typeof window === 'undefined') {
      return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
    }

    const savedSize = localStorage.getItem('kline-dialog-size')
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize)
        return {
          width: Math.max(parsed.width || DEFAULT_WIDTH, MIN_WIDTH),
          height: Math.max(parsed.height || DEFAULT_HEIGHT, MIN_HEIGHT),
        }
      } catch {
        return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
      }
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }, [])

  // 状态管理
  const [size, setSize] = useState<DialogSize>(getSavedSize)
  const [position, setPosition] = useState<DialogPosition>({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)

  // refs用于跟踪鼠标位置
  const dragStartPos = useRef({ x: 0, y: 0 })
  const resizeStartSize = useRef({ width: 0, height: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0 })
  const dialogRef = useRef<HTMLDivElement>(null)

  // 生成东方财富K线图URL
  const getEastMoneyChartUrl = useCallback((tsCode: string) => {
    const [code, exchange] = tsCode.split('.')
    const market = exchange === 'SH' ? '1' : '0'
    return `https://quote.eastmoney.com/basic/h5chart-iframe.html?code=${code}&market=${market}`
  }, [])

  // 保存大小到localStorage
  // 使用统一的key，所有弹窗共享同一个大小设置
  const saveSize = useCallback((newSize: DialogSize) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kline-dialog-size', JSON.stringify(newSize))
    }
  }, [])

  // 确保弹窗在屏幕范围内
  const constrainPosition = useCallback((pos: DialogPosition, size: DialogSize): DialogPosition => {
    const maxX = window.innerWidth - size.width
    const maxY = window.innerHeight - size.height
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    }
  }, [])

  // 初始化位置（居中显示）
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      const savedSize = getSavedSize()
      const centerX = (window.innerWidth - savedSize.width) / 2
      const centerY = (window.innerHeight - savedSize.height) / 2
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) })
      setSize(savedSize)
    }
  }, [open, getSavedSize])

  // 拖拽开始
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // 只允许在标题栏拖拽
      if ((e.target as HTMLElement).closest('.dialog-header')) {
        setIsDragging(true)
        dragStartPos.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        }
      }
    },
    [position]
  )

  // 调整大小开始
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: ResizeHandle) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      setResizeHandle(handle)
      resizeStartSize.current = { ...size }
      resizeStartPos.current = { ...position }
      dragStartPos.current = { x: e.clientX, y: e.clientY }
    },
    [size, position]
  )

  // 鼠标移动处理
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPos = {
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y,
        }
        setPosition(constrainPosition(newPos, size))
      } else if (isResizing && resizeHandle) {
        const deltaX = e.clientX - dragStartPos.current.x
        const deltaY = e.clientY - dragStartPos.current.y

        let newWidth = resizeStartSize.current.width
        let newHeight = resizeStartSize.current.height
        let newX = resizeStartPos.current.x
        let newY = resizeStartPos.current.y

        // 根据不同的调整手柄计算新的大小和位置
        if (resizeHandle.includes('right')) {
          newWidth = Math.max(MIN_WIDTH, resizeStartSize.current.width + deltaX)
        }
        if (resizeHandle.includes('left')) {
          const possibleWidth = resizeStartSize.current.width - deltaX
          if (possibleWidth >= MIN_WIDTH) {
            newWidth = possibleWidth
            newX = resizeStartPos.current.x + deltaX
          }
        }
        if (resizeHandle.includes('bottom')) {
          newHeight = Math.max(MIN_HEIGHT, resizeStartSize.current.height + deltaY)
        }
        if (resizeHandle.includes('top')) {
          const possibleHeight = resizeStartSize.current.height - deltaY
          if (possibleHeight >= MIN_HEIGHT) {
            newHeight = possibleHeight
            newY = resizeStartPos.current.y + deltaY
          }
        }

        setSize({ width: newWidth, height: newHeight })
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
      }
      if (isResizing) {
        setIsResizing(false)
        setResizeHandle(null)
        saveSize(size)
      }
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, resizeHandle, size, position, constrainPosition, saveSize])

  // 添加resize样式类
  const getResizeCursor = (handle: ResizeHandle): string => {
    switch (handle) {
      case 'top':
      case 'bottom':
        return 'cursor-ns-resize'
      case 'left':
      case 'right':
        return 'cursor-ew-resize'
      case 'top-left':
      case 'bottom-right':
        return 'cursor-nwse-resize'
      case 'top-right':
      case 'bottom-left':
        return 'cursor-nesw-resize'
      default:
        return ''
    }
  }

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      className="fixed bg-background border-2 border-primary/20 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        userSelect: isDragging || isResizing ? 'none' : 'auto',
        zIndex: 100,
      }}
    >
        {/* 标题栏（可拖拽区域） */}
        <div
          className="dialog-header flex items-center justify-between px-4 py-3 border-b bg-muted/50 cursor-move select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t('title')}</span>
            <span className="text-muted-foreground text-sm">
              {stockName} ({stockCode})
            </span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* K线图iframe */}
        <div className="w-full h-full" style={{ height: `calc(100% - 52px)` }}>
          <iframe
            src={getEastMoneyChartUrl(tsCode)}
            className="w-full h-full border-0"
            title={`${stockName} K线图`}
          />
        </div>

        {/* 调整大小手柄 */}
        {/* 边缘 */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${getResizeCursor('top')}`}
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 ${getResizeCursor('bottom')}`}
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        <div
          className={`absolute top-0 bottom-0 left-0 w-1 ${getResizeCursor('left')}`}
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
        <div
          className={`absolute top-0 bottom-0 right-0 w-1 ${getResizeCursor('right')}`}
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />

        {/* 四个角 */}
        <div
          className={`absolute top-0 left-0 w-3 h-3 ${getResizeCursor('top-left')}`}
          onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        />
        <div
          className={`absolute top-0 right-0 w-3 h-3 ${getResizeCursor('top-right')}`}
          onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        />
        <div
          className={`absolute bottom-0 left-0 w-3 h-3 ${getResizeCursor('bottom-left')}`}
          onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        />
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 ${getResizeCursor('bottom-right')}`}
          onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        />
      </div>
  )
}
