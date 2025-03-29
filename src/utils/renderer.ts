import type { ExtendedProperties, IOpts, ThemeStyles } from '@/types'
import type { PropertiesHyphen } from 'csstype'
import type { Renderer, RendererObject, Tokens } from 'marked'
import type { ReadTimeResults } from 'reading-time'
import { cloneDeep, toMerged } from 'es-toolkit'
import frontMatter from 'front-matter'

import hljs from 'highlight.js'
import { marked } from 'marked'
import mermaid from 'mermaid'
import readingTime from 'reading-time'

import { getStyleString } from '.'
import markedAlert from './MDAlert'

import { MDKatex } from './MDKatex'

marked.setOptions({
  breaks: true,
})
marked.use(MDKatex({ nonStandard: true }))

function buildTheme({ theme: _theme, fonts, size, isUseIndent }: IOpts): ThemeStyles {
  const theme = cloneDeep(_theme)
  const base = toMerged(theme.base, {
    'font-family': fonts,
    'font-size': size,
  })

  if (isUseIndent) {
    theme.block.p = {
      'text-indent': `2em`,
      ...theme.block.p,
    }
  }

  const mergeStyles = (styles: Record<string, PropertiesHyphen>): Record<string, ExtendedProperties> =>
    Object.fromEntries(
      Object.entries(styles).map(([ele, style]) => [ele, toMerged(base, style)]),
    )
  return {
    ...mergeStyles(theme.inline),
    ...mergeStyles(theme.block),
  } as ThemeStyles
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, `&amp;`) // 转义 &
    .replace(/</g, `&lt;`) // 转义 <
    .replace(/>/g, `&gt;`) // 转义 >
    .replace(/"/g, `&quot;`) // 转义 "
    .replace(/'/g, `&#39;`) // 转义 '
    .replace(/`/g, `&#96;`) // 转义 `
}

function buildAddition(): string {
  return `
    <style>
      .preview-wrapper pre::before {
        position: absolute;
        top: 0;
        right: 0;
        color: #ccc;
        text-align: center;
        font-size: 0.8em;
        padding: 5px 10px 0;
        line-height: 15px;
        height: 15px;
        font-weight: 600;
      }

      /* Admonition 样式 */
      .admonition {
        margin: 1em 0;
        padding: 1em;
        border-radius: 4px;
        border-left: 4px solid;
      }

      .admonition-title {
        font-weight: bold;
        margin-bottom: 0.5em;
      }

      .admonition-content {
        margin: 0;
      }

      /* 浅色主题下的 admonition 样式 */
      .admonition.note {
        background-color: #e8f4f8;
        border-left-color: #4a9eff;
      }

      .admonition.warning {
        background-color: #fff3e0;
        border-left-color: #ff9800;
      }

      .admonition.tip {
        background-color: #e8f5e9;
        border-left-color: #4caf50;
      }

      .admonition.important {
        background-color: #fce4ec;
        border-left-color: #e91e63;
      }

      .admonition.caution {
        background-color: #ffebee;
        border-left-color: #f44336;
      }

      /* 深色主题下的 admonition 样式 */
      .dark .admonition {
        background-color: rgba(255, 255, 255, 0.05);
        color: #fff;
      }

      .dark .admonition.note {
        background-color: rgba(74, 158, 255, 0.1);
        border-left-color: #4a9eff;
      }

      .dark .admonition.warning {
        background-color: rgba(255, 152, 0, 0.1);
        border-left-color: #ff9800;
      }

      .dark .admonition.tip {
        background-color: rgba(76, 175, 80, 0.1);
        border-left-color: #4caf50;
      }

      .dark .admonition.important {
        background-color: rgba(233, 30, 99, 0.1);
        border-left-color: #e91e63;
      }

      .dark .admonition.caution {
        background-color: rgba(244, 67, 54, 0.1);
        border-left-color: #f44336;
      }

      /* 深色主题下的标题文字颜色 */
      .dark .admonition-title {
        color: #fff;
      }

      /* 深色主题下的内容文字颜色 */
      .dark .admonition-content {
        color: rgba(255, 255, 255, 0.8);
      }
    </style>
  `
}

function getStyles(styleMapping: ThemeStyles, tokenName: string, addition: string = ``): string {
  const dict = styleMapping[tokenName as keyof ThemeStyles]
  if (!dict) {
    return ``
  }
  const styles = getStyleString(dict)
  return `style="${styles}${addition}"`
}

function buildFootnoteArray(footnotes: [number, string, string][]): string {
  return footnotes
    .map(([index, title, link]) =>
      link === title
        ? `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code>: <i style="word-break: break-all">${title}</i><br/>`
        : `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code> ${title}: <i style="word-break: break-all">${link}</i><br/>`,
    )
    .join(`\n`)
}

function transform(legend: string, text: string | null, title: string | null): string {
  const options = legend.split(`-`)
  for (const option of options) {
    if (option === `alt` && text) {
      return text
    }
    if (option === `title` && title) {
      return title
    }
  }
  return ``
}

const macCodeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130">
    <ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" />
    <ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" />
    <ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" />
  </svg>
`.trim()

interface ParseResult {
  yamlData: Record<string, any>
  markdownContent: string
  readingTime: ReadTimeResults
}

function parseFrontMatterAndContent(markdownText: string): ParseResult {
  try {
    const parsed = frontMatter(markdownText)
    const yamlData = parsed.attributes
    const markdownContent = parsed.body

    const readingTimeResult = readingTime(markdownContent)

    return {
      yamlData: yamlData as Record<string, any>,
      markdownContent,
      readingTime: readingTimeResult,
    }
  }
  catch (error) {
    console.error(`Error parsing front-matter:`, error)
    return {
      yamlData: {},
      markdownContent: markdownText,
      readingTime: readingTime(markdownText),
    }
  }
}

export function initRenderer(opts: IOpts) {
  const footnotes: [number, string, string][] = []
  let footnoteIndex: number = 0
  let styleMapping: ThemeStyles = buildTheme(opts)
  let codeIndex: number = 0
  let listIndex: number = 0
  let isOrdered: boolean = false

  function styles(tag: string, addition: string = ``): string {
    return getStyles(styleMapping, tag, addition)
  }

  function styledContent(styleLabel: string, content: string, tagName?: string): string {
    const tag = tagName ?? styleLabel

    return `<${tag} ${/^h\d$/.test(tag) ? `data-heading="true"` : ``} ${styles(styleLabel)}>${content}</${tag}>`
  }

  function addFootnote(title: string, link: string): number {
    footnotes.push([++footnoteIndex, title, link])
    return footnoteIndex
  }

  function reset(newOpts: Partial<IOpts>): void {
    footnotes.length = 0
    footnoteIndex = 0
    setOptions(newOpts)
  }

  function setOptions(newOpts: Partial<IOpts>): void {
    opts = { ...opts, ...newOpts }
    styleMapping = buildTheme(opts)
    marked.use(markedAlert({ styles: styleMapping }))
  }

  function buildReadingTime(readingTime: ReadTimeResults): string {
    if (!opts.countStatus) {
      return ``
    }
    if (!readingTime.words) {
      return ``
    }
    return `
      <blockquote ${styles(`blockquote`)}>
        <p ${styles(`blockquote_p`)}>字数 ${readingTime?.words}，阅读大约需 ${Math.ceil(readingTime?.minutes)} 分钟</p>
      </blockquote>
    `
  }

  const buildFootnotes = () => {
    if (!footnotes.length) {
      return ``
    }

    return (
      styledContent(`h4`, `引用链接`)
      + styledContent(`footnotes`, buildFootnoteArray(footnotes), `p`)
    )
  }

  const renderer: RendererObject = {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens)
      const tag = `h${depth}`
      return styledContent(tag, text)
    },

    paragraph({ tokens }: Tokens.Paragraph): string {
      const text = this.parser.parseInline(tokens)
      const isFigureImage = text.includes(`<figure`) && text.includes(`<img`)
      const isEmpty = text.trim() === ``
      if (isFigureImage || isEmpty) {
        return text
      }
      return styledContent(`p`, text)
    },

    blockquote({ tokens }: Tokens.Blockquote): string {
      let text = this.parser.parse(tokens)
      text = text.replace(/<p .*?>/g, `<p ${styles(`blockquote_p`)}>`)
      return styledContent(`blockquote`, text)
    },

    code({ text, lang = `` }: Tokens.Code): string {
      if (lang.startsWith(`mermaid`)) {
        clearTimeout(codeIndex)
        codeIndex = setTimeout(() => {
          mermaid.run()
        }, 0) as any as number
        return `<pre class="mermaid">${text}</pre>`
      }

      // 处理 Obsidian admonition 语法
      if (lang.startsWith(`ad-`)) {
        const type = lang.replace(`ad-`, ``)
        const content = text.trim()
        return `
          <div class="admonition ${type}">
            <div class="admonition-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            <div class="admonition-content">${content}</div>
          </div>
        `
      }

      const langText = lang.split(` `)[0]
      const language = hljs.getLanguage(langText) ? langText : `plaintext`
      let highlighted = hljs.highlight(text, { language }).value
      // tab to 4 spaces
      highlighted = highlighted.replace(/\t/g, `    `)
      highlighted = highlighted
        .replace(/\r\n/g, `<br/>`)
        .replace(/\n/g, `<br/>`)
        .replace(/(>[^<]+)|(^[^<]+)/g, str => str.replace(/\s/g, `&nbsp;`))
      const span = `<span class="mac-sign" style="padding: 10px 14px 0;" hidden>${macCodeSvg}</span>`
      const code = `<code class="language-${lang}" ${styles(`code`)}>${highlighted}</code>`
      return `<pre class="hljs code__pre" ${styles(`code_pre`)}>${span}${code}</pre>`
    },

    codespan({ text }: Tokens.Codespan): string {
      const escapedText = escapeHtml(text)
      return styledContent(`codespan`, escapedText, `code`)
    },

    listitem(item: Tokens.ListItem): string {
      const prefix = isOrdered ? `${listIndex + 1}. ` : `• `
      const content = item.tokens.map(t => (this[t.type as keyof Renderer] as <T>(token: T) => string)(t)).join(``)
      return styledContent(`listitem`, `${prefix}${content}`, `li`)
    },

    list({ ordered, items, start = 1 }: Tokens.List): string {
      const listItems = []
      for (let i = 0; i < items.length; i++) {
        isOrdered = ordered
        listIndex = Number(start) + i - 1
        const item = items[i]
        listItems.push(this.listitem(item))
      }
      const label = ordered ? `ol` : `ul`
      return styledContent(label, listItems.join(``))
    },

    image({ href, title, text }: Tokens.Image): string {
      const subText = styledContent(`figcaption`, transform(opts.legend!, text, title))
      const figureStyles = styles(`figure`)
      const imgStyles = styles(`image`)
      return `<figure ${figureStyles}><img ${imgStyles} src="${href}" title="${title}" alt="${text}"/>${subText}</figure>`
    },

    link({ href, title, text, tokens }: Tokens.Link): string {
      const parsedText = this.parser.parseInline(tokens)
      if (href.startsWith(`https://mp.weixin.qq.com`)) {
        return `<a href="${href}" title="${title || text}" ${styles(`wx_link`)}>${parsedText}</a>`
      }
      if (href === text) {
        return parsedText
      }
      if (opts.citeStatus) {
        const ref = addFootnote(title || text, href)
        return `<span ${styles(`link`)}>${parsedText}<sup>[${ref}]</sup></span>`
      }
      return styledContent(`link`, parsedText, `span`)
    },

    strong({ tokens }: Tokens.Strong): string {
      return styledContent(`strong`, this.parser.parseInline(tokens))
    },

    em({ tokens }: Tokens.Em): string {
      return styledContent(`em`, this.parser.parseInline(tokens), `span`)
    },

    table({ header, rows }: Tokens.Table): string {
      const headerRow = header
        .map(cell => this.tablecell(cell))
        .join(``)
      const body = rows
        .map((row) => {
          const rowContent = row
            .map(cell => this.tablecell(cell))
            .join(``)
          return styledContent(`tr`, rowContent)
        })
        .join(``)
      return `
        <section style="padding:0 8px; max-width: 100%; overflow: auto">
          <table class="preview-table">
            <thead ${styles(`thead`)}>${headerRow}</thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `
    },

    tablecell(token: Tokens.TableCell): string {
      const text = this.parser.parseInline(token.tokens)
      return styledContent(`td`, text)
    },

    hr(_: Tokens.Hr): string {
      return styledContent(`hr`, ``)
    },
  }

  marked.use({ renderer })

  return {
    buildAddition,
    buildFootnotes,
    setOptions,
    reset,
    parseFrontMatterAndContent,
    buildReadingTime,
    createContainer(content: string) {
      return styledContent(`container`, content, `section`)
    },
  }
}
