from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
files = [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in {'.html', '.js', '.css'} and '.git' not in p.parts and 'node_modules' not in p.parts and 'dist' not in p.parts]

for path in files:
    rel = path.relative_to(root)
    depth = len(rel.parent.parts) if rel.parent != Path('.') else 0
    prefix = '../' * depth
    text = path.read_text(encoding='utf-8')
    original = text

    def replace_abs_path(match):
        attr = match.group('attr')
        value = match.group('value')
        if value.startswith('//') or value.startswith('http://') or value.startswith('https://') or value.startswith('mailto:') or value.startswith('tel:') or value.startswith('javascript:'):
            return match.group(0)
        if value == '/':
            new_value = './' if depth == 0 else prefix[:-1] + '/' if prefix else './'
        else:
            new_value = prefix + value.lstrip('/')
        return f'{attr}="{new_value}"'

    text = re.sub(r'(?P<attr>href|src|action)="(?P<value>/[^"\\s]*)"', lambda m: replace_abs_path(m), text)
    text = re.sub(r"(?P<attr>href|src|action)='(?P<value>/[^'\\s]*)'", lambda m: replace_abs_path(m), text)

    def replace_js_path(match):
        value = match.group('value')
        if value.startswith('//') or value.startswith('http://') or value.startswith('https://') or value.startswith('mailto:') or value.startswith('tel:') or value.startswith('javascript:'):
            return match.group(0)
        if value == '/':
            new_value = './' if depth == 0 else prefix[:-1] + '/' if prefix else './'
        else:
            new_value = prefix + value.lstrip('/')
        return f"{match.group('prefix')}{new_value}{match.group('suffix')}"

    text = re.sub(r'(?P<prefix>(?:import\s+[^"\']+\s+from\s+["\'])|(?:window\.location\.(?:href|replace)\s*=\s*["\']))(?P<value>/[^"\'\s]+)(?P<suffix>["\'])', lambda m: replace_js_path(m), text)

    if text != original:
        path.write_text(text, encoding='utf-8')
print('Updated files')
