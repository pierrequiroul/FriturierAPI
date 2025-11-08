/**
 * Utilitaire de logging amélioré pour forcer l'affichage dans tous les contextes
 */

// Force les logs à s'afficher immédiatement (désactive le buffering)
if (process.stdout && process.stdout._handle) {
    process.stdout._handle.setBlocking(true);
}
if (process.stderr && process.stderr._handle) {
    process.stderr._handle.setBlocking(true);
}

function log(message, ...args) {
    console.log(message, ...args);
    // Force le flush en cas de buffering
    if (process.stdout.write) {
        process.stdout.write('');
    }
}

function error(message, ...args) {
    console.error(message, ...args);
    // Force le flush
    if (process.stderr.write) {
        process.stderr.write('');
    }
}

function logBox(title, lines = []) {
    const separator = '='.repeat(50);
    log(`\n${separator}`);
    log(`${title}`);
    lines.forEach(line => log(`  ${line}`));
    log(`${separator}\n`);
}

module.exports = {
    log,
    error,
    logBox
};
