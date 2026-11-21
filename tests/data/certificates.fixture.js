// TEST DATA ONLY — served in place of certificates.js during Playwright runs so
// the Certificates section can be tested before real certificates are added.
// Covers each combination of the optional fields.
window.CERTIFICATES = [
  {
    title: 'Test Certificate Alpha',
    issuer: 'Test Academy',
    issued: 'June 2024',
    detail: 'Certificate of Completion',
    image: 'certificates/test-alpha.webp',
  },
  {
    title: 'Test Certificate Beta With A Deliberately Long Title To Check Wrapping',
    issuer: 'Example Online Learning Platform',
    issued: 'October 2025',
    detail: 'Credential ID TEST-123',
    image: 'certificates/test-beta.webp',
    link: 'https://example.com/verify/TEST-123',
  },
  {
    title: 'Test Certificate Gamma',
    issuer: 'Test College',
    issued: 'March 2023',
    link: 'https://example.com/verify/gamma',
  },
];
