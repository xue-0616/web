# -*- coding: utf-8 -*-
# Ghidra headless script: decompile every function and dump as JSON.
#
# Runtime is Jython 2.7 (Ghidra-embedded) — NOT Python 3. Keep the dialect
# portable: no f-strings, no `pathlib`.
#
# Invoked as:
#   analyzeHeadless <proj_dir> <proj_name> \
#       -import <elf> -overwrite \
#       -postScript _ghidra_export.py <out_json_path> \
#       -scriptPath <dir_containing_this_file>
#
# Output JSON shape:
#   {
#     "<demangled_symbol>": {
#         "addr": "0x00400000",
#         "signature": "...",
#         "pseudo_c": "..."
#     },
#     ...
#   }
# @runtime Jython

import json
import os
import sys

from ghidra.app.decompiler import DecompileOptions, DecompInterface
from ghidra.util.task import ConsoleTaskMonitor

# --------------------------------------------------------------------------
# Args: post-script args are appended after the flag in the CLI call.
# Ghidra exposes them as `getScriptArgs()`.
args = getScriptArgs()  # noqa: F821
if len(args) < 1:
    print("[export] ERROR: expected <out_json_path>")
    sys.exit(1)

OUT_JSON = args[0]

# --------------------------------------------------------------------------
program = currentProgram  # noqa: F821 provided by Ghidra
listing = program.getListing()
func_mgr = program.getFunctionManager()

monitor = ConsoleTaskMonitor()

opts = DecompileOptions()
opts.grabFromProgram(program)
decomp = DecompInterface()
decomp.setOptions(opts)
decomp.openProgram(program)

results = {}
total = func_mgr.getFunctionCount()
idx = 0
skipped_thunk = 0
skipped_fail = 0

for func in func_mgr.getFunctions(True):
    idx += 1
    if func.isThunk():
        skipped_thunk += 1
        continue
    # Progress log every 250 functions so we can see it's alive.
    if idx % 250 == 0:
        print("[export] progress %d/%d funcs, captured=%d" %
              (idx, total, len(results)))

    # Try both the symbol name (may already be demangled by the Rust analyzer)
    # and the plain name.  We always key by the DEMANGLED display if present.
    sym = func.getSymbol()
    display = sym.getName(True) if sym is not None else func.getName()

    # Skip obvious non-user noise.
    lname = display
    if lname.startswith("FUN_") or lname.startswith("thunk_"):
        continue
    if "drop_in_place" in lname:
        continue
    if lname.startswith("core::") or lname.startswith("alloc::") \
            or lname.startswith("std::") or lname.startswith("<core::"):
        continue

    # Decompile.
    res = decomp.decompileFunction(func, 60, monitor)
    if not res.decompileCompleted():
        skipped_fail += 1
        continue
    decomp_func = res.getDecompiledFunction()
    if decomp_func is None:
        skipped_fail += 1
        continue
    sig = decomp_func.getSignature()
    code = decomp_func.getC()

    addr = "0x" + func.getEntryPoint().toString()
    results[display] = {
        "addr": addr,
        "signature": sig,
        "pseudo_c": code,
    }

print("[export] writing %d functions -> %s (skipped thunk=%d, fail=%d)"
      % (len(results), OUT_JSON, skipped_thunk, skipped_fail))

# Ensure parent dir exists.
try:
    os.makedirs(os.path.dirname(OUT_JSON))
except Exception:
    pass

with open(OUT_JSON, "w") as f:
    json.dump(results, f, ensure_ascii=False, indent=1)

print("[export] done")
