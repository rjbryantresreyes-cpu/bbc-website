#requires -Version 5.1
<#
.SYNOPSIS
  Idempotent injector: adds v6.0 redesign shared CSS/JS + social-strip footer
  to every BBC HTML page.

.DESCRIPTION
  For each .html file matching the target list:
    1. Adds <link rel="stylesheet" href="bbc-styles-v6.css"> before </head>
       (skipped if already present)
    2. Adds GSAP + ScrollTrigger + Lenis CDN + bbc-motion.js scripts
       before </body> (skipped if already present)
    3. Adds the social-strip block right after the opening <footer ...>
       tag (skipped if already present)

  Idempotent: safe to run multiple times. Skips pages already injected.

.NOTES
  Run from BBC WEBSITE HTML root:
    pwsh .claude/inject-v6.ps1
#>

param(
  [string]$Root = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
)

$ErrorActionPreference = 'Stop'

# Target pages (no _REDESIGN, no archive, no index.html, no questionnaire-sonya)
$pages = @(
  'about.html', 'contact.html', 'how-it-works.html', 'how-we-help.html',
  'our-team.html', 'our-work.html', 'insights.html', 'resources.html',
  'newsletter.html', 'ai-family.html', 'demo.html', 'client-onboarding.html',
  'install-guide.html', 'portfolio-form.html', 'task-submission.html',
  '404.html',
  'vi.html', 'kenz.html', 'krizza.html', 'al.html', 'daryl.html', 'ryan-c.html'
)

$cssLink   = '  <link rel="stylesheet" href="bbc-styles-v6.css" />'

$scriptBlock = @'
  <!-- v6.0 motion stack -->
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lenis@1.0.42/dist/lenis.min.js"></script>
  <script src="bbc-motion.js"></script>
'@

$socialStrip = @'
    <!-- v6.0 social strip -->
    <div class="footer-social-strip">
      <span class="footer-social-strip__label">Follow Balay ni Bruno &amp; Co.</span>
      <div class="footer__socials">
        <a href="https://www.facebook.com/profile.php?id=61590006878673" target="_blank" rel="noopener noreferrer" class="footer__social" aria-label="Facebook">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 21v-7h2.5l.5-3h-3V9c0-.9.3-1.5 1.6-1.5H17V5.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.1V11H8v3h2.5v7h3z"/></svg>
        </a>
        <a href="https://www.instagram.com/balaynibruno/" target="_blank" rel="noopener noreferrer" class="footer__social" aria-label="Instagram">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.9.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.9.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.9-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.9-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.2-.1 1.6-.1 4.8-.1zm0 3.5c-3.5 0-6.3 2.8-6.3 6.3s2.8 6.3 6.3 6.3 6.3-2.8 6.3-6.3-2.8-6.3-6.3-6.3zm0 10.4c-2.3 0-4.1-1.8-4.1-4.1s1.8-4.1 4.1-4.1 4.1 1.8 4.1 4.1-1.8 4.1-4.1 4.1zm6.4-10.6c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/></svg>
        </a>
        <a href="https://www.tiktok.com/@balaynibruno.co" target="_blank" rel="noopener noreferrer" class="footer__social" aria-label="TikTok">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19.6 6.3c-1.3-.3-2.4-1.1-3.1-2.2-.4-.5-.6-1.1-.7-1.7H12.6v13.2c-.1 1.5-1.3 2.6-2.8 2.6-1.5 0-2.7-1.2-2.7-2.7 0-1.5 1.2-2.7 2.7-2.7.2 0 .5 0 .7.1V9.5c-.2 0-.5 0-.7 0-3.2 0-5.7 2.6-5.7 5.7s2.6 5.7 5.7 5.7 5.7-2.6 5.7-5.7v-6.7c1.2.8 2.6 1.3 4 1.3V6.6c-.2 0-.5 0-.7-.1z"/></svg>
        </a>
        <a href="https://youtube.com/@balaynibruno" target="_blank" rel="noopener noreferrer" class="footer__social" aria-label="YouTube">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21.6 7.2c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3-5.2 3z"/></svg>
        </a>
        <a href="https://www.google.com/search?q=Balay+ni+Bruno+%26+Co." target="_blank" rel="noopener noreferrer" class="footer__social" aria-label="Find us on Google">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 11v2.4h5.7c-.2 1.5-1.7 4.3-5.7 4.3-3.4 0-6.2-2.8-6.2-6.3s2.8-6.3 6.2-6.3c2 0 3.3.8 4 1.6l2.7-2.6C16.9 2.6 14.7 1.7 12 1.7 6.4 1.7 1.9 6.2 1.9 11.8s4.5 10.1 10.1 10.1c5.8 0 9.7-4.1 9.7-9.9 0-.7-.1-1.2-.2-1.7H12z"/></svg>
        </a>
      </div>
    </div>
'@

$report = @()

foreach ($p in $pages) {
  $full = Join-Path $Root $p
  if (-not (Test-Path $full)) {
    $report += [pscustomobject]@{ Page = $p; CSS = 'SKIP-missing'; JS = 'SKIP-missing'; Socials = 'SKIP-missing' }
    continue
  }

  $html = Get-Content -Raw -Encoding UTF8 $full

  $cssResult = 'present'
  $jsResult = 'present'
  $socialResult = 'present'

  # 1) Add CSS link before </head> if not already there
  if ($html -notmatch 'bbc-styles-v6\.css') {
    $html = $html -replace '(?i)</head>', ($cssLink + "`n</head>")
    $cssResult = 'added'
  }

  # 2) Add scripts before </body> if not already there
  if ($html -notmatch 'bbc-motion\.js') {
    $html = $html -replace '(?i)</body>', ($scriptBlock + "`n</body>")
    $jsResult = 'added'
  }

  # 3) Inject social strip right after first <footer ...> opening tag
  if ($html -notmatch 'footer-social-strip') {
    # Match the FIRST opening footer tag and insert AFTER it
    $regex = [regex]'(?i)(<footer[^>]*>)'
    $match = $regex.Match($html)
    if ($match.Success) {
      $insertion = $match.Value + "`n" + $socialStrip
      $html = $regex.Replace($html, $insertion, 1)
      $socialResult = 'added'
    } else {
      $socialResult = 'SKIP-no-footer'
    }
  }

  Set-Content -Path $full -Value $html -Encoding UTF8 -NoNewline

  $report += [pscustomobject]@{
    Page = $p; CSS = $cssResult; JS = $jsResult; Socials = $socialResult
  }
}

$report | Format-Table -AutoSize
Write-Host ''
Write-Host ('Done. {0} pages processed.' -f $report.Count)
