// Demo workloads adapted from Justineo/vue-clamp (MIT), commit 9f93dbcc.
const englishText
  = 'Readable interfaces help people find useful information without losing context. A short preview can introduce a longer article, describe a collection of files, or summarize an update in a busy activity feed. Text needs to adapt when the available space changes: a desktop panel may have room for several lines, while a narrow card can show only a few words. This example uses a longer paragraph to explore line wrapping, truncation, and interactive controls at different widths. Resize the container, edit the text, and compare the visible result with the complete content.'
const chineseText
  = '清晰的界面帮助读者快速找到信息，也能保留理解内容所需的上下文。较短的预览可以介绍一篇文章、概括文件列表，或者展示动态消息。页面宽度变化时，文字需要随之调整：宽屏面板能容纳多行内容，紧凑卡片可能只显示几个词。这个示例使用较长的中文段落，观察不同宽度下的换行、截断、省略号和交互控件。'
const arabicText
  = 'تساعد الواجهات الواضحة القراء على العثور على المعلومات مع الحفاظ على سياق المحتوى. يمكن للمعاينة القصيرة أن تقدم مقالة طويلة أو تلخص تحديثًا في قائمة الأخبار. يتغير عرض النص مع المساحة المتاحة، فقد تتسع اللوحة الكبيرة لعدة أسطر بينما تعرض البطاقة الصغيرة كلمات قليلة فقط. في هذا المثال نستخدم فقرة عربية وبعض الكلمات اللاتينية مثل Design لاختبار التفاف النص والاقتطاع في اتجاه من اليمين إلى اليسار.'
const mixedLanguageText
  = 'Design systems move fast: ship once, then verify the same preview with English, 中文标签, العربية, and locale-aware tokens like /docs/getting-started before you freeze the layout.'
const emojiText
  = 'Status update ✨ Ship notes are ready, screenshots are approved, and the launch checklist is almost done 🚀 Add a few longer phrases with emoji reactions 😄📦🧪 to see how the clamp behaves.'
const richDemoIconSrc = '/rich-demo-icon.svg'

function richIconImage(src: string): string {
  return `<img alt="" src="${src}" style="width:14px;height:14px;vertical-align:-2px" />`
}

export const richHtmlPresets = [
  {
    id: 'release',
    label: 'Release note',
    value: `Heads up: ${richIconImage(richDemoIconSrc)} <strong>Friday release 2.4.0</strong> moves to <time datetime="2026-04-11T09:30">09:30</time>. Review the <a href="#components">migration note</a>, keep the <code>&lt;RichLineClamp&gt;</code> fallback banner, and confirm the <mark>billing export</mark> patch before the preview freeze. <span class="rich-chip rich-chip--accent">Blocking</span> <span class="rich-chip">Docs</span> ${richIconImage(richDemoIconSrc)}`,
  },
  {
    id: 'editorial',
    label: 'Article excerpt',
    value: `Feature essay ${richIconImage(richDemoIconSrc)} · <small class="rich-meta"><time datetime="2026-04-08">Apr 8, 2026</time> · By <a href="#components">Interface <strong>Systems</strong> Desk</a></small><br>The latest review argues that <a href="#components">the refreshed <strong>component tabs</strong> should scroll on narrow screens</a> instead of squeezing every label into one row. It keeps <em>editorial emphasis</em>, the inline badge <span class="rich-chip rich-chip--quiet">analysis</span>, and an <span class="rich-note">editor&rsquo;s note ${richIconImage(richDemoIconSrc)} on the <a href="#components">same <strong>read-more</strong> affordance</a></span> so the excerpt still feels like a styled article.`,
  },
  {
    id: 'incident',
    label: 'Incident brief',
    value: `Incident brief ${richIconImage(richDemoIconSrc)} <strong>#4721</strong>: API latency spiked after <code>release/2.4.0</code>. Triage owners are <span class="rich-chip">Platform</span>, <span class="rich-chip rich-chip--warm">Billing</span>, and <span class="rich-chip rich-chip--success">Support</span>. Watch <span class="rich-link-run">status-page<wbr>.acme<wbr>.dev</span> and keep the inline ${richIconImage(richDemoIconSrc)} health glyph attached to the summary.`,
  },
] as const

export const lineTextPresets = [
  {
    id: 'english',
    label: 'English',
    value: englishText,
  },
  {
    id: 'chinese',
    label: '中文',
    value: chineseText,
  },
  {
    id: 'arabic',
    label: 'العربية',
    value: arabicText,
  },
  {
    id: 'mixed',
    label: 'Mixed',
    value: mixedLanguageText,
  },
  {
    id: 'emoji',
    label: 'Emoji',
    value: emojiText,
  },
] as const
