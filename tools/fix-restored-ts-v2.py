#!/usr/bin/env python3
"""
Comprehensive post-processing for ALL restored TypeScript files.
Handles both decompiled (.js+.d.ts) and sourcemap-recovered (.js.map) files.

Fixes:
 1. Remove TS compiler boilerplate (__createBinding, __exportStar, __decorate, __awaiter, etc.)
 2. Convert require() -> import
 3. Convert exports.X = ... -> export const/export default
 4. Replace module_1.Name -> Name (with proper imports)
 5. ClassName_1.name -> ClassName.name
 6. var ClassName_1; cleanup
 7. (0, fn)() -> fn()
 8. Remove //# sourceMappingURL lines
 9. Remove duplicate imports
10. Clean multiple blank lines
"""

import os, sys, re, json
from pathlib import Path
from collections import defaultdict

# TS compiler boilerplate patterns (multi-line blocks to remove entirely)
BOILERPLATE_PATTERNS = [
    # __createBinding
    r'var __createBinding\s*=.*?(?:\}\)\s*\)\s*;|\}\s*;)\n?',
    # __exportStar
    r'var __exportStar\s*=.*?\}\s*\n?',
    # __decorate
    r'var __decorate\s*=.*?(?:\}\);?\s*\n?)',
    # __metadata
    r'var __metadata\s*=.*?(?:\}\);?\s*\n?)',
    # __param
    r'var __param\s*=.*?(?:\}\);?\s*\n?)',
    # __awaiter
    r'var __awaiter\s*=.*?(?:\}\);?\s*\n?)',
    # __rest
    r'var __rest\s*=.*?(?:\}\);?\s*\n?)',
    # __importDefault
    r'var __importDefault\s*=.*?(?:\}\);?\s*\n?)',
    # __importStar
    r'var __importStar\s*=.*?(?:\}\);?\s*\n?)',
    # Object.defineProperty(exports, "__esModule"...)
    r'Object\.defineProperty\(exports,\s*"__esModule".*?\);\s*\n?',
]

# Single-line boilerplate
BOILERPLATE_LINES = [
    r'^"use strict";\s*$',
    r'^Object\.defineProperty\(exports.*$',
    r'^//# sourceMappingURL=.*$',
    r'^var \w+_1;\s*$',
]

def extract_requires(content):
    """Extract all require() calls and build import map"""
    imports = {}
    # const X = require("module")
    for m in re.finditer(r'(?:const|var|let)\s+(\w+)\s*=\s*require\("([^"]+)"\)\s*;?', content):
        alias, mod = m.group(1), m.group(2)
        imports[alias] = mod
    # const { A, B } = require("module")
    for m in re.finditer(r'(?:const|var|let)\s*\{\s*([^}]+)\}\s*=\s*require\("([^"]+)"\)\s*;?', content):
        names, mod = m.group(1).strip(), m.group(2)
        for name in [n.strip() for n in names.split(',') if n.strip()]:
            imports[name] = mod
    return imports

