/**
 * `codex-files` namespace dictionaries (browser half). The Chinese
 * dictionary is the key-set source of truth; the English dictionary is
 * key-identical.
 */

import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Codex Files panel copy. */
    'codex-files': CodexFilesKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'codex-files'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '文件',
  'panel.toggle': '文件面板',
  'panel.close': '关闭文件面板',
  'panel.refresh': '刷新文件',
  'panel.empty': '这个会话还没有文件活动',
  'panel.emptyHint': '模型读写文件后会出现在这里',
  'list.files': '{count} 个文件',
  'list.modified': '已修改',
  'list.read': '已读取',
  'list.new': '新建',
  'list.open': '打开',
  'file.actions': '文件操作',
  'file.edit': '编辑',
  'file.save': '保存',
  'file.saved': '已保存',
  'file.cancel': '取消',
  'file.discard': '放弃修改',
  'file.openInSystem': '在系统中打开',
  'file.copyPath': '复制路径',
  'file.copied': '路径已复制',
  'file.back': '返回文件列表',
  'file.unsaved': '未保存',
  'file.close': '关闭',
  'file.language': '语言',
  'file.loading': '正在读取…',
  'file.tooLarge': '文件过大（超过 {limit} 字节），无法预览',
  'file.binary': '二进制文件，无法预览',
  'file.missing': '文件不存在或已被删除',
  'file.error': '读取失败：{message}',
  'file.saveError': '保存失败：{message}',
  'file.pathEscape': '路径超出会话工作目录',
  'file.sessionMissing': '会话不存在或没有工作目录',
  'file.notFound': '文件不存在',
  'file.updated': '文件已在会话中更新',
  'file.reload': '重新加载',
  'file.edited': '编辑中',
  'file.preview': '预览',
  'file.diff': '改动',
  'file.bytes': '{size} B',
  'tree.workspace': '工作区',
  'tree.activity': '活动',
  'tree.search': '搜索文件',
  'tree.noMatches': '没有匹配的文件',
  'tree.listFailed': '目录加载失败',
  'tree.hintOpen': '点击文件即可预览',
  'tree.hintSave': '编辑时 Ctrl+S 保存',
  'tree.hintSearch': '输入文件名快速查找',
  'file.officeEmpty': '未能从文档中提取文本',
  'file.pdfFailed': 'PDF 渲染失败：{message}',
  'file.pdfTruncated': '文档较长，仅渲染前 {max} 页',
} as const

/** English dictionary (key-identical to the Chinese set). */
export const en: Record<keyof typeof zh, string> = {
  'panel.title': 'Files',
  'panel.toggle': 'Files panel',
  'panel.close': 'Close files panel',
  'panel.refresh': 'Refresh file',
  'panel.empty': 'No file activity in this session yet',
  'panel.emptyHint': 'Files the model reads or writes will appear here',
  'list.files': '{count} files',
  'list.modified': 'Modified',
  'list.read': 'Read',
  'list.new': 'New',
  'list.open': 'Open',
  'file.actions': 'File actions',
  'file.edit': 'Edit',
  'file.save': 'Save',
  'file.saved': 'Saved',
  'file.cancel': 'Cancel',
  'file.discard': 'Discard changes',
  'file.openInSystem': 'Open in system',
  'file.copyPath': 'Copy path',
  'file.copied': 'Path copied',
  'file.back': 'Back to file list',
  'file.unsaved': 'Unsaved',
  'file.close': 'Close',
  'file.language': 'Language',
  'file.loading': 'Loading…',
  'file.tooLarge': 'File too large (over {limit} bytes) to preview',
  'file.binary': 'Binary file, cannot preview',
  'file.missing': 'File missing or deleted',
  'file.error': 'Read failed: {message}',
  'file.saveError': 'Save failed: {message}',
  'file.pathEscape': 'Path escapes the session working directory',
  'file.sessionMissing': 'Session missing or has no working directory',
  'file.notFound': 'File not found',
  'file.updated': 'File updated in the session',
  'file.reload': 'Reload',
  'file.edited': 'Editing',
  'file.preview': 'Preview',
  'file.diff': 'Diff',
  'file.bytes': '{size} B',
  'tree.workspace': 'Workspace',
  'tree.activity': 'Activity',
  'tree.search': 'Search files',
  'tree.noMatches': 'No matching files',
  'tree.listFailed': 'Directory listing failed',
  'tree.hintOpen': 'Click a file to preview',
  'tree.hintSave': 'Ctrl+S to save while editing',
  'tree.hintSearch': 'Type a filename to search',
  'file.officeEmpty': 'No text could be extracted from this document',
  'file.pdfFailed': 'PDF render failed: {message}',
  'file.pdfTruncated': 'Long document: only the first {max} pages render',
}

/** Typed key union of the dictionary. */
export type CodexFilesKey = keyof typeof zh
