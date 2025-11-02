import os
import re
from pathlib import Path
from collections import defaultdict

# Define comment patterns for different languages
COMMENT_PATTERNS = {
    'cs': [
        (r'//.*$', 'single'),  # Single-line comments
        (r'/\*[\s\S]*?\*/', 'multi')  # Multi-line comments
    ],
    'ts': [
        (r'//.*$', 'single'),
        (r'/\*[\s\S]*?\*/', 'multi')
    ],
    'js': [
        (r'//.*$', 'single'),
        (r'/\*[\s\S]*?\*/', 'multi')
    ],
    'tsx': [
        (r'//.*$', 'single'),
        (r'/\*[\s\S]*?\*/', 'multi'),
        (r'{/\*[\s\S]*?\*/}', 'multi')  # JSX comments
    ],
    'jsx': [
        (r'//.*$', 'single'),
        (r'/\*[\s\S]*?\*/', 'multi'),
        (r'{/\*[\s\S]*?\*/}', 'multi')
    ],
    'css': [
        (r'/\*[\s\S]*?\*/', 'multi')
    ],
    'scss': [
        (r'//.*$', 'single'),
        (r'/\*[\s\S]*?\*/', 'multi')
    ],
    'html': [
        (r'<!--[\s\S]*?-->', 'multi')
    ],
    'xml': [
        (r'<!--[\s\S]*?-->', 'multi')
    ],
    'xaml': [
        (r'<!--[\s\S]*?-->', 'multi')
    ],
    'json': [],  # JSON doesn't have comments
    'py': [
        (r'#.*$', 'single'),
        (r'"""[\s\S]*?"""', 'multi'),
        (r"'''[\s\S]*?'''", 'multi')
    ],
    'robot': [
        (r'#.*$', 'single')
    ]
}

def get_file_extension(filepath):
    """Get the file extension without the dot"""
    return Path(filepath).suffix[1:].lower()

def get_top_level_dir(filepath, base_path):
    """Get the top-level directory name"""
    rel_path = os.path.relpath(filepath, base_path)
    parts = rel_path.split(os.sep)
    if len(parts) > 0:
        return parts[0]
    return "root"

