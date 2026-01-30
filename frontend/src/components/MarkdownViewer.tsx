/**
 * Markdown 查看器组件
 * 用于渲染和显示 Markdown 内容
 */
'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { processMarkdownForDisplay } from '@/lib/markdown'

interface MarkdownViewerProps {
  /** Markdown 内容 */
  content: string
  /** 额外的 CSS 类名 */
  className?: string
  /** 最大行数（用于内容截断） */
  maxLines?: number
}

/**
 * Markdown 查看器组件
 *
 * 用于在卡片中渲染 Markdown 内容，支持标准 Markdown 语法和 GitHub Flavored Markdown。
 *
 * @example
 * ```tsx
 * <MarkdownViewer content="# Hello\n\nThis is **bold** text." />
 * ```
 */
export function MarkdownViewer({ content, className = '', maxLines }: MarkdownViewerProps) {
  // 处理并清理 Markdown 内容
  const processedContent = processMarkdownForDisplay(content)

  // 样式配置
  const baseStyles = 'prose prose-sm dark:prose-invert max-w-none'
  const lineClampStyle = maxLines ? `line-clamp-${maxLines}` : ''

  return (
    <div className={`${baseStyles} ${lineClampStyle} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 标题样式
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold text-text-primary mb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold text-text-primary mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-bold text-text-primary mb-1" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-sm font-bold text-text-primary mb-1" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="text-sm font-bold text-text-primary mb-1" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="text-xs font-bold text-text-primary mb-1" {...props} />
          ),

          // 段落样式
          p: ({ node, ...props }) => (
            <p className="text-sm text-text-primary mb-2 leading-relaxed" {...props} />
          ),

          // 列表样式
          ul: ({ node, ...props }) => (
            <ul className="text-sm text-text-primary mb-2 ml-4 list-disc space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="text-sm text-text-primary mb-2 ml-4 list-decimal space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-sm text-text-primary leading-relaxed" {...props} />
          ),

          // 代码样式
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code
                className="bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded text-xs font-mono"
                {...props}
              />
            ) : (
              <code className="block bg-slate-800/50 text-slate-300 p-3 rounded text-xs font-mono overflow-x-auto" {...props} />
            ),
          pre: ({ node, ...props }) => (
            <pre className="bg-slate-800/50 p-3 rounded mb-2 overflow-x-auto" {...props} />
          ),

          // 引用样式
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-slate-600 pl-4 italic text-text-secondary mb-2" {...props} />
          ),

          // 链接样式
          a: ({ node, ...props }) => (
            <a className="text-primary hover:text-primary/80 underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),

          // 分割线样式
          hr: ({ node, ...props }) => (
            <hr className="border-slate-700 my-3" {...props} />
          ),

          // 强调样式
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-text-primary" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-text-secondary" {...props} />
          ),

          // 表格样式
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full divide-y divide-slate-700" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-800/50" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-700" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-sm text-text-primary whitespace-nowrap" {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
