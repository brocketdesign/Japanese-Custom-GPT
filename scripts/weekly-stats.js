#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '═'.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('═'.repeat(60), 'cyan');
}

function logSubsection(title) {
  log(`\n  📌 ${title}`, 'blue');
  log('  ' + '─'.repeat(56), 'blue');
}

async function getWeeklyStats() {
  try {
    logSection('📊 WEEKLY REPOSITORY STATISTICS');
    log(`  Generated on: ${new Date().toLocaleString()}`, 'yellow');

    // Get commits from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    log(`\n  📅 Analyzing commits since: ${sevenDaysAgo}`, 'yellow');

    // Get commit log with stats
    const { stdout: commitLog } = await execAsync(
      `git log --since="${sevenDaysAgo}" --numstat --oneline --format="%H|%an|%ae|%ad|%s" --date=short`
    );

    if (!commitLog.trim()) {
      log('\n  ⚠️  No commits found in the last 7 days.', 'yellow');
      return;
    }

    const lines = commitLog.trim().split('\n');
    let totalAdded = 0;
    let totalRemoved = 0;
    let filesChanged = new Set();
    let commits = [];
    let currentCommit = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // This is a commit header line
        const [hash, author, email, date, message] = line.split('|');
        currentCommit = {
          hash: hash.substring(0, 7),
          author,
          date,
          message,
          added: 0,
          removed: 0,
          filesChanged: 0,
        };
        commits.push(currentCommit);
      } else if (line.match(/^\d+\s+\d+/)) {
        // This is a numstat line
        const [added, removed, file] = line.split('\t');
        const addedNum = parseInt(added) || 0;
        const removedNum = parseInt(removed) || 0;

        if (currentCommit) {
          currentCommit.added += addedNum;
          currentCommit.removed += removedNum;
          currentCommit.filesChanged++;
        }

        totalAdded += addedNum;
        totalRemoved += removedNum;
        filesChanged.add(file);
      }
    }

    logSubsection('Summary Statistics');
    log(
      `  ✅ Total Lines Added:    ${colors.green}${colors.bright}+${totalAdded.toLocaleString()}${colors.reset}`
    );
    log(
      `  ❌ Total Lines Removed:  ${colors.red}${colors.bright}-${totalRemoved.toLocaleString()}${colors.reset}`
    );
    log(
      `  📈 Net Change:          ${colors.magenta}${colors.bright}${(totalAdded - totalRemoved).toLocaleString()}${colors.reset}`
    );
    log(`  📝 Total Commits:       ${colors.bright}${commits.length}${colors.reset}`);
    log(`  📂 Files Changed:       ${colors.bright}${filesChanged.size}${colors.reset}`);

    logSubsection('Commits Details');

    // Sort commits by date (newest first)
    commits.sort((a, b) => new Date(b.date) - new Date(a.date));

    commits.forEach((commit, index) => {
      const netChange = commit.added - commit.removed;
      const netSign = netChange >= 0 ? '+' : '';
      const netColor = netChange >= 0 ? 'green' : 'red';

      log(`\n  ${index + 1}. ${colors.cyan}${commit.hash}${colors.reset} - ${commit.date}`);
      log(
        `     Message: ${commit.message}`,
        'yellow'
      );
      log(
        `     Author:  ${commit.author} <${commit.email}>`
      );
      log(
        `     Changes: ${colors.green}+${commit.added}${colors.reset} / ${colors.red}-${commit.removed}${colors.reset} (${commit.filesChanged} files)`
      );
    });

    logSubsection('Top Affected File Types');

    // Get file type distribution
    const fileTypes = {};
    filesChanged.forEach((file) => {
      const ext = file.includes('.') ? file.split('.').pop() : 'no-ext';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });

    const sortedTypes = Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedTypes.forEach(([type, count]) => {
      const barLength = Math.ceil(count / 2);
      const bar = '█'.repeat(barLength);
      log(`  ${type.padEnd(12)} ${bar} ${count}`);
    });

    logSection('✨ END OF REPORT');
    log('');
  } catch (error) {
    log(`\n  ❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

getWeeklyStats();
