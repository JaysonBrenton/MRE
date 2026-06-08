"""Unit tests for site policy merge."""

from ingestion.common.site_policy_merge import merge_site_policy

BASE_POLICY = {
    "killSwitchEnv": "MRE_SCRAPE_ENABLED",
    "hosts": [
        {
            "pattern": "live.liverc.com",
            "crawlDelaySeconds": 0.1,
            "maxConcurrency": 8,
            "respectRobots": True,
            "conditionalRequests": True,
        },
        {
            "pattern": "*.liverc.com",
            "crawlDelaySeconds": 0.1,
            "maxConcurrency": 8,
            "respectRobots": True,
            "conditionalRequests": True,
        },
    ],
}


def test_merge_preserves_base_hosts_when_override_partial():
    merged = merge_site_policy(
        BASE_POLICY,
        {
            "hosts": [
                {
                    "pattern": "live.liverc.com",
                    "crawlDelaySeconds": 0.5,
                }
            ]
        },
    )

    assert len(merged["hosts"]) == 2
    live = merged["hosts"][0]
    wildcard = merged["hosts"][1]
    assert live["pattern"] == "live.liverc.com"
    assert live["crawlDelaySeconds"] == 0.5
    assert live["maxConcurrency"] == 8
    assert wildcard["pattern"] == "*.liverc.com"
    assert wildcard["crawlDelaySeconds"] == 0.1


def test_merge_appends_new_host_pattern():
    merged = merge_site_policy(
        BASE_POLICY,
        {
            "hosts": [
                {
                    "pattern": "example.com",
                    "crawlDelaySeconds": 1.0,
                    "maxConcurrency": 2,
                }
            ]
        },
    )

    assert len(merged["hosts"]) == 3
    assert merged["hosts"][-1]["pattern"] == "example.com"


def test_merge_empty_overrides_returns_copy():
    merged = merge_site_policy(BASE_POLICY, {})
    assert merged == BASE_POLICY
    assert merged is not BASE_POLICY
