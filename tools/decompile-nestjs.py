#!/usr/bin/env python3
"""
NestJS dist/ → TypeScript source restorer
Combines .js (logic) + .d.ts (types) + .js.map (paths) to reconstruct .ts files
"""

import os
import sys
import re
import json
import argparse
from pathlib import Path

# ── Helpers ──

def read_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# ── Parse .d.ts for type info ──

def parse_dts(dts_content):
    """Extract type info from .d.ts file"""
    info = {
        'imports': [],
        'class_name': None,
        'properties': {},  # name -> type
        'methods': {},      # name -> { params, return_type }
        'constructor_params': [],
        'implements': [],
        'raw': dts_content,
    }
    
    # Extract imports
    for m in re.finditer(r'^import\s+(.+?);?\s*$', dts_content, re.MULTILINE):
        info['imports'].append(m.group(0).rstrip(';'))
    
    # Extract class declaration
    cls_match = re.search(r'export\s+declare\s+class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?\s*\{', dts_content)
    if cls_match:
        info['class_name'] = cls_match.group(1)
        if cls_match.group(3):
            info['implements'] = [x.strip() for x in cls_match.group(3).split(',')]
    
    # Extract constructor
    ctor_match = re.search(r'constructor\(([^)]*)\)', dts_content)
    if ctor_match and ctor_match.group(1).strip():
        params_str = ctor_match.group(1)
        info['constructor_params'] = parse_params(params_str)
    
    # Extract properties
    for m in re.finditer(r'^\s+(?:private\s+(?:readonly\s+)?)?(\w+)(?:\??):\s*(.+?);?\s*$', dts_content, re.MULTILINE):
        name = m.group(1)
        type_str = m.group(2).rstrip(';').strip()
        if name != 'constructor':
            info['properties'][name] = type_str
    
    # Extract methods
    for m in re.finditer(r'^\s+(\w+)\(([^)]*)\):\s*(.+?);?\s*$', dts_content, re.MULTILINE):
        name = m.group(1)
        if name == 'constructor':
            continue
        params = parse_params(m.group(2))
        ret = m.group(3).rstrip(';').strip()
        info['methods'][name] = {'params': params, 'return_type': ret}
    
    return info

def parse_params(params_str):
    """Parse function parameter string, handling nested generics"""
    if not params_str.strip():
        return []
    
    params = []
    depth = 0
    current = ''
    for ch in params_str:
        if ch in '<({':
            depth += 1
            current += ch
        elif ch in '>)}':
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            params.append(current.strip())
            current = ''
        else:
            current += ch
    if current.strip():
        params.append(current.strip())
    return params

# ── Transform .js to .ts ──

# Boilerplate patterns to remove
BOILERPLATE_PATTERNS = [
    # __decorate helper
    r'var __decorate = \(this && this\.__decorate\).*?\n\};\n',
    # __metadata helper
    r'var __metadata = \(this && this\.__metadata\).*?\n\};\n',
    # __param helper
    r'var __param = \(this && this\.__param\).*?\n\};\n',
    # __awaiter helper
    r'var __awaiter = \(this && this\.__awaiter\).*?\n\};\n',
    # __rest helper
    r'var __rest = \(this && this\.__rest\).*?\n\};\n',
    # __importDefault
    r'var __importDefault = \(this && this\.__importDefault\).*?\n\};\n',
    # __importStar
    r'var __importStar = \(this && this\.__importStar\).*?\n\};\n',
    # "use strict"
    r'^"use strict";\s*\n',
    # Object.defineProperty exports
    r'Object\.defineProperty\(exports,\s*"__esModule",\s*\{[^}]*\}\);\s*\n',
    # sourceMappingURL
    r'//# sourceMappingURL=.*$',
]

def convert_requires_to_imports(js_content):
    """Convert const x = require('y') to import statements and replace references"""
    lines = js_content.split('\n')
    imports = []
    other_lines = []
    
    for line in lines:
        # const foo_1 = require("foo")
        m = re.match(r'^const\s+(\w+)\s*=\s*require\("([^"]+)"\);?\s*$', line)
        if m:
            var_name = m.group(1)
            module_path = m.group(2)
            imports.append((var_name, module_path))
            continue
        
        other_lines.append(line)
    
    body = '\n'.join(other_lines)
    
    # For each require, find all member accesses (var_name.Member) and collect them
    import_statements = []
    for var_name, module_path in imports:
        # Find all usages: var_name.SomeName or (0, var_name.SomeName)
        members = set(re.findall(rf'(?:\(0,\s*)?{re.escape(var_name)}\.(\w+)\)?', body))
        
        if members:
            # Replace (0, var_name.Member)(args) with Member(args)
            body = re.sub(rf'\(0,\s*{re.escape(var_name)}\.(\w+)\)', r'\1', body)
            # Replace var_name.Member with Member
            body = re.sub(rf'{re.escape(var_name)}\.(\w+)', r'\1', body)
            
            members_str = ', '.join(sorted(members))
            import_statements.append(f"import {{ {members_str} }} from '{module_path}';")
        else:
            # Imported but only used as namespace (e.g. dotenv.config())
            clean_name = re.sub(r'_\d+$', '', var_name)
            if clean_name in body or var_name in body:
                body = body.replace(var_name, clean_name)
                import_statements.append(f"import * as {clean_name} from '{module_path}';")
    
    return import_statements, body

