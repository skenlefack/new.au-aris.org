#!/usr/bin/env python3
"""
ARIS 4.0 — E2E API Test Runner.

Runs all API tests against the staging environment and prints a report.

Usage:
  export ARIS_DEPLOY_PASS='your-ssh-password'
  python run_all.py              # run all tests
  python run_all.py credential   # run only credential tests
  python run_all.py --verbose    # verbose output
"""
import sys
import time
import traceback

# ── Import test modules ───────────────────────────────────────────
import test_credential
import test_multi_tenant
import test_domains
import test_rbac
import test_form_builder
from conftest import run_cleanup

# ── Test registry ─────────────────────────────────────────────────
TEST_MODULES = {
    "credential": test_credential,
    "multi_tenant": test_multi_tenant,
    "domains": test_domains,
    "rbac": test_rbac,
    "form_builder": test_form_builder,
}

# ── ANSI colors ───────────────────────────────────────────────────
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def run_test(test_fn, verbose=False):
    """Run a single test function and return (status, duration, error).

    Returns:
        Tuple of (status: str, duration_ms: float, error: str|None)
        status is one of: "PASS", "FAIL", "SKIP"
    """
    start = time.time()
    try:
        result = test_fn()
        duration = (time.time() - start) * 1000
        return ("PASS", duration, None)
    except AssertionError as e:
        duration = (time.time() - start) * 1000
        error = str(e)
        if verbose:
            error += "\n" + traceback.format_exc()
        return ("FAIL", duration, error)
    except Exception as e:
        duration = (time.time() - start) * 1000
        error = f"{type(e).__name__}: {e}"
        if verbose:
            error += "\n" + traceback.format_exc()
        return ("FAIL", duration, error)


def run_module(module_name, module, verbose=False):
    """Run all tests in a module. Returns list of (name, status, duration, error)."""
    results = []
    tests = getattr(module, "ALL_TESTS", [])

    print(f"\n{BOLD}{CYAN}--- {module_name} ({len(tests)} tests) ---{RESET}")

    for test_fn in tests:
        name = test_fn.__name__
        doc = (test_fn.__doc__ or "").strip().split("\n")[0]

        status, duration, error = run_test(test_fn, verbose)

        if status == "PASS":
            icon = f"{GREEN}PASS{RESET}"
        elif status == "FAIL":
            icon = f"{RED}FAIL{RESET}"
        else:
            icon = f"{YELLOW}SKIP{RESET}"

        print(f"  {icon}  {name} ({duration:.0f}ms)")
        if doc and verbose:
            print(f"         {doc}")
        if error:
            # Show first line of error
            first_line = error.split("\n")[0][:120]
            print(f"         {RED}{first_line}{RESET}")

        results.append((f"{module_name}::{name}", status, duration, error))

    return results


def main():
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    # Filter modules by command-line argument
    filter_modules = [
        arg for arg in sys.argv[1:]
        if not arg.startswith("-")
    ]

    print(f"{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  ARIS 4.0 — E2E API Test Suite{RESET}")
    print(f"  Target: staging (test.au-aris.org)")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{BOLD}{'='*60}{RESET}")

    all_results = []
    total_start = time.time()

    for module_name, module in TEST_MODULES.items():
        if filter_modules and module_name not in filter_modules:
            continue
        results = run_module(module_name, module, verbose)
        all_results.extend(results)

    total_duration = time.time() - total_start

    # ── Cleanup ───────────────────────────────────────────────────
    print(f"\n{CYAN}Cleaning up test data...{RESET}")
    run_cleanup()

    # ── Summary ───────────────────────────────────────────────────
    passed = sum(1 for _, s, _, _ in all_results if s == "PASS")
    failed = sum(1 for _, s, _, _ in all_results if s == "FAIL")
    skipped = sum(1 for _, s, _, _ in all_results if s == "SKIP")
    total = len(all_results)

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  RESULTS{RESET}")
    print(f"{'='*60}")
    print(f"  Total:   {total}")
    print(f"  {GREEN}Passed:  {passed}{RESET}")
    if failed > 0:
        print(f"  {RED}Failed:  {failed}{RESET}")
    else:
        print(f"  Failed:  {failed}")
    if skipped > 0:
        print(f"  {YELLOW}Skipped: {skipped}{RESET}")
    print(f"  Time:    {total_duration:.1f}s")
    print(f"{'='*60}")

    # ── Failed test details ───────────────────────────────────────
    if failed > 0:
        print(f"\n{RED}{BOLD}Failed tests:{RESET}")
        for name, status, duration, error in all_results:
            if status == "FAIL":
                print(f"\n  {RED}FAIL{RESET} {name} ({duration:.0f}ms)")
                if error:
                    for line in error.split("\n")[:5]:
                        print(f"    {line}")

    print()

    # Exit code: 0 if all passed, 1 if any failed
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
