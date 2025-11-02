const fs = require('fs');
const path = require('path');

function countLinesInFile(filepath) {
    try {
        const content = fs.readFileSync(filepath, 'utf-8');
        const lines = content.split('\n');
        const totalLines = lines.length;

        // Remove multi-line comments
        let tempContent = content;
        tempContent = tempContent.replace(/\/\*[\s\S]*?\*\//g, '');

        const linesWithoutMulti = tempContent.split('\n');
        const multiCommentLines = totalLines - linesWithoutMulti.length;

        let codeLines = 0;
        let blankLines = 0;
        let commentLines = 0;

        const singleCommentRegex = /^\/\//;

        linesWithoutMulti.forEach(line => {
            const stripped = line.trim();

            if (!stripped) {
                blankLines++;
            } else if (singleCommentRegex.test(stripped)) {
                commentLines++;
            } else {
                codeLines++;
            }
        });

        commentLines += multiCommentLines;

        return {
            total: totalLines,
            code: codeLines,
            comments: commentLines,
            blank: blankLines,
            filepath: filepath
        };
    } catch (error) {
        console.error(`Error reading ${filepath}: ${error.message}`);
        return null;
    }
}

function scanForCSharpFiles(basePath) {
    const skipDirs = ['node_modules', '.git', '__pycache__', 'bin', 'obj', 'dist'];
    const files = [];

    function walk(dir) {
        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);

                try {
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        if (!skipDirs.includes(item)) {
                            walk(fullPath);
                        }
                    } else if (stat.isFile() && path.extname(fullPath).toLowerCase() === '.cs') {
                        const counts = countLinesInFile(fullPath);
                        if (counts) {
                            files.push(counts);
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
    return files;
}

function organizeByDirectory(files, basePath) {
    const structure = {};

    files.forEach(file => {
        const relativePath = path.relative(basePath, file.filepath);
        const parts = relativePath.split(path.sep);

        // Build directory structure
        let current = structure;
        for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];
            if (!current[dirName]) {
                current[dirName] = {
                    __files: [],
                    __totals: { total: 0, code: 0, comments: 0, blank: 0, fileCount: 0 }
                };
            }
            current = current[dirName];
        }

        // Add file to current directory
        const fileName = parts[parts.length - 1];
        current.__files.push({
            name: fileName,
            ...file
        });

        // Update totals up the tree
        let temp = structure;
        for (let i = 0; i < parts.length - 1; i++) {
            temp = temp[parts[i]];
            temp.__totals.total += file.total;
            temp.__totals.code += file.code;
            temp.__totals.comments += file.comments;
            temp.__totals.blank += file.blank;
            temp.__totals.fileCount += 1;
        }
    });

    return structure;
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateReport(structure, basePath) {
    const lines = [];
    lines.push('='.repeat(120));
    lines.push('DETAILED C# CODE ANALYSIS BY DIRECTORY AND FILE');
    lines.push('='.repeat(120));
    lines.push('');

    function printDirectory(dir, dirName, indent = 0) {
        const prefix = '  '.repeat(indent);
        const totals = dir.__totals;

        lines.push(`${prefix}${'='.repeat(120 - indent * 2)}`);
        lines.push(`${prefix}DIRECTORY: ${dirName}`);
        lines.push(`${prefix}Files: ${totals.fileCount} | Total: ${formatNumber(totals.total)} | Code: ${formatNumber(totals.code)} | Comments: ${formatNumber(totals.comments)} | Blank: ${formatNumber(totals.blank)}`);
        lines.push(`${prefix}${'='.repeat(120 - indent * 2)}`);
        lines.push('');

        // Sort subdirectories and files
        const subdirs = Object.keys(dir).filter(k => k !== '__files' && k !== '__totals').sort();

        // Print files in this directory
        if (dir.__files.length > 0) {
            const sortedFiles = dir.__files.sort((a, b) => b.code - a.code);

            lines.push(`${prefix}  FILES IN THIS DIRECTORY:`);
            lines.push(`${prefix}  ${'-'.repeat(115 - indent * 2)}`);

            sortedFiles.forEach(file => {
                const fileDisplay = file.name.padEnd(60);
                const totalDisplay = formatNumber(file.total).padStart(8);
                const codeDisplay = formatNumber(file.code).padStart(8);
                const commentsDisplay = formatNumber(file.comments).padStart(8);
                const blankDisplay = formatNumber(file.blank).padStart(8);

                lines.push(`${prefix}    ${fileDisplay} | Total: ${totalDisplay} | Code: ${codeDisplay} | Cmts: ${commentsDisplay} | Blank: ${blankDisplay}`);
            });
            lines.push('');
        }

        // Print subdirectories
        subdirs.forEach(subdir => {
            printDirectory(dir[subdir], subdir, indent + 1);
        });
    }

    // Print top-level directories
    const topDirs = Object.keys(structure).sort();
    topDirs.forEach(dirName => {
        printDirectory(structure[dirName], dirName, 0);
    });

    // Overall totals
    let grandTotal = { total: 0, code: 0, comments: 0, blank: 0, fileCount: 0 };
    topDirs.forEach(dirName => {
        const totals = structure[dirName].__totals;
        grandTotal.total += totals.total;
        grandTotal.code += totals.code;
        grandTotal.comments += totals.comments;
        grandTotal.blank += totals.blank;
        grandTotal.fileCount += totals.fileCount;
    });

    lines.push('');
    lines.push('='.repeat(120));
    lines.push('OVERALL C# TOTALS');
    lines.push('='.repeat(120));
    lines.push(`Total Files:         ${formatNumber(grandTotal.fileCount).padStart(10)}`);
    lines.push(`Total Lines:         ${formatNumber(grandTotal.total).padStart(10)}`);
    lines.push(`Total Code Lines:    ${formatNumber(grandTotal.code).padStart(10)}`);
    lines.push(`Total Comment Lines: ${formatNumber(grandTotal.comments).padStart(10)}`);
    lines.push(`Total Blank Lines:   ${formatNumber(grandTotal.blank).padStart(10)}`);
    lines.push('='.repeat(120));

    return lines.join('\n');
}

function generateTopFilesReport(files) {
    const lines = [];
    lines.push('');
    lines.push('='.repeat(120));
    lines.push('TOP 50 LARGEST C# FILES BY CODE LINES');
    lines.push('='.repeat(120));
    lines.push('');

    const sorted = files.sort((a, b) => b.code - a.code).slice(0, 50);

    sorted.forEach((file, index) => {
        const relPath = file.filepath.replace('C:\\Users\\Rich\\Downloads\\AllyAssist\\', '');
        lines.push(`${(index + 1).toString().padStart(3)}. ${relPath}`);
        lines.push(`     Total: ${formatNumber(file.total).padStart(8)} | Code: ${formatNumber(file.code).padStart(8)} | Comments: ${formatNumber(file.comments).padStart(8)} | Blank: ${formatNumber(file.blank).padStart(8)}`);
        lines.push('');
    });

    return lines.join('\n');
}

const basePath = 'C:\\Users\\Rich\\Downloads\\AllyAssist';
console.log('Scanning for C# files...');
const files = scanForCSharpFiles(basePath);
console.log(`Found ${files.length} C# files`);

console.log('Organizing by directory structure...');
const structure = organizeByDirectory(files, basePath);

console.log('Generating detailed report...');
const report = generateReport(structure, basePath);
console.log(report);

const topFilesReport = generateTopFilesReport(files);
console.log(topFilesReport);

const outputFile = path.join(basePath, 'csharp_detailed_report.txt');
fs.writeFileSync(outputFile, report + '\n\n' + topFilesReport, 'utf-8');
console.log(`\nDetailed report saved to: ${outputFile}`);
