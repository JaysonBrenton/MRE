/**
 * @fileoverview Driver name autocomplete filter component
 *
 * @created 2025-01-27
 * @creator Auto-generated
 * @lastModified 2025-01-27
 *
 * @description Autocomplete/typeahead filter for driver names
 *
 * @purpose Provides a searchable filter input for driver names with autocomplete suggestions.
 *          Debounced for performance with large datasets.
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/LapDataTable.tsx (consumer)
 */

"use client"

import { useState, useEffect, useRef, useMemo } from "react"

export interface DriverNameFilterProps {
  driverNames: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function DriverNameFilter({
  driverNames,
  value,
  onChange,
  placeholder = "Filter by driver name...",
  className = "",
}: DriverNameFilterProps) {
  const [inputValue, setInputValue] = useState(value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Filter driver names based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue || inputValue.trim() === "") {
      return []
    }

    const searchLower = inputValue.toLowerCase().trim()
    return driverNames.filter((name) => name.toLowerCase().includes(searchLower)).slice(0, 10) // Limit to 10 suggestions for performance
  }, [driverNames, inputValue])

  // Debounce the onChange callback
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onChange(inputValue)
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [inputValue, onChange])

  // Sync input value with prop value
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    setHighlightedIndex(-1)
  }

  const handleInputFocus = () => {
    if (inputValue && filteredSuggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false)
      }
    }, 200)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    onChange(suggestion)
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSuggestionClick(filteredSuggestions[highlightedIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setShowSuggestions(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const handleClear = () => {
    setInputValue("")
    onChange("")
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-8 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Filter by driver name"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="driver-name-suggestions"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Clear filter"
          >
            <svg
              className="w-4 h-4 text-[var(--token-text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="driver-name-suggestions"
          className="absolute z-50 w-full mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
                index === highlightedIndex
                  ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                  : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
              }`}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
