/**
 * 将 Obsidian 的 admonition 语法转换为 GFM alert 语法
 * @param content Markdown 内容
 * @returns 转换后的内容
 */
export function convertAdmonitionToGFM(content: string): string {
  // Obsidian admonition 语法的正则表达式
  const admonitionRegex = /```ad-(\w+)\n([\s\S]*?)\n```/g;

  // 类型映射表
  const typeMap: { [key: string]: string } = {
    note: 'NOTE',
    tip: 'TIP',
    info: 'NOTE',
    warning: 'WARNING',
    danger: 'CAUTION',
    caution: 'CAUTION',
    error: 'CAUTION',
    important: 'IMPORTANT',
    success: 'TIP',
    fail: 'CAUTION',
    bug: 'WARNING',
    example: 'TIP',
    quote: 'NOTE',
    abstract: 'NOTE',
    summary: 'NOTE',
    tldr: 'NOTE',
    hint: 'TIP',
    question: 'NOTE',
    faq: 'NOTE',
    help: 'NOTE',
    attention: 'CAUTION',
    notice: 'NOTE',
  };

  // 替换函数
  return content.replace(admonitionRegex, (_match: string, type: string, content: string) => {
    // 获取映射的类型，如果没有映射则默认为 NOTE
    const gfmType = typeMap[type.toLowerCase()] || 'NOTE';
    
    // 处理内容：移除开头和结尾的空行，确保每行都有 > 前缀
    const processedContent = content
      .trim()
      .split('\n')
      .map((line: string) => `> ${line}`)
      .join('\n');

    // 返回 GFM alert 格式
    return `> [!${gfmType}]\n${processedContent}`;
  });
} 