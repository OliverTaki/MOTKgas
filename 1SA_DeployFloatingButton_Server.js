/**
 * TAKE335
 * Deploy floating button feature has been retired by request.
 * Keep a minimal onOpen bridge and cleanup hook only.
 */

function onOpen(e) {
  try {
    if (typeof AutomationMenu === 'function') AutomationMenu();
  } catch (_) {}
}

function motkDeployFloatingOnOpenInstallable_(e) {
  // Deprecated no-op handler kept only to avoid trigger runtime errors
  // if any old installable trigger still points here.
}
