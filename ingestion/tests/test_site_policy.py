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