def convert_requires_to_imports(content):
    """Convert CommonJS require() to ES import statements"""
    require_map = extract_requires(content)
    
    # Also extract __importDefault(require("...")) and __importStar(require("..."))
    for m in re.finditer(r'(?:const|var|let)\s+(\w+)\s*=\s*__importDefault\(require\("([^"]+)"\)\)\s*;?', content):
        alias, mod = m.group(1), m.group(2)
        require_map[alias] = mod
        require_map['__default__' + alias] = mod  # Mark as default import
    for m in re.finditer(r'(?:const|var|let)\s+(\w+)\s*=\s*__importStar\(require\("([^"]+)"\)\)\s*;?', content):
        alias, mod = m.group(1), m.group(2)
        require_map[alias] = mod
        require_map['__star__' + alias] = mod  # Mark as star import
    
    # Remove all require variants
    content = re.sub(r'(?:const|var|let)\s+\w+\s*=\s*require\("[^"]+"\)\s*;?\s*\n?', '', content)
    content = re.sub(r'(?:const|var|let)\s*\{[^}]+\}\s*=\s*require\("[^"]+"\)\s*;?\s*\n?', '', content)
    content = re.sub(r'(?:const|var|let)\s+\w+\s*=\s*__importDefault\(require\("[^"]+"\)\)\s*;?\s*\n?', '', content)
    content = re.sub(r'(?:const|var|let)\s+\w+\s*=\s*__importStar\(require\("[^"]+"\)\)\s*;?\s*\n?', '', content)
    # Remove standalone require() calls
    content = re.sub(r'^require\("[^"]+"\)\s*;?\s*$', '', content, flags=re.MULTILINE)
    
    # Remove __exportStar(require(...)) lines
    content = re.sub(r'^__exportStar\(require\("[^"]+"\),\s*exports\)\s*;?\s*$', '', content, flags=re.MULTILINE)
    
    # Replace module_1.Member usages with just Member
    member_imports = defaultdict(set)  # module -> set of members used
    for alias, mod in require_map.items():
        if alias.endswith('_1') or alias.endswith('_2'):
            # Find all alias.Member usages
            pattern = re.compile(rf'{re.escape(alias)}\.(\w+)')
            for usage in pattern.finditer(content):
                member = usage.group(1)
                member_imports[mod].add(member)
            # Replace alias.Member -> Member
            content = pattern.sub(r'\1', content)
    
    # Build proper import statements
    import_lines = []
    existing_imports = set(re.findall(r"import\s+.*?from\s+'([^']+)'", content))
    existing_imports.update(re.findall(r'import\s+.*?from\s+"([^"]+)"', content))
    
    for alias, mod in sorted(require_map.items(), key=lambda x: x[1]):
        if alias.startswith('__default__') or alias.startswith('__star__'):
            continue  # Skip markers, handled below
        if mod in existing_imports:
            continue
        
        is_default = ('__default__' + alias) in require_map
        is_star = ('__star__' + alias) in require_map
        
        if alias.endswith('_1') or alias.endswith('_2'):
            members = member_imports.get(mod, set())
            if members:
                # Remove 'default' from members if present
                members.discard('default')
                if members:
                    import_lines.append(f"import {{ {', '.join(sorted(members))} }} from '{mod}';")
                    existing_imports.add(mod)
        elif is_default:
            # __importDefault -> import X from 'mod'
            # Also replace alias.default -> alias in content
            clean_alias = alias.rstrip('_1').rstrip('_2') if (alias.endswith('_1') or alias.endswith('_2')) else alias
            content = re.sub(rf'\b{re.escape(alias)}\.default\b', clean_alias, content)
            content = re.sub(rf'\b{re.escape(alias)}\b(?!\.)', clean_alias, content)
            import_lines.append(f"import {clean_alias} from '{mod}';")
            existing_imports.add(mod)
        elif is_star:
            # __importStar -> import * as X from 'mod'
            import_lines.append(f"import * as {alias} from '{mod}';")
            existing_imports.add(mod)
        else:
            if alias == 'default':
                continue
            if re.search(rf'\b{re.escape(alias)}\.\w+', content):
                import_lines.append(f"import * as {alias} from '{mod}';")
            else:
                import_lines.append(f"import {{ {alias} }} from '{mod}';")
            existing_imports.add(mod)
    
    # Prepend new imports after existing ones
    if import_lines:
        # Find last import line position
        last_import_pos = 0
        for m in re.finditer(r'^import\s+.*$', content, re.MULTILINE):
            last_import_pos = m.end()
        
        if last_import_pos > 0:
            content = content[:last_import_pos] + '\n' + '\n'.join(import_lines) + content[last_import_pos:]
        else:
            content = '\n'.join(import_lines) + '\n\n' + content
    
    return content

