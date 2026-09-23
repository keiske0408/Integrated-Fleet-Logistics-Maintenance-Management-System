const { execSync } = require('child_process');

try {
  const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf-8',
  })
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const nonTestFiles = stagedFiles.filter(
    (file) =>
      !file.includes('.test.') &&
      !file.includes('.spec.') &&
      !file.startsWith('tests/') &&
      (file.endsWith('.ts') ||
        file.endsWith('.tsx') ||
        file.endsWith('.js') ||
        file.endsWith('.jsx')),
  );

  let hasConsole = false;
  for (const file of nonTestFiles) {
    try {
      const content = execSync(`git show :${file}`, { encoding: 'utf-8' });
      if (content.includes('console.log(')) {
        console.error(`[Pre-commit Error] Forbidden console.log found in: ${file}`);
        hasConsole = true;
      }
    } catch {
      // file might have been deleted or skipped
    }
  }

  if (hasConsole) {
    console.error('Use logger.debug("[module]", ...) instead of bare console.log.');
    process.exit(1);
  }
} catch (error) {
  // If git fails or no staged files, ignore
}
