# Testing the portfolio

This site is plain HTML, CSS and JavaScript. The testing tools are dev-only and are never loaded by the website itself.

| Tool | What it checks | Command |
|---|---|---|
| Playwright | Navigation, responsive layout at 5 widths, skill filters, project details, animations, contact links, keyboard use | `npm test` |
| axe-core (inside Playwright) | WCAG 2.2 A/AA rules, including colour contrast | `npm run test:a11y` |
| Lighthouse | Performance, Accessibility, Best Practices and SEO on desktop and mobile | `npm run lighthouse` / `npm run lighthouse:mobile` |
| W3C Nu HTML Checker | Whether the HTML is valid | `npm run validate:html` |

## First-time setup

```bash
npm install
npx playwright install chromium
```

You need Node.js 18 or newer. Lighthouse uses your installed Google Chrome (set `CHROME_PATH` to use a different one).

## Everyday commands

```bash
npm test                      # all Playwright tests (desktop 1366px + Pixel 7 phone)
npx playwright test --ui      # interactive runner: watch, step through, time-travel
npm run test:headed           # watch the browser while tests run
npm run test:responsive       # only the 1920/1366/768/390/320px layout tests
npm run test:a11y             # only accessibility tests
npx playwright show-report    # open the HTML report (includes full-page screenshots)
npm run validate:html         # W3C validation (sends index.html to validator.w3.org)
npm run lighthouse            # desktop Lighthouse  -> reports/lighthouse-desktop.html
npm run lighthouse:mobile     # mobile Lighthouse   -> reports/lighthouse-mobile.html
npm run test:all              # all of the above
```

To check that the live external links (GitHub, LinkedIn) respond, run this in PowerShell:

```powershell
$env:CHECK_EXTERNAL_LINKS=1; npx playwright test tests/contact.spec.js
```

To view the site locally on its own, run `npm run serve` and open http://127.0.0.1:4173.

## Files

```text
tests/
  fixtures.js              shared helpers; every test fails on JS errors, console errors or 404s
  navigation.spec.js       nav links, scroll-spy, sticky header, progress bar, hamburger menu
  responsive.spec.js       5 viewports: overflow, overlap, text overflow, images, menu, columns
  skills.spec.js           filter buttons, the correct cards for each category, keyboard use
  projects.spec.js         details expand and collapse, repository link, mobile card layout
  interactions.spec.js     reveal animations, layout shift, parallax, reduced motion
  certificates.spec.js     certificate cards, preview dialog (open/close/keyboard/focus), verify links, empty list
  data/certificates.fixture.js   fake test certificates served in place of certificates.js during tests
  contact.spec.js          mailto, LinkedIn and GitHub links, new-tab safety, broken links
  accessibility.spec.js    axe-core, keyboard, alt text, headings, landmarks, labels
scripts/
  serve.js                 small static server with no dependencies
  lighthouse.js            Lighthouse runner and score summary
  validate-html.js         W3C validator (offline when Java and vnu-jar are installed)
playwright.config.js
```

Reports are written to `playwright-report/`, `reports/` and `test-results/`. These folders are generated, so they are listed in `.gitignore`.

## Notes on how the tests work

- Tests **always use test certificates** from `tests/data/certificates.fixture.js` instead of your real `certificates.js`. That way the Certificates section is tested even while your list is empty, and the tests keep passing however many certificates you add.
- External sites are **stubbed** in the link tests. They stay fast and still work offline, while still checking the exact URL that opens in the new tab.
- The layout and accessibility tests emulate `prefers-reduced-motion: reduce`. This makes them measure the final layout rather than a frame halfway through an animation. The animations themselves are tested separately with motion enabled.
- `body { overflow-x: hidden }` hides horizontal overflow, so the responsive tests also check each element's position against the viewport edges.
- Some tests are **skipped on purpose**:
  - Parallax tests run only on devices with a mouse, and the touch-device test runs only on the phone.
  - Hamburger-menu tests run only at 900px or narrower.
  - The live external-link check runs only when you opt in.