def convert_exports(content):
    """Convert exports.X = value to proper export statements"""
    
    # exports.default = expression; -> export default expression;
    content = re.sub(r'^exports\.default\s*=\s*(.+);?\s*$', r'export default \1;', content, flags=re.MULTILINE)
    
    # exports.CONSTANT = value; -> export const CONSTANT = value;
    # But NOT if it's just exports.X = X; (re-export of existing var)
    def replace_export_assign(m):
        name = m.group(1)
        value = m.group(2).strip().rstrip(';')
        if name == value:
            return ''  # Remove re-export of same name (exports.X = X;)
        if value.startswith('void 0'):
            return ''  # Remove exports.X = void 0;
        if value == '':
            return ''
        # Check if it looks like a function/class/arrow
        if '=>' in value or value.startswith('function') or value.startswith('class'):
            return f'export const {name} = {value};'
        # Constant-like (UPPER_CASE or starts with quote/number)
        if name.isupper() or name[0] in "'\"`" or value[0] in "'\"`0123456789[{(":
            return f'export const {name} = {value};'
        # createParamDecorator etc - functional assignment
        if '(' in value:
            return f'export const {name} = {value};'
        return f'export const {name} = {value};'
    
    content = re.sub(r'^exports\.(\w+)\s*=\s*(.+)$', replace_export_assign, content, flags=re.MULTILINE)
    
    # Chain: exports.A = exports.B = void 0;
    content = re.sub(r'^(?:exports\.\w+\s*=\s*)+void 0;\s*$', '', content, flags=re.MULTILINE)
    
    # Remaining exports.X = X;
    content = re.sub(r'^exports\.\w+\s*=\s*\w+;\s*$', '', content, flags=re.MULTILINE)
    
    # exports.X chains before keywords
    content = re.sub(r'(?:exports\.\w+\s*=\s*)+(?=export\s+|class\s+|function\s+|const\s+|let\s+|var\s+|enum\s+)', '', content)
    
    return content