def resolve_decorators(js_content):
    """Convert __decorate([...], Class.prototype, "prop", void 0) to inline @Decorator()"""
    
    decorators = {}  # (target, prop) -> [decorator_strings]
    class_decorators = {}  # class_name -> [decorator_strings]
    
    # Property/method decorators
    pattern = r'__decorate\(\[\s*\n?([\s\S]*?)\n?\s*\],\s*(\w+)\.prototype,\s*"(\w+)",\s*(?:void 0|null)\);'
    for m in re.finditer(pattern, js_content):
        dec_body = m.group(1)
        class_name = m.group(2)
        prop_name = m.group(3)
        
        decs = extract_decorator_calls(dec_body)
        decorators[(class_name, prop_name)] = decs
    
    # Class decorators: ClassName = __decorate([...], ClassName)
    cls_pattern = r'(\w+)\s*=\s*__decorate\(\[\s*\n?([\s\S]*?)\n?\s*\],\s*\1\);'
    for m in re.finditer(cls_pattern, js_content):
        class_name = m.group(1)
        dec_body = m.group(2)
        decs = extract_decorator_calls(dec_body)
        class_decorators[class_name] = decs
    
    # Remove all __decorate calls
    cleaned = re.sub(pattern, '', js_content)
    cleaned = re.sub(cls_pattern, '', cleaned)
    
    return decorators, class_decorators, cleaned

def extract_decorator_calls(dec_body):
    """Extract individual decorator calls from __decorate body"""
    decs = []
    # Match (0, module_1.Decorator)(args) or module_1.Decorator(args)
    for m in re.finditer(r'\(0,\s*(\w+)\.(\w+)\)\(([^)]*(?:\([^)]*\))*[^)]*)\)', dec_body):
        module = m.group(1)
        name = m.group(2)
        args = m.group(3)
        decs.append(f'@{name}({args})')
    
    # Direct calls: module_1.Decorator(args)
    for m in re.finditer(r'(?<!\(0,\s)(\w+)\.(\w+)\(([^)]*(?:\([^)]*\))*[^)]*)\)', dec_body):
        module = m.group(1)
        name = m.group(2)
        args = m.group(3)
        if name not in ('decorate', 'metadata', 'defineProperty') and '__' not in name:
            if f'@{name}({args})' not in decs:
                decs.append(f'@{name}({args})')
    
    # Filter out __metadata entries
    decs = [d for d in decs if not d.startswith('@metadata')]
    
    return decs

def transform_class_body(js_content, dts_info, prop_decorators, class_decorators):
    """Rebuild the class with decorators and types"""
    
    if not dts_info.get('class_name'):
        return js_content
    
    class_name = dts_info['class_name']
    
    # Find the class body in JS
    # Pattern: let ClassName = class ClassName { ... }
    cls_pattern = rf'let\s+{class_name}\s*=\s*class\s+{class_name}\s*\{{'
    cls_match = re.search(cls_pattern, js_content)
    if not cls_match:
        # Try: exports.ClassName = ... ; let ClassName = class { ... }
        cls_pattern = rf'let\s+{class_name}\s*=\s*class\s*\{{'
        cls_match = re.search(cls_pattern, js_content)
    
    if not cls_match:
        return js_content
    
    return js_content

