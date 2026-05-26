// ============================================
// ReviewBackToTopLink.tsx — Static back-to-top link for /review/* pages
// ============================================
// Created: 2026-05-26
// Server-rendered counterpart to BackToTopLink.tsx. The live BackToTopLink
// reads tw_geo client-side and swaps the country name post-hydration; on
// review pages the country is known server-side, so we bake the text in
// directly with no JS.
// ============================================

interface ReviewBackToTopLinkProps {
  /** Already title-cased (e.g., "JBL Speakers"). */
  topicLabel: string;
  /** Country display name (e.g., "Canada", "the United Kingdom"). */
  countryDisplay: string;
}

export default function ReviewBackToTopLink({
  topicLabel,
  countryDisplay,
}: ReviewBackToTopLinkProps) {
  return (
    <a
      href="#top"
      className="text-blue-600 hover:text-blue-800 hover:underline text-lg font-semibold"
    >
      ↑ Back to Top 10 {topicLabel} in {countryDisplay}
    </a>
  );
}
