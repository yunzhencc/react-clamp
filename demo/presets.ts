// Demo workloads adapted from Justineo/vue-clamp (MIT), commit 9f93dbcc.
const englishText =
  "Vue (pronounced /vju\u02D0/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";
const chineseText =
  "Vue 是一个用于构建用户界面的渐进式框架。你可以只在页面的一小部分引入它，也可以结合现代工具链把它扩展成完整的单页应用。在这个示例里，我们使用一段较长的中文文本来观察多行截断、换行和省略号在不同宽度下的表现。";
const arabicText =
  "فيو 3 إطار تدريجي لبناء واجهات المستخدم، وقد صُمم ليكون سهل التبنّي بشكل متدرج داخل المشاريع المختلفة. تركز المكتبة الأساسية على طبقة العرض فقط، لكنها قادرة أيضًا على تشغيل تطبيقات أكثر تعقيدًا عند استخدامها مع أدوات حديثة ومكتبات مساندة. في هذا المثال نعرض نصًا عربيًا مع Vue 3 وبعض الكلمات اللاتينية مثل SPA لاختبار الالتفاف والاقتطاع في اتجاه من اليمين إلى اليسار.";
const mixedLanguageText =
  "Design systems move fast: ship once, then verify the same preview with English, 中文标签, العربية, and locale-aware tokens like /docs/getting-started before you freeze the layout.";
const emojiText =
  "Status update ✨ Ship notes are ready, screenshots are approved, and the launch checklist is almost done 🚀 Add a few longer phrases with emoji reactions 😄📦🧪 to see how the clamp behaves.";
const richDemoIconSrc = "/rich-demo-icon.svg";

function richIconImage(src: string): string {
  return `<img alt="" src="${src}" style="width:14px;height:14px;vertical-align:-2px" />`;
}

export const richHtmlPresets = [
  {
    id: "release",
    label: "Release note",
    value: `Heads up: ${richIconImage(richDemoIconSrc)} <strong>Friday release 2.4.0</strong> moves to <time datetime="2026-04-11T09:30">09:30</time>. Review the <a href="#components">migration note</a>, keep the <code>&lt;RichLineClamp&gt;</code> fallback banner, and confirm the <mark>billing export</mark> patch before the preview freeze. <span class="rich-chip rich-chip--accent">Blocking</span> <span class="rich-chip">Docs</span> ${richIconImage(richDemoIconSrc)}`,
  },
  {
    id: "editorial",
    label: "Article excerpt",
    value: `Feature essay ${richIconImage(richDemoIconSrc)} · <small class="rich-meta"><time datetime="2026-04-08">Apr 8, 2026</time> · By <a href="#components">Interface <strong>Systems</strong> Desk</a></small><br>The latest review argues that <a href="#components">the refreshed <strong>component tabs</strong> should scroll on narrow screens</a> instead of squeezing every label into one row. It keeps <em>editorial emphasis</em>, the inline badge <span class="rich-chip rich-chip--quiet">analysis</span>, and an <span class="rich-note">editor&rsquo;s note ${richIconImage(richDemoIconSrc)} on the <a href="#components">same <strong>read-more</strong> affordance</a></span> so the excerpt still feels like a styled article.`,
  },
  {
    id: "incident",
    label: "Incident brief",
    value: `Incident brief ${richIconImage(richDemoIconSrc)} <strong>#4721</strong>: API latency spiked after <code>release/2.4.0</code>. Triage owners are <span class="rich-chip">Platform</span>, <span class="rich-chip rich-chip--warm">Billing</span>, and <span class="rich-chip rich-chip--success">Support</span>. Watch <span class="rich-link-run">status-page<wbr>.acme<wbr>.dev</span> and keep the inline ${richIconImage(richDemoIconSrc)} health glyph attached to the summary.`,
  },
] as const;

export const lineTextPresets = [
  {
    id: "english",
    label: "English",
    value: englishText,
  },
  {
    id: "chinese",
    label: "中文",
    value: chineseText,
  },
  {
    id: "arabic",
    label: "العربية",
    value: arabicText,
  },
  {
    id: "mixed",
    label: "Mixed",
    value: mixedLanguageText,
  },
  {
    id: "emoji",
    label: "Emoji",
    value: emojiText,
  },
] as const;