def decompile_file(js_path, dts_path, map_path, output_path):
    """Decompile a single .js + .d.ts + .js.map into .ts"""
    
    js_content = read_file(js_path)
    dts_content = read_file(dts_path) if dts_path and os.path.exists(dts_path) else ''
    
    dts_info = parse_dts(dts_content) if dts_content else {}
    
    # Step 1: Remove boilerplate
    result = js_content
    for pattern in BOILERPLATE_PATTERNS:
        result = re.sub(pattern, '', result, flags=re.MULTILINE | re.DOTALL)
    
    # Step 2: Extract decorators BEFORE require replacement (patterns need module_1.Name format)
    prop_decorators, class_decorators, result = resolve_decorators(result)
    
    # Step 3: Convert require() to import and replace all module_1.Name references
    import_lines, result = convert_requires_to_imports(result)
    
    # Step 3b: Also replace module_1.Name in decorator strings
    for key in prop_decorators:
        prop_decorators[key] = [
            re.sub(r'(\w+)_\d+\.(\w+)', r'\2', d) for d in prop_decorators[key]
        ]
    for key in class_decorators:
        class_decorators[key] = [
            re.sub(r'(\w+)_\d+\.(\w+)', r'\2', d) for d in class_decorators[key]
        ]
    
    # Step 4: Use .d.ts imports if available (they have better type info for relative imports)
    if dts_info.get('imports'):
        # Merge: use .d.ts for relative imports, keep generated for package imports
        dts_modules = set()
        for imp in dts_info['imports']:
            m = re.search(r"from\s+['\"]([^'\"]+)['\"]", imp)
            if m:
                dts_modules.add(m.group(1))
        
        merged_imports = []
        for imp in dts_info['imports']:
            merged_imports.append(imp + (';' if not imp.endswith(';') else ''))
        # Add package imports not covered by .d.ts
        for imp in import_lines:
            m = re.search(r"from\s+'([^']+)'", imp)
            if m and m.group(1) not in dts_modules:
                merged_imports.append(imp)
        import_lines = merged_imports
    
    # Step 5: Clean up exports and artifacts
    result = re.sub(r'exports\.(\w+)\s*=\s*void 0;\s*\n?', '', result)
    result = re.sub(r'exports\.(\w+)\s*=\s*(\w+);\s*\n?', '', result)
    result = re.sub(r'^exports\.\w+\s*=\s*$', '', result, flags=re.MULTILINE)
    result = re.sub(r';\s*\n\s*exports\.\w+\s*=\s*\w+\s*;', ';', result)
    # Remove trailing }; (artifact of compiled class)
    result = re.sub(r'^};\s*$', '}', result, flags=re.MULTILINE)
    # Fix import { default } from 'x' -> import x from 'x'
    fixed_imports = []
    for imp in import_lines:
        m = re.match(r"import \{ default \} from '([^']+)';", imp)
        if m:
            mod = m.group(1)
            # Use last path segment as name
            name = re.sub(r'[^a-zA-Z0-9]', '_', mod.split('/')[-1])
            fixed_imports.append(f"import {name} from '{mod}';")
        else:
            fixed_imports.append(imp)
    import_lines = fixed_imports
    
    # Step 6: Rebuild class with decorators and types
    # Add class decorators
    for cls_name, decs in class_decorators.items():
        dec_str = '\n'.join(decs) + '\n'
        result = re.sub(rf'let\s+{cls_name}\s*=\s*class\s+{cls_name}\s*\{{',
                        f'{dec_str}export class {cls_name} {{', result)
        result = re.sub(rf'let\s+{cls_name}\s*=\s*class\s*\{{',
                        f'{dec_str}export class {cls_name} {{', result)
    
    # Mark class as export if not already
    if dts_info.get('class_name'):
        cn = dts_info['class_name']
        if f'export class {cn}' not in result:
            result = re.sub(rf'let\s+{cn}\s*=\s*class\s+{cn}\s*\{{',
                            f'export class {cn} {{', result)
            result = re.sub(rf'let\s+{cn}\s*=\s*class\s*\{{',
                            f'export class {cn} {{', result)
    
    # Step 7: Add property decorators to class
    for (cls_name, prop_name), decs in prop_decorators.items():
        # Find property in class and add decorators before it
        # Look for the property in the constructor or as a class field
        dec_lines = '\n  '.join(decs)
        type_str = dts_info.get('properties', {}).get(prop_name, '')
        type_annotation = f': {type_str}' if type_str else ''
        
        # For entity columns, add decorated property
        prop_pattern = rf'(class\s+{cls_name}\s*\{{[^}}]*?)((\s*)(constructor|}}|\w+\())'
        # We'll collect and add them after the class opening
    
    # Step 8: Insert typed properties into class body
    if dts_info.get('class_name') and prop_decorators:
        cn = dts_info['class_name']
        props_block = ''
        for (cls_name, prop_name), decs in prop_decorators.items():
            if cls_name != cn:
                continue
            type_str = dts_info.get('properties', {}).get(prop_name, 'any')
            dec_str = '\n  '.join(decs)
            props_block += f'\n  {dec_str}\n  {prop_name}: {type_str};\n'
        
        if props_block:
            # Insert after class opening brace
            result = re.sub(
                rf'(export class {cn}\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w,\s]+\s*)?\{{)',
                rf'\1{props_block}',
                result
            )
    
    # Step 9: Add type annotations to constructor params
    if dts_info.get('constructor_params'):
        params_str = ', '.join(dts_info['constructor_params'])
        result = re.sub(r'constructor\([^)]*\)', f'constructor({params_str})', result, count=1)
    
    # Step 10: Add return types to methods  
    for method_name, method_info in dts_info.get('methods', {}).items():
        ret_type = method_info.get('return_type', '')
        if ret_type:
            # Add return type: methodName(...) { -> methodName(...): ReturnType {
            pattern = rf'((?:async\s+)?{method_name}\s*\([^)]*\))\s*\{{'
            replacement = rf'\1: {ret_type} {{'
            result = re.sub(pattern, replacement, result, count=1)
    
    # Step 11: Replace __awaiter with async/await
    result = re.sub(r'return __awaiter\(this, void 0, void 0, function\* \(\) \{', '{', result)
    result = re.sub(r'yield\s+', 'await ', result)
    
    # Step 12: Clean up misc
    result = re.sub(r'\n{3,}', '\n\n', result)  # Remove excess blank lines
    result = result.strip()
    
    # Step 13: Assemble final output
    output = '\n'.join(import_lines) + '\n\n' + result + '\n'
    
    # Final cleanup
    output = re.sub(r'\n{3,}', '\n\n', output)
    
    write_file(output_path, output)
    return True

