#!/usr/bin/env python3
"""
Post-processing fixes for decompiled NestJS TypeScript files.
Fixes:
1. ClassName_1.name -> ClassName.name (self-references)
2. Leftover exports.X = ... lines
3. Trailing }; -> }
4. var ClassName_1; declarations
5. Missing tsconfig.json
"""

import os, sys, re, json
from pathlib import Path

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    original = content
    
    # Fix 1: ClassName_1.name -> ClassName.name
    # Pattern: SomeClass_1.name -> SomeClass.name
    content = re.sub(r'([A-Z]\w+)_1\.name', r'\1.name', content)
    
    # Fix 2: var ClassName_1; lines
    content = re.sub(r'^var\s+\w+_1;\s*\n', '', content, flags=re.MULTILINE)
    
    # Fix 3: Remove leftover export assignments (various forms)
    content = re.sub(r'^exports\.\w+\s*=\s*\w*;?\s*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'^exports\.\w+\s*=\s*$', '', content, flags=re.MULTILINE)
    # Chain: exports.A = exports.B = <code>  ->  <code>
    content = re.sub(r'(?:exports\.\w+\s*=\s*)+(?=export\s+)', '', content)
    content = re.sub(r'(?:exports\.\w+\s*=\s*)+(?=class\s+|function\s+|const\s+|let\s+|var\s+|enum\s+)', '', content)
    # Standalone chains: exports.A = exports.B = void 0;
    content = re.sub(r'^(?:exports\.\w+\s*=\s*)+void 0;\s*$', '', content, flags=re.MULTILINE)
    # exports.X = X; at end of file
    content = re.sub(r'\nexports\.\w+\s*=\s*\w+;\s*$', '', content)
    
    # Fix 4: Trailing }; -> }  (class end artifact)
    content = re.sub(r'^};\s*$', '}', content, flags=re.MULTILINE)
    
    # Fix 5: let ClassName = ClassName_1 = class ... -> export class ...
    content = re.sub(r'let\s+(\w+)\s*=\s*\w+_1\s*=\s*class\s+\1\s*\{',
                     r'export class \1 {', content)
    content = re.sub(r'let\s+(\w+)\s*=\s*\w+_1\s*=\s*class\s*\{',
                     r'export class \1 {', content)
    
    # Fix 6: Clean (0, X)(args) patterns that may remain  
    content = re.sub(r'\(0,\s*(\w+)\)\(', r'\1(', content)
    
    # Fix 7: Remove __awaiter patterns
    content = re.sub(r'return\s+__awaiter\(this,\s*void\s*0,\s*void\s*0,\s*function\s*\*\s*\(\)\s*\{', '{', content)
    
    # Fix 8: yield -> await
    content = re.sub(r'\byield\s+', 'await ', content)
    
    # Fix 9: Remove multiple consecutive blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # Fix 10: Remove "Wallet = " type leftover assignments mid-file
    content = re.sub(r'^\w+\s*=\s*$', '', content, flags=re.MULTILINE)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def create_tsconfig(service_dir):
    """Create tsconfig.json if missing"""
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
    
    for root, dirs, files in os.walk(base_dir):
        # Skip node_modules and dist
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', '.git')]
        
        for f in files:
            if not f.endswith('.ts'):
                continue
            
            filepath = os.path.join(root, f)
            total_files += 1
            
            if fix_file(filepath):
                fixed_count += 1
    
    # Create missing tsconfigs
    tsconfig_created = 0
    for entry in Path(base_dir).iterdir():
        if entry.is_dir() and (entry / 'src').is_dir():
            if create_tsconfig(str(entry)):
                tsconfig_created += 1
                print(f'  📝 Created tsconfig.json for {entry.name}')
    
    print(f'\nScanned {total_files} .ts files, fixed {fixed_count}')
    if tsconfig_created:
        print(f'Created {tsconfig_created} tsconfig.json files')

if __name__ == '__main__':
    main()
