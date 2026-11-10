"""Run OVERDRIVE's built-in self-tests through pytest."""
import os

import pytest

from overdrive import selftest
from overdrive.brain import find_cli

selftest.load_all()
selftest.CLI = find_cli(os.environ.get("OVERDRIVE_TEST_CLI", ""))


@pytest.mark.parametrize("name", sorted(selftest.TESTS))
def test_selftest(name):
    t = selftest.TESTS[name]
    if t.needs_cli and not selftest.CLI:
        pytest.skip("Claude Code is not installed")
    t.fn()