def process_service(dist_dir, output_dir, service_name):
    """Process all files in a service's dist/ directory"""
    
    count = 0
    errors = 0
    
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            if not f.endswith('.js') or f.endswith('.js.map'):
                continue
            
            js_path = os.path.join(root, f)
            dts_path = js_path.replace('.js', '.d.ts')
            map_path = js_path + '.map'
            
            # Determine output path
            rel_path = os.path.relpath(js_path, dist_dir)
            # dist/src/main.js -> src/main.ts
            out_rel = rel_path.replace('.js', '.ts')
            output_path = os.path.join(output_dir, out_rel)
            
            try:
                decompile_file(js_path, dts_path, map_path, output_path)
                count += 1
            except Exception as e:
                print(f'  ERROR: {rel_path}: {e}', file=sys.stderr)
                errors += 1
    
    return count, errors

def copy_package_json(service_dir, output_dir):
    """Copy and adjust package.json"""
    pkg_path = os.path.join(service_dir, 'package.json')
    if os.path.exists(pkg_path):
        pkg = json.loads(read_file(pkg_path))
        # Add TypeScript dev dependencies
        if 'devDependencies' not in pkg:
            pkg['devDependencies'] = {}
        pkg['devDependencies'].update({
            'typescript': '^5.3.0',
            '@types/node': '^20.0.0',
            'ts-node': '^10.9.0',
        })
        # Add build script
        if 'scripts' not in pkg:
            pkg['scripts'] = {}
        pkg['scripts']['build'] = 'tsc'
        pkg['scripts']['start:dev'] = 'ts-node src/main.ts'
        
        write_file(os.path.join(output_dir, 'package.json'), json.dumps(pkg, indent=2))

def create_tsconfig(output_dir):
    """Create a standard NestJS tsconfig.json"""
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
    write_file(os.path.join(output_dir, 'tsconfig.json'), json.dumps(tsconfig, indent=2))

# ── Main ──

SERVICES = [
    'dexauto-server',
    'huehub-dex-backend',
    'huehub-dex-dobs-backend',
    'mystery-bomb-box-backend',
    'opentg-backend',
    'solagram-backend',
    'utxoswap-paymaster-backend',
]

def main():
    parser = argparse.ArgumentParser(description='NestJS dist/ → TypeScript decompiler')
    parser.add_argument('--src', required=True, help='Path to backend-node directory')
    parser.add_argument('--out', required=True, help='Output directory for restored .ts files')
    parser.add_argument('--services', nargs='*', default=SERVICES, help='Services to process')
    args = parser.parse_args()
    
    total_files = 0
    total_errors = 0
    
    for service in args.services:
        service_dir = os.path.join(args.src, service)
        dist_dir = os.path.join(service_dir, 'dist')
        output_dir = os.path.join(args.out, service)
        
        if not os.path.isdir(dist_dir):
            print(f'⚠️  {service}: no dist/ directory, skipping')
            continue
        
        # Check for .d.ts files
        dts_count = len([f for f in Path(dist_dir).rglob('*.d.ts')])
        js_count = len([f for f in Path(dist_dir).rglob('*.js') if not f.name.endswith('.js.map')])
        
        print(f'🔄 {service}: {js_count} .js, {dts_count} .d.ts')
        
        count, errors = process_service(dist_dir, output_dir, service)
        copy_package_json(service_dir, output_dir)
        create_tsconfig(output_dir)
        
        total_files += count
        total_errors += errors
        print(f'   ✅ Restored {count} files' + (f', {errors} errors' if errors else ''))
    
    print(f'\n{"="*50}')
    print(f'Total: {total_files} files restored, {total_errors} errors')
    print(f'Output: {args.out}')

if __name__ == '__main__':
    main()
