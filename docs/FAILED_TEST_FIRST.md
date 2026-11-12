# Failed-test-first rechecks

The required **Data and site tests** workflow always runs JSON validation, all
Node unit tests and all four PC/mobile Playwright shards before a PR is merged.
**Nothing about the required merge gate is bypassed.**

## After a failure (GitHub Actions)

1. Note the numeric run ID of the failed **Data and site tests** workflow.
2. Fix the cause on your branch. Normal PR CI still runs fully.
3. For a faster check of the *same failing tests*, open
   **Actions → Focused failure recheck (diagnostic, not a merge gate) → Run workflow**.
   Choose the branch containing the fix and enter the previous run ID as source_run_id.
4. It fetches prior failure artifacts, reruns **only previously failed Node test files**
   and **only previously failed Playwright test IDs**, including PC/スマホ projects.
   Tests that already passed are skipped.
5. Even if the focused check passes, **wait for full required PR CI before merging**.
   Focused success does not imply the rest of the suite passed.

GitHub CLI alternative:

    gh workflow run focused-failure-recheck.yml --ref MY-FIX-BRANCH -f source_run_id=PREVIOUS_FAILED_RUN_ID

Failure artifacts are kept for seven days. The focused workflow fails closed if
there are no usable earlier artifacts, such as when a browser server cannot boot.

## Local workflow

After a full run has failed:

- Unit: run npm run test:unit to create test-results/unit-last-failed.json.
  Then npm run test:failed:unit reruns files containing failures.
- Browser: run npm run test:e2e to create test-results/.last-run.json.
  Then npm run test:failed:e2e uses Playwright's --last-failed and reruns only
  failed test IDs. The original PC/スマホ project is preserved.

Node rechecks **failed files**, to avoid ambiguous nested test names; Playwright
rechecks **individual IDs**. Both are diagnostics. When a manifest is clean,
the commands explicitly skip and do not claim full-suite approval.

Full CI generates the unit-failure-report artifact and the site-test-report-1
through site-test-report-4 artifacts. Missing or invalid manifests and unknown
test file paths fail explicitly rather than rerunning arbitrary files.
