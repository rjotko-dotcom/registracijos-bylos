# Regression scripts

Playwright scripts driving the dev server. They live in the repo (rather than a
scratch directory) so a rebuilt container does not take them with it.

    npm run dev                 # in one shell
    node tests/core.mjs         # the flows that must never break
    node tests/tasks.mjs        # per-case tasks and the tech sheet
    node tests/ui.mjs           # header summary, sticky titles, manager filter
    node tests/flip.mjs         # cards animate only when they actually move

Playwright is not a dependency of the app; the scripts expect it on the machine
and Chromium at `/opt/pw-browsers/chromium`. If the import fails, link a global
install into place:

    ln -sfn "$(npm root -g)/playwright" node_modules/playwright
