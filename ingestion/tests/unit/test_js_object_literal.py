"""Unit tests for LiveRC JS object literal parsing."""

import pytest

from ingestion.connectors.liverc.parsers.js_object_literal import parse_liverc_js_object


def test_live_single_quoted_format():
    block = """{
        'driverName' : 'FELIX KOEGLER',
        'laps': [
            { 'lapNum': '1', 'pos': '1', 'time': '38.17', 'pace': '0', 'segments': [] },
        ],
    }"""
    data = parse_liverc_js_object(block)
    assert data is not None
    assert data["driverName"] == "FELIX KOEGLER"
    assert len(data["laps"]) == 1


def test_fixture_unquoted_keys_double_quoted_strings():
    block = """{
        driverName: "FELIX KOEGLER",
        laps: [
            { lapNum: "1", pos: "1", time: "38.17", pace: "0", segments: [] },
        ],
    }"""
    data = parse_liverc_js_object(block)
    assert data is not None
    assert data["driverName"] == "FELIX KOEGLER"
    assert data["laps"][0]["lapNum"] == "1"


def test_js_escaped_apostrophe_in_name():
    block = """{
        'driverName' : 'MATTHEW O\\'LOUGHLIN',
        'laps': [ { 'lapNum': '1', 'pos': '1', 'time': '40.0', 'pace': '0', 'segments': [] } ],
    }"""
    data = parse_liverc_js_object(block)
    assert data is not None
    assert data["driverName"] == "MATTHEW O'LOUGHLIN"
