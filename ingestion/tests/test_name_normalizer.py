# @fileoverview Tests for driver name normalization
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27

import pytest
from ingestion.ingestion.normalizer import Normalizer


class TestNameNormalizer:
    """Tests for driver name normalization."""
    
    def test_basic_normalization(self):
        """Test basic normalization: lowercase, trim, collapse whitespace."""
        assert Normalizer.normalize_driver_name("JOHN DOE") == "doe john"
        assert Normalizer.normalize_driver_name("  john   doe  ") == "doe john"
        assert Normalizer.normalize_driver_name("John\tDoe\nSmith") == "doe john smith"
    
    def test_punctuation_stripping(self):
        """Test that punctuation is stripped."""
        assert Normalizer.normalize_driver_name("John O'Brien") == "john obrien"
        assert Normalizer.normalize_driver_name("Mary-Jane Watson") == "mary jane watson"
        assert Normalizer.normalize_driver_name("Bob & Alice") == "alice and bob"
    
    def test_ampersand_replacement(self):
        """Test that & is replaced with 'and'."""
        assert Normalizer.normalize_driver_name("Smith & Co") == "and co smith"
        assert Normalizer.normalize_driver_name("A & B Racing") == "a and b racing"
    
    def test_noise_token_removal(self):
        """Test that common noise tokens are removed."""
        assert Normalizer.normalize_driver_name("John Doe RC") == "doe john"
        assert Normalizer.normalize_driver_name("Jane Smith Raceway") == "jane smith"
        assert Normalizer.normalize_driver_name("Bob Team") == "bob"
        assert Normalizer.normalize_driver_name("Alice Club") == "alice"
        assert Normalizer.normalize_driver_name("Charlie Inc") == "charlie"
        assert Normalizer.normalize_driver_name("John RC Team") == "john"
    
    def test_token_sorting(self):
        """Test that tokens are sorted for multi-word names."""
        assert Normalizer.normalize_driver_name("Smith John") == "john smith"
        assert Normalizer.normalize_driver_name("John Smith") == "john smith"
        assert Normalizer.normalize_driver_name("Mary Jane Watson") == "jane mary watson"
    
    def test_empty_and_none(self):
        """Test edge cases: empty strings and None."""
        assert Normalizer.normalize_driver_name("") == ""
        assert Normalizer.normalize_driver_name("   ") == ""
        assert Normalizer.normalize_driver_name(None) == ""
    
    def test_complex_real_world_examples(self):
        """Test complex real-world name variations."""
        # Common variations that should normalize to the same thing
        assert Normalizer.normalize_driver_name("Jayson Brenton") == "brenton jayson"
        assert Normalizer.normalize_driver_name("JAYSON BRENTON") == "brenton jayson"
        assert Normalizer.normalize_driver_name("  Jayson   Brenton  ") == "brenton jayson"
        assert Normalizer.normalize_driver_name("Jayson-Brenton") == "brenton jayson"
        
        # With noise tokens
        assert Normalizer.normalize_driver_name("Jayson Brenton RC") == "brenton jayson"
        assert Normalizer.normalize_driver_name("Jayson Brenton Team") == "brenton jayson"
    
    def test_single_word_names(self):
        """Test single word names."""
        assert Normalizer.normalize_driver_name("Madonna") == "madonna"
        assert Normalizer.normalize_driver_name("Cher") == "cher"
        assert Normalizer.normalize_driver_name("Sting") == "sting"
    
    def test_numbers_in_names(self):
        """Test names with numbers."""
        assert Normalizer.normalize_driver_name("John Doe 123") == "123 doe john"
        assert Normalizer.normalize_driver_name("Driver #5") == "5 driver"

