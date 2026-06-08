import os

import pytest

from ingestion.common.site_policy import SitePolicy, ScrapingDisabledError


def test_site_policy_enabled_by_default(monkeypatch):
    monkeypatch.delenv("MRE_SCRAPE_ENABLED", raising=False)
    policy = SitePolicy()
    assert policy.is_enabled() is True


def test_site_policy_kill_switch(monkeypatch):
    monkeypatch.setenv("MRE_SCRAPE_ENABLED", "false")
    policy = SitePolicy()
    with pytest.raises(ScrapingDisabledError):
        policy.ensure_enabled("test")


def test_site_policy_applies_db_overrides(monkeypatch):
    monkeypatch.delenv("site_policy_overrides", raising=False)

    class FakeEffective:
        effective_value = '{"hosts":[{"pattern":"live.liverc.com","crawlDelaySeconds":2.0}]}'

    def fake_get_effective(key, mask_secrets=False):
        assert key == "site_policy_overrides"
        return FakeEffective()

    monkeypatch.setattr("ingestion.common.settings.get_effective", fake_get_effective)
    SitePolicy.reset_shared()
    policy = SitePolicy()
    rule = policy._match_rule("live.liverc.com")
    assert rule.crawl_delay == 2.0
    SitePolicy.reset_shared()
