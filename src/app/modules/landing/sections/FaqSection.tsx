import { FC, useState, useMemo } from 'react';
import { SEO_FAQS, FaqItem } from '../landingData';

export const FaqSection: FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [openIndices, setOpenIndices] = useState<number[]>([0, 1]); // First two open by default

  const categories = useMemo(() => {
    const set = new Set<string>();
    SEO_FAQS.forEach((item) => set.add(item.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredFaqs = useMemo(() => {
    if (selectedCategory === 'All') return SEO_FAQS;
    return SEO_FAQS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  const toggleFaq = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const expandAll = () => {
    setOpenIndices(filteredFaqs.map((_, i) => i));
  };

  const collapseAll = () => {
    setOpenIndices([]);
  };

  // Structured JSON-LD Data for Google SEO FAQ Rich Snippets
  const faqSchema = useMemo(() => {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: SEO_FAQS.map((faq: FaqItem) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    };
  }, []);

  return (
    <section id="lp-faq" className="lp-section lp-faq-section">
      {/* Dynamic SEO FAQ Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="lp-section-inner">
        {/* Header */}
        <div className="lp-section-header text-center mb-5">
          <span className="lp-section-label lp-section-label--center">QUESTIONS & ANSWERS</span>
          <h2 className="lp-section-title">
            Frequently Asked Questions
          </h2>
          <p className="lp-section-desc mx-auto">
            Everything you need to know about vector PDF generation, Mermaid.js diagrams, paper geometries, Google Cloud sync, and privacy.
          </p>
        </div>

        {/* Category Pills & Bulk Controls */}
        <div className="lp-faq-controls">
          <div className="lp-faq-categories" role="tablist" aria-label="FAQ categories">
            {categories.map((cat) => {
              const active = cat === selectedCategory;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`lp-faq-cat-pill ${active ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setOpenIndices([0]);
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="lp-faq-toggle-all">
            <button type="button" className="lp-faq-text-btn" onClick={expandAll}>
              Expand All
            </button>
            <span className="lp-faq-sep">&bull;</span>
            <button type="button" className="lp-faq-text-btn" onClick={collapseAll}>
              Collapse All
            </button>
          </div>
        </div>

        {/* Accordion List */}
        <div className="lp-faq-accordion">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndices.includes(idx);
            return (
              <div
                key={idx}
                className={`lp-faq-item ${isOpen ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="lp-faq-trigger"
                  aria-expanded={isOpen}
                  onClick={() => toggleFaq(idx)}
                >
                  <div className="lp-faq-trigger-content">
                    <span className="lp-faq-cat-badge">{faq.category}</span>
                    <span className="lp-faq-question">{faq.q}</span>
                  </div>
                  <div className="lp-faq-icon-wrap" aria-hidden="true">
                    <i className={`bi bi-chevron-down lp-faq-chevron ${isOpen ? 'rotated' : ''}`} />
                  </div>
                </button>

                <div
                  className="lp-faq-collapse"
                  style={{
                    maxHeight: isOpen ? '500px' : '0px',
                    opacity: isOpen ? 1 : 0,
                  }}
                  role="region"
                  aria-label={faq.q}
                >
                  <div className="lp-faq-body">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help prompt box */}
        <div className="lp-faq-footer-prompt text-center mt-5">
          <div className="lp-faq-prompt-card">
            <i className="bi bi-chat-heart-fill prompt-icon" />
            <div className="prompt-text">
              <h4>Still have questions or feature suggestions?</h4>
              <p>Explore the live editor with our sample documents or drop us a note in the contact form below.</p>
            </div>
            <a href="#lp-contact" className="lp-faq-prompt-btn">
              <span>Send Feedback</span>
              <i className="bi bi-arrow-down" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
