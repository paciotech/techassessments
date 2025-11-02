const fs = require('fs');
const path = require('path');

// Define comment patterns for different languages
const COMMENT_PATTERNS = {
    'cs': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' }
    ],
    'ts': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' }
    ],
    'js': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' }
    ],
    'tsx': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' },
        { regex: /\{\/\*[\s\S]*?\*\/\}/g, type: 'multi' }
    ],
    'jsx': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' },
        { regex: /\{\/\*[\s\S]*?\*\/\}/g, type: 'multi' }
    ],
    'css': [
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' }
    ],
    'scss': [
        { regex: /\/\/.*$/gm, type: 'single' },
        { regex: /\/\*[\s\S]*?\*\//g, type: 'multi' }
    ],
    'html': [
        { regex: /<!--[\s\S]*?-->/g, type: 'multi' }
    ],
    'xml': [
        { regex: /<!--[\s\S]*?-->/g, type: 'multi' }
    ],
    'xaml': [
        { regex: /<!--[\s\S]*?-->/g, type: 'multi' }
    ],
    'json': [],
    'py': [
        { regex: /#.*$/gm, type: 'single' },
        { regex: /"""[\s\S]*?"""/g, type: 'multi' },
        { regex: /'''[\s\S]*?'''/g, type: 'multi' }
    ],
    'robot': [
        { regex: /#.*$/gm, type: 'single' }
    ]
};

function getFileExtension(filepath) {
    return path.extname(filepath).slice(1).toLowerCase();
}

function getTopLevelDir(filepath, basePath) {
    const relPath = path.relative(basePath, filepath);
    const parts = relPath.split(path.sep);
    return parts.length > 0 ? parts[0] : 'root';
}

function countLinesInFile(filepath, extension) {
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split('\n');
        const totalLines = lines.length;

        const patterns = COMMENT_PATTERNS[extension] || [];

        // Remove multi-line comments
        let tempContent = content;
        patterns.filter(p => p.type === 'multi').forEach(pattern => {
            tempContent = tempContent.replace(pattern.regex, '');
        });

        const linesWithoutMulti = tempContent.split('\n');
        const multiCommentLines = totalLines - linesWithoutMulti.length;

        let codeLines = 0;
        let blankLines = 0;
        let commentLines = 0;

        const singlePatterns = patterns.filter(p => p.type === 'single').map(p => p.regex);

        linesWithoutMulti.forEach(line => {
            const stripped = line.trim();

            if (!stripped) {
                blankLines++;
            } else {
                let isComment = false;
                for (const pattern of singlePatterns) {
                    const testRegex = new RegExp(pattern.source);
                    if (testRegex.test(stripped)) {
                        isComment = true;
                        break;
                    }
                }

                if (isComment) {
                    commentLines++;
                } else {
                    codeLines++;
                }
            }
        });

        commentLines += multiCommentLines;

        return {
            total: totalLines,
            code: codeLines,
            comments: commentLines,
            blank: blankLines
        };
    } catch (error) {
        console.error(`Error reading ${filepath}: ${error.message}`);
        return {
            total: 0,
            code: 0,
            comments: 0,
            blank: 0
        };
    }
}

function scanDirectory(basePath) {
    const extensions = ['cs', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml', 'xaml', 'json', 'py', 'robot'];
    const skipDirs = ['node_modules', '.git', '__pycache__', 'bin', 'obj', 'dist'];
    const results = {};

    function walk(dir) {
        try {
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filepath = path.join(dir, file);

                try {
                    const stat = fs.statSync(filepath);

                    if (stat.isDirectory()) {
                        if (!skipDirs.includes(file)) {
                            walk(filepath);
                        }
                    } else if (stat.isFile()) {
                        const ext = getFileExtension(filepath);

                        if (extensions.includes(ext)) {
                            const topDir = getTopLevelDir(filepath, basePath);

                            if (!results[topDir]) {
                                results[topDir] = {};
                            }
                            if (!results[topDir][ext]) {
                                results[topDir][ext] = {
                                    total: 0,
                                    code: 0,
                                    comments: 0,
                                    blank: 0,
                                    files: 0
                                };
                            }

                            const counts = countLinesInFile(filepath, ext);

                            results[topDir][ext].total += counts.total;
                            results[topDir][ext].code += counts.code;
                            results[topDir][ext].comments += counts.comments;
                            results[topDir][ext].blank += counts.blank;
                            results[topDir][ext].files += 1;
                        }
                    }
                } catch (err) {
                    // Skip files we can't access
                }
            }
        } catch (err) {
            console.error(`Error reading directory ${dir}: ${err.message}`);
        }
    }

    walk(basePath);
    return results;
}

function mapLanguageName(ext) {
    const mapping = {
        'cs': 'C#',
        'ts': 'TypeScript',
        'tsx': 'TypeScript (TSX)',
        'js': 'JavaScript',
        'jsx': 'JavaScript (JSX)',
        'css': 'CSS',
        'scss': 'SCSS',
        'html': 'HTML',
        'xml': 'XML',
        'xaml': 'XAML',
        'json': 'JSON',
        'py': 'Python',
        'robot': 'Robot Framework'
    };
    return mapping[ext] || ext.toUpperCase();
}

function mapDirectoryName(dirname) {
    const mapping = {
        'AllyAssistBuilderInfrastructure': 'BuilderInfra',
        'AllyAssistOneAppAdmin': 'Admin',
        'AllyAssistOneAppPWA': 'PWA',
        'AllyAssistSeleniumTestCode': 'Test'
    };
    return mapping[dirname] || dirname;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateReport(results) {
    const lines = [];
    lines.push('='.repeat(100));
    lines.push('CODE LINE COUNT ANALYSIS REPORT');
    lines.push('='.repeat(100));
    lines.push('');

    const grandTotals = {};
    const sortedDirs = Object.keys(results).sort();

    for (const topDir of sortedDirs) {
        const friendlyName = mapDirectoryName(topDir);
        lines.push(`\n${'='.repeat(100)}`);
        lines.push(`DIRECTORY: ${friendlyName} (${topDir})`);
        lines.push(`${'='.repeat(100)}\n`);

        const sortedLangs = Object.keys(results[topDir]).sort((a, b) =>
            mapLanguageName(a).localeCompare(mapLanguageName(b))
        );

        const dirTotal = { total: 0, code: 0, comments: 0, blank: 0, files: 0 };

        for (const ext of sortedLangs) {
            const counts = results[topDir][ext];
            const langName = mapLanguageName(ext);

            lines.push(`  ${langName}:`);
            lines.push(`    Files:         ${formatNumber(counts.files).padStart(10)}`);
            lines.push(`    Total Lines:   ${formatNumber(counts.total).padStart(10)}`);
            lines.push(`    Code Lines:    ${formatNumber(counts.code).padStart(10)}`);
            lines.push(`    Comment Lines: ${formatNumber(counts.comments).padStart(10)}`);
            lines.push(`    Blank Lines:   ${formatNumber(counts.blank).padStart(10)}`);
            lines.push('');

            dirTotal.files += counts.files;
            dirTotal.total += counts.total;
            dirTotal.code += counts.code;
            dirTotal.comments += counts.comments;
            dirTotal.blank += counts.blank;

            if (!grandTotals[ext]) {
                grandTotals[ext] = { total: 0, code: 0, comments: 0, blank: 0, files: 0 };
            }
            grandTotals[ext].files += counts.files;
            grandTotals[ext].total += counts.total;
            grandTotals[ext].code += counts.code;
            grandTotals[ext].comments += counts.comments;
            grandTotals[ext].blank += counts.blank;
        }

        lines.push(`  ${'-'.repeat(50)}`);
        lines.push(`  DIRECTORY TOTAL:`);
        lines.push(`    Files:         ${formatNumber(dirTotal.files).padStart(10)}`);
        lines.push(`    Total Lines:   ${formatNumber(dirTotal.total).padStart(10)}`);
        lines.push(`    Code Lines:    ${formatNumber(dirTotal.code).padStart(10)}`);
        lines.push(`    Comment Lines: ${formatNumber(dirTotal.comments).padStart(10)}`);
        lines.push(`    Blank Lines:   ${formatNumber(dirTotal.blank).padStart(10)}`);
        lines.push('');
    }

    lines.push(`\n${'='.repeat(100)}`);
    lines.push('SUMMARY BY LANGUAGE (Across All Directories)');
    lines.push(`${'='.repeat(100)}\n`);

    const sortedLangs = Object.keys(grandTotals).sort((a, b) =>
        mapLanguageName(a).localeCompare(mapLanguageName(b))
    );

    const overallTotal = { total: 0, code: 0, comments: 0, blank: 0, files: 0 };

    for (const ext of sortedLangs) {
        const counts = grandTotals[ext];
        const langName = mapLanguageName(ext);

        lines.push(`  ${langName}:`);
        lines.push(`    Files:         ${formatNumber(counts.files).padStart(10)}`);
        lines.push(`    Total Lines:   ${formatNumber(counts.total).padStart(10)}`);
        lines.push(`    Code Lines:    ${formatNumber(counts.code).padStart(10)}`);
        lines.push(`    Comment Lines: ${formatNumber(counts.comments).padStart(10)}`);
        lines.push(`    Blank Lines:   ${formatNumber(counts.blank).padStart(10)}`);
        lines.push('');

        overallTotal.files += counts.files;
        overallTotal.total += counts.total;
        overallTotal.code += counts.code;
        overallTotal.comments += counts.comments;
        overallTotal.blank += counts.blank;
    }

    lines.push('='.repeat(100));
    lines.push('OVERALL TOTALS');
    lines.push('='.repeat(100));
    lines.push(`  Total Files:         ${formatNumber(overallTotal.files).padStart(10)}`);
    lines.push(`  Total Lines:         ${formatNumber(overallTotal.total).padStart(10)}`);
    lines.push(`  Total Code Lines:    ${formatNumber(overallTotal.code).padStart(10)}`);
    lines.push(`  Total Comment Lines: ${formatNumber(overallTotal.comments).padStart(10)}`);
    lines.push(`  Total Blank Lines:   ${formatNumber(overallTotal.blank).padStart(10)}`);
    lines.push('='.repeat(100));

    return lines.join('\n');
}

const basePath = 'C:\\Users\\Rich\\Downloads\\AllyAssist';
console.log('Scanning directory structure and counting lines...');
const results = scanDirectory(basePath);
console.log('Generating report...');
const report = generateReport(results);
console.log(report);

const outputFile = path.join(basePath, 'line_count_report.txt');
fs.writeFileSync(outputFile, report, 'utf-8');
console.log(`\nReport saved to: ${outputFile}`);