def fix_file(filepath):
    """Apply all fixes to a single .ts file"""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    original = content
    
    # Phase 0: Remove multi-line boilerplate blocks
    for pattern in BOILERPLATE_PATTERNS:
        content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    # Phase 0b: Remove single-line boilerplate
    for pattern in BOILERPLATE_LINES:
        content = re.sub(pattern, '', content, flags=re.MULTILINE)
    
    # Phase 1: Convert require() to import (for sourcemap-recovered files)
    if 'require(' in content:
        content = convert_requires_to_imports(content)
    
    # Phase 2: Convert exports
    if 'exports.' in content:
        content = convert_exports(content)
    
    # Phase 2b: Clean remaining __importDefault/__importStar wrappers
    content = re.sub(r'__importDefault\((\w+)\)', r'\1', content)
    content = re.sub(r'__importStar\((\w+)\)', r'\1', content)
    
    # Phase 3: ClassName_1 fixes
    # First handle X_1.default -> X (common with __importDefault)
    content = re.sub(r'(\w+)_1\.default\b', r'\1', content)
    content = re.sub(r'([A-Z]\w+)_1\.name', r'\1.name', content)
    content = re.sub(r'([A-Z]\w+)_1\.(\w+)', r'\1.\2', content)
    # lowercase_1. too (e.g. lodash_1.default)
    content = re.sub(r'(\w+)_1\.(\w+)', r'\1.\2', content)
    content = re.sub(r'^var\s+\w+_1;\s*\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'let\s+(\w+)\s*=\s*\w+_1\s*=\s*class\s+\1\s*\{',
                     r'export class \1 {', content)
    content = re.sub(r'let\s+(\w+)\s*=\s*\w+_1\s*=\s*class\s*\{',
                     r'export class \1 {', content)
    
    # Phase 4: (0, fn)(args) -> fn(args)
    content = re.sub(r'\(0,\s*(\w+)\)\(', r'\1(', content)
    
    # Phase 5: Trailing }; -> }
    content = re.sub(r'^};\s*$', '}', content, flags=re.MULTILINE)
    
    # Phase 6: Remove empty assignments
    content = re.sub(r'^\w+\s*=\s*$', '', content, flags=re.MULTILINE)
    
    # Phase 7: Remove duplicate imports (same module imported multiple times)
    seen_imports = {}
    lines = content.split('\n')
    clean_lines = []
    for line in lines:
        m = re.match(r"^import\s+(.+?)\s+from\s+['\"]([^'\"]+)['\"];?\s*$", line)
        if m:
            imports_part, mod = m.group(1), m.group(2)
            key = mod
            if key in seen_imports:
                # Merge: if both are named imports, combine them
                old_line_idx = seen_imports[key]
                old_line = clean_lines[old_line_idx]
                old_m = re.match(r"^import\s+\{\s*([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"];?\s*$", old_line)
                new_m = re.match(r"^\{\s*([^}]+)\}$", imports_part)
                if old_m and new_m:
                    old_names = set(n.strip() for n in old_m.group(1).split(',') if n.strip())
                    new_names = set(n.strip() for n in new_m.group(1).split(',') if n.strip())
                    merged = sorted(old_names | new_names)
                    clean_lines[old_line_idx] = f"import {{ {', '.join(merged)} }} from '{mod}';"
                    continue
                else:
                    continue  # skip duplicate
            seen_imports[key] = len(clean_lines)
        clean_lines.append(line)
    content = '\n'.join(clean_lines)
    
    # Phase 8: Clean up multiple blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)
    content = content.strip() + '\n'
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def create_tsconfig(service_dir):
    tsconfig_path = os.path.join(service_dir, 'tsconfig.json')
    if os.path.exists(tsconfig_path):
        return False
    tsconfig = {
        "compilerOptions": {
            "module": "commonjs",
            "declaration": True,
            "removeComments": True,
            "emitDecoratorMetadata": True,
            "experimentalDecorators": True,
            "allowSyntheticDefaultImports": True,
            "target": "ES2021",
            "sourceMap": True,
            "outDir": "./dist",
            "baseUrl": "./",
            "incremental": True,
            "skipLibCheck": True,
            "strictNullChecks": False,
            "noImplicitAny": False,
            "strictBindCallApply": False,
            "forceConsistentCasingInFileNames": False,
            "noFallthroughCasesInSwitch": False
        }
    }
    with open(tsconfig_path, 'w') as f:
        json.dump(tsconfig, f, indent=2)
    return True

def main():
    base_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    fixed_count = 0
    total_files = 0
    svc_stats = defaultdict(lambda: {'total': 0, 'fixed': 0})
    
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', '.git', 'target')]
        
        for f in files:
            if not f.endswith('.ts'):
                continue
            filepath = os.path.join(root, f)
            
            # Determine service name
            relpath = os.path.relpath(filepath, base_dir)
            parts = relpath.split(os.sep)
            svc_name = parts[0] if len(parts) > 1 else 'root'
            
            total_files += 1
            svc_stats[svc_name]['total'] += 1
            
            if fix_file(filepath):
                fixed_count += 1
                svc_stats[svc_name]['fixed'] += 1
    
    # Print per-service stats
    print("\n  Service                              Fixed / Total")
    print("  " + "-" * 50)
    for svc in sorted(svc_stats.keys()):
        s = svc_stats[svc]
        if s['fixed'] > 0:
            print(f"  {svc:35s}  {s['fixed']:4d} / {s['total']:4d}")
    
    # Create missing tsconfigs
    tsconfig_created = 0
    for entry in Path(base_dir).iterdir():
        if entry.is_dir() and (entry / 'src').is_dir():
            if create_tsconfig(str(entry)):
                tsconfig_created += 1
                print(f'  Created tsconfig.json for {entry.name}')
    
    print(f'\n  Total: scanned {total_files} files, fixed {fixed_count}')
    if tsconfig_created:
        print(f'  Created {tsconfig_created} tsconfig.json files')

if __name__ == '__main__':
    main()
