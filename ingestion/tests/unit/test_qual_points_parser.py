"""Qual Points parser: LiveRC thead with class row + column row must align td indices."""

import pytest

from ingestion.connectors.liverc.parsers.qual_points_parser import QualPointsParser


NEW_FORMAT_SNIPPET = """
<table class="table leaderboard_points">
  <thead>
    <tr>
      <th colspan="6">
        <span class="class_header">Pro Buggy</span><br />
        <span class="class_sub_header">Tie Breaker: IFMAR</span>
      </th>
    </tr>
    <tr>
      <th>#</th><th>Driver</th><th>Result</th><th>Tie Breaker</th><th>Round 1</th><th>Round 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td><td>ALICE RACER</td><td>2</td><td>—</td>
      <td>1 : 10/1:00.000</td><td>2 : 10/1:01.000</td>
    </tr>
    <tr>
      <td>2</td><td>BOB RACER</td><td>4</td><td>—</td>
      <td>2 : 10/1:02.000</td><td>4 : 10/1:03.000</td>
    </tr>
  </tbody>
</table>
"""

LEGACY_SNIPPET = """
<table>
  <thead>
    <tr>
      <th>#</th><th>Driver</th><th>Result</th><th>Round 1</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td><td>CAROL LEGACY</td><td>0</td><td>0 : 8/5:00.000</td>
    </tr>
  </tbody>
</table>
"""

# Canberra-style: Result column is aggregate laps/time, not integer points (see view_points live pages).
CANBERRA_RESULT_TIME_SNIPPET = """
<table class="table leaderboard_points">
  <thead>
    <tr>
      <th colspan="7">
        <span class="class_header">1/10 Open</span><br />
        <span class="class_sub_header">Tie Breaker: Best Individual Result</span>
      </th>
    </tr>
    <tr>
      <th>#</th><th>Driver</th><th>Result</th><th>Tie Breaker</th><th>Round 1</th><th>Round 2</th><th>Round 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td><td>MARK WALLIN</td><td>11/5:09.946</td><td>tb</td>
      <td>0 : 8/5:02.209</td><td>0 : 11/5:09.946</td><td>0 : 11/5:17.309</td>
    </tr>
  </tbody>
</table>
"""


@pytest.fixture
def parser():
    return QualPointsParser()


def test_new_format_two_row_thead_aligns_columns(parser):
    result = parser.parse(NEW_FORMAT_SNIPPET, "http://t", "1", "Qual (1 of 2)", 1, 2)
    assert len(result.entries) == 2
    first = next(e for e in result.entries if e.position == 1)
    assert first.class_name == "Pro Buggy"
    assert first.driver_name == "ALICE RACER"
    assert first.points == 2


def test_legacy_single_header_row(parser):
    result = parser.parse(LEGACY_SNIPPET, "http://t", "1", "Qual (1 of 1)", 1, 1)
    assert len(result.entries) == 1
    assert result.entries[0].driver_name == "CAROL LEGACY"
    assert result.entries[0].points == 0


def test_result_column_aggregate_time_still_produces_entries(parser):
    """When Result is laps/time (not int), we store 0 for points and keep rows."""
    result = parser.parse(NEW_FORMAT_SNIPPET, "http://t", "1", "Qual (1 of 2)", 1, 2)
    assert len(result.entries) == 2

    result2 = parser.parse(CANBERRA_RESULT_TIME_SNIPPET, "http://t", "7390835", "Results (1 of 3)", 1, 3)
    assert len(result2.entries) == 1
    row = result2.entries[0]
    assert row.class_name == "1/10 Open"
    assert row.position == 1
    assert row.driver_name == "MARK WALLIN"
    assert row.points == 0
