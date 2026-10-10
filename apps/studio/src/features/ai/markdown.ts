/** AI text → sanitized HTML. markdown-it with raw HTML off, then DOMPurify as the second fence. */
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

let md: InstanceType<typeof MarkdownIt> | null = null

export function renderMarkdown(src: string): string {
  md ??= new MarkdownIt({ html: false, linkify: true, breaks: true })
  const html = md.render(src)
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'img', 'form', 'input'],
    FORBID_ATTR: ['style'],
  })
  // Links from the assistant open outside the Studio.
  return clean.replace(/<a href=/g, '<a target="_blank" rel="noopener noreferrer" href=')
}
