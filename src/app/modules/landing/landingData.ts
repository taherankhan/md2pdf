export type PdfTheme = {
  name: string;
  desc: string;
  bg: string;
  text: string;
};

export type UseCase = {
  icon: string;
  cls: string;
  title: string;
  desc: string;
  tag: string;
  num: string;
};

export type WorkflowStep = {
  num: string;
  title: string;
  desc: string;
};

export const USE_CASES: UseCase[] = [
  {
    icon: '📄',
    cls: 'fi-purple',
    title: 'Professional Resumes',
    desc: 'Craft polished CVs and resumes with structured Markdown and export them as print-ready PDFs with elegant typography.',
    tag: '🚀 Most Popular',
    num: '01',
  },
  {
    icon: '📊',
    cls: 'fi-cyan',
    title: 'Technical Reports',
    desc: 'Fenced code, tables, and Mermaid diagrams in preview — export to PDF, Markdown, or HTML when you are ready.',
    tag: '💻 Developer Favourite',
    num: '02',
  },
  {
    icon: '📚',
    cls: 'fi-pink',
    title: 'Study Notes & Guides',
    desc: 'Organise lecture notes, revision guides, and cheat-sheets in Markdown and convert them to shareable PDFs instantly.',
    tag: '🎓 Students',
    num: '03',
  },
  {
    icon: '📝',
    cls: 'fi-amber',
    title: 'Business Proposals',
    desc: 'Create professional project proposals, SOWs, and client documents with branded themes that impress at first glance.',
    tag: '💼 Business',
    num: '04',
  },
];

/** Matches editor `themeConfig` names — used for hero/themes preview only */
export const THEMES: PdfTheme[] = [
  { name: 'Professional', desc: 'Default print style', bg: 'linear-gradient(135deg,#f8fafc,#e2e8f0)', text: '#1e293b' },
  { name: 'Academic', desc: 'Formal documents', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', text: '#422006' },
  { name: 'Minimal', desc: 'Light & airy', bg: 'linear-gradient(135deg,#ffffff,#f1f5f9)', text: '#334155' },
  { name: 'Creative', desc: 'Accent headings', bg: 'linear-gradient(135deg,#faf5ff,#ede9fe)', text: '#5b21b6' },
  { name: 'Dark', desc: 'Low-light reading', bg: 'linear-gradient(135deg,#0f172a,#1e293b)', text: '#f1f5f9' },
  { name: 'Resume', desc: 'CV-friendly', bg: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', text: '#065f46' },
];

export const STEPS: WorkflowStep[] = [
  { num: '1', title: 'Write or upload', desc: 'Type markdown directly or upload a .md file to start.' },
  { num: '2', title: 'Edit & preview', desc: 'Switch Edit, Split, or Preview — format bar and Mermaid in the pane.' },
  { num: '3', title: 'Theme & customize', desc: 'Pick from 6 curated themes with custom 4-sided margins and smart page breaks.' },
  { num: '4', title: 'Vector PDF Export', desc: 'Download book-grade vector PDF generated via Puppeteer Chromium engine, Markdown, or HTML.' },
];

export const STATS = [
  { value: '6', label: 'PDF Themes' },
  { value: '100%', label: 'Vector Output' },
  { value: 'Puppeteer', label: 'Headless Engine' },
  { value: '∞', label: 'Free to Use' },
];

export const HERO_FEATURE_CHIPS = [
  'Split editor',
  'Mermaid 11',
  'Vector PDF (Puppeteer)',
  'Cloud Sync',
] as const;

export const DEVELOPER = {
  githubUsername: 'taherankhan',
  repoUrl: 'https://github.com/taherankhan/PDF_Generator',
  role: 'Full-Stack Developer',
  stack: ['React', 'TypeScript', 'Vite', 'Node.js', 'Puppeteer', 'Mermaid'],
} as const;

export const FOOTER_NAV = [
  { label: 'Features', sectionId: 'lp-features' },
  { label: 'Use Cases', sectionId: 'lp-usecases' },
  { label: 'Themes', sectionId: 'lp-themes' },
] as const;

export const themeSwatchBg = (_name: string, bg: string) => bg;
