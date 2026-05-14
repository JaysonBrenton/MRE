"""Unit tests for OverallFinalRankingParser."""

from ingestion.connectors.liverc.parsers.overall_final_ranking_parser import OverallFinalRankingParser


HTML = """
<table class="table leaderboard_points">
  <thead>
    <tr>
      <th colspan="6">
        <div class="class_header">Ep Buggy</div>
      </th>
    </tr>
    <tr>
      <th>Pos</th><th>Brand</th><th>Country</th><th>Driver</th><th>Result</th><th>Race</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>1</td><td></td><td></td><td>DARREN PERRY</td><td>[2] [1] 17/10:02.843</td><td>A Main</td></tr>
    <tr><td>2</td><td></td><td></td><td>CONNOR RIBAS</td><td>[3] [2] 17/10:03.100</td><td>A Main</td></tr>
    <tr><td>14</td><td></td><td></td><td>BEN YARNOLD</td><td>[1] 16/10:11.000</td><td>B Main</td></tr>
  </tbody>
</table>
<table class="table leaderboard_points">
  <thead>
    <tr><th colspan="6"><div class="class_header">Ic Buggy</div></th></tr>
    <tr><th>Pos</th><th>Brand</th><th>Country</th><th>Driver</th><th>Result</th><th>Race</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td></td><td></td><td>ZAC RYAN</td><td>[1] 50/30:07.805</td><td>A Main</td></tr>
  </tbody>
</table>
"""


def test_parse_overall_final_ranking_entries_grouped_by_class():
    parser = OverallFinalRankingParser()
    result = parser.parse(
        HTML,
        "https://example.liverc.com/results/?p=event_overall_ranking&id=123",
        source_overall_ranking_id="123",
        label="Overall Final Ranking",
    )

    assert result.source_overall_ranking_id == "123"
    assert result.label == "Overall Final Ranking"
    assert len(result.entries) == 4

    ep_rows = [r for r in result.entries if r.class_name == "Ep Buggy"]
    assert len(ep_rows) == 3
    assert ep_rows[0].position == 1
    assert ep_rows[0].driver_name == "DARREN PERRY"
    assert ep_rows[2].position == 14
    assert ep_rows[2].race_label == "B Main"

    ic_rows = [r for r in result.entries if r.class_name == "Ic Buggy"]
    assert len(ic_rows) == 1
    assert ic_rows[0].driver_name == "ZAC RYAN"