def count_lines_in_file(filepath, extension):
    """Count total, code, comment, and blank lines in a file"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        lines = content.split('\n')
        total_lines = len(lines)

        # Get comment patterns for this file type
        patterns = COMMENT_PATTERNS.get(extension, [])

        # Remove multi-line comments first
        temp_content = content
        for pattern, ctype in patterns:
            if ctype == 'multi':
                temp_content = re.sub(pattern, '', temp_content, flags=re.MULTILINE)

        # Count lines after removing multi-line comments
        lines_without_multi = temp_content.split('\n')

        code_lines = 0
        blank_lines = 0
        comment_lines = 0

        # Count comment lines from original content
        original_line_count = len(lines)
        processed_line_count = len(lines_without_multi)
        multi_comment_lines = original_line_count - processed_line_count

        # Now process line by line
        single_patterns = [p for p, t in patterns if t == 'single']

        for line in lines_without_multi:
            stripped = line.strip()

            if not stripped:
                blank_lines += 1
            else:
                # Check if it's a single-line comment
                is_comment = False
                for pattern in single_patterns:
                    if re.match(pattern, stripped):
                        is_comment = True
                        break

                if is_comment:
                    comment_lines += 1
                else:
                    code_lines += 1

        # Add multi-line comment lines to total comments
        comment_lines += multi_comment_lines

        return {
            'total': total_lines,
            'code': code_lines,
            'comments': comment_lines,
            'blank': blank_lines
        }
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return {
            'total': 0,
            'code': 0,
            'comments': 0,
            'blank': 0
        }

def scan_directory(base_path):
    """Scan directory and count lines by top-level directory and language"""

    # Extensions we want to count
    extensions = ['cs', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'xml', 'xaml', 'json', 'py', 'robot']

    # Store results: results[top_dir][extension] = {total, code, comments, blank}
    results = defaultdict(lambda: defaultdict(lambda: {'total': 0, 'code': 0, 'comments': 0, 'blank': 0, 'files': 0}))

    # Scan all files
    for root, dirs, files in os.walk(base_path):
        # Skip node_modules and other build directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__', 'bin', 'obj', 'dist']]

        for file in files:
            filepath = os.path.join(root, file)
            ext = get_file_extension(filepath)

            if ext in extensions:
                top_dir = get_top_level_dir(filepath, base_path)
                counts = count_lines_in_file(filepath, ext)

                # Accumulate counts
                results[top_dir][ext]['total'] += counts['total']
                results[top_dir][ext]['code'] += counts['code']
                results[top_dir][ext]['comments'] += counts['comments']
                results[top_dir][ext]['blank'] += counts['blank']
                results[top_dir][ext]['files'] += 1

    return results

def map_language_name(ext):
    """Map file extension to language name"""
    mapping = {
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
    }
    return mapping.get(ext, ext.upper())

def map_directory_name(dirname):
    """Map directory name to friendly name"""
    mapping = {
        'AllyAssistBuilderInfrastructure': 'BuilderInfra',
        'AllyAssistOneAppAdmin': 'Admin',
        'AllyAssistOneAppPWA': 'PWA',
        'AllyAssistSeleniumTestCode': 'Test'
    }
    return mapping.get(dirname, dirname)

def generate_report(results):
    """Generate a comprehensive report"""
    report_lines = []
    report_lines.append("=" * 100)
    report_lines.append("CODE LINE COUNT ANALYSIS REPORT")
    report_lines.append("=" * 100)
    report_lines.append("")

    # Calculate grand totals
    grand_totals = defaultdict(lambda: {'total': 0, 'code': 0, 'comments': 0, 'blank': 0, 'files': 0})

    # Sort top-level directories
    sorted_dirs = sorted(results.keys())

    for top_dir in sorted_dirs:
        friendly_name = map_directory_name(top_dir)
        report_lines.append(f"\n{'=' * 100}")
        report_lines.append(f"DIRECTORY: {friendly_name} ({top_dir})")
        report_lines.append(f"{'=' * 100}\n")

        # Sort languages by name
        sorted_langs = sorted(results[top_dir].keys(), key=lambda x: map_language_name(x))

        dir_total = {'total': 0, 'code': 0, 'comments': 0, 'blank': 0, 'files': 0}

        for ext in sorted_langs:
            counts = results[top_dir][ext]
            lang_name = map_language_name(ext)

            report_lines.append(f"  {lang_name}:")
            report_lines.append(f"    Files:         {counts['files']:>10,}")
            report_lines.append(f"    Total Lines:   {counts['total']:>10,}")
            report_lines.append(f"    Code Lines:    {counts['code']:>10,}")
            report_lines.append(f"    Comment Lines: {counts['comments']:>10,}")
            report_lines.append(f"    Blank Lines:   {counts['blank']:>10,}")
            report_lines.append("")

            # Accumulate directory totals
            dir_total['files'] += counts['files']
            dir_total['total'] += counts['total']
            dir_total['code'] += counts['code']
            dir_total['comments'] += counts['comments']
            dir_total['blank'] += counts['blank']

            # Accumulate grand totals
            grand_totals[ext]['files'] += counts['files']
            grand_totals[ext]['total'] += counts['total']
            grand_totals[ext]['code'] += counts['code']
            grand_totals[ext]['comments'] += counts['comments']
            grand_totals[ext]['blank'] += counts['blank']

        # Directory summary
        report_lines.append(f"  {'-' * 50}")
        report_lines.append(f"  DIRECTORY TOTAL:")
        report_lines.append(f"    Files:         {dir_total['files']:>10,}")
        report_lines.append(f"    Total Lines:   {dir_total['total']:>10,}")
        report_lines.append(f"    Code Lines:    {dir_total['code']:>10,}")
        report_lines.append(f"    Comment Lines: {dir_total['comments']:>10,}")
        report_lines.append(f"    Blank Lines:   {dir_total['blank']:>10,}")
        report_lines.append("")

    # Grand totals by language
    report_lines.append(f"\n{'=' * 100}")
    report_lines.append("SUMMARY BY LANGUAGE (Across All Directories)")
    report_lines.append(f"{'=' * 100}\n")

    sorted_langs = sorted(grand_totals.keys(), key=lambda x: map_language_name(x))
    overall_total = {'total': 0, 'code': 0, 'comments': 0, 'blank': 0, 'files': 0}

    for ext in sorted_langs:
        counts = grand_totals[ext]
        lang_name = map_language_name(ext)

        report_lines.append(f"  {lang_name}:")
        report_lines.append(f"    Files:         {counts['files']:>10,}")
        report_lines.append(f"    Total Lines:   {counts['total']:>10,}")
        report_lines.append(f"    Code Lines:    {counts['code']:>10,}")
        report_lines.append(f"    Comment Lines: {counts['comments']:>10,}")
        report_lines.append(f"    Blank Lines:   {counts['blank']:>10,}")
        report_lines.append("")

        overall_total['files'] += counts['files']
        overall_total['total'] += counts['total']
        overall_total['code'] += counts['code']
        overall_total['comments'] += counts['comments']
        overall_total['blank'] += counts['blank']

    # Overall totals
    report_lines.append(f"{'=' * 100}")
    report_lines.append("OVERALL TOTALS")
    report_lines.append(f"{'=' * 100}")
    report_lines.append(f"  Total Files:         {overall_total['files']:>10,}")
    report_lines.append(f"  Total Lines:         {overall_total['total']:>10,}")
    report_lines.append(f"  Total Code Lines:    {overall_total['code']:>10,}")
    report_lines.append(f"  Total Comment Lines: {overall_total['comments']:>10,}")
    report_lines.append(f"  Total Blank Lines:   {overall_total['blank']:>10,}")
    report_lines.append(f"{'=' * 100}")

    return '\n'.join(report_lines)

if __name__ == '__main__':
    base_path = r'C:\Users\Rich\Downloads\AllyAssist'
    print("Scanning directory structure and counting lines...")
    results = scan_directory(base_path)
    print("Generating report...")
    report = generate_report(results)
    print(report)

    # Save to file
    output_file = os.path.join(base_path, 'line_count_report.txt')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\nReport saved to: {output_file}")
