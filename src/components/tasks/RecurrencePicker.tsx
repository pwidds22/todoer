'use client'

import { useState, useRef, useEffect } from 'react'
import { Repeat, ChevronDown, X } from 'lucide-react'
import { buildRRule, describeRRule, parseRRule } from '@/lib/recurrence'

interface RecurrencePickerProps {
  value: string | null
  recurrenceType: string | null
  onChange: (rule: string | null, type: string | null) => void
}

const QUICK_PRESETS = [
  { label: 'Daily', rule: 'FREQ=DAILY' },
  { label: 'Weekly', rule: 'FREQ=WEEKLY' },
  { label: 'Monthly', rule: 'FREQ=MONTHLY' },
  { label: 'Yearly', rule: 'FREQ=YEARLY' },
  { label: 'Weekdays', rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
]

const FREQ_OPTIONS = [
  { value: 'DAILY', label: 'Day(s)' },
  { value: 'WEEKLY', label: 'Week(s)' },
  { value: 'MONTHLY', label: 'Month(s)' },
  { value: 'YEARLY', label: 'Year(s)' },
]

const DAYS_OF_WEEK = [
  { key: 'MO', label: 'M', full: 'Monday' },
  { key: 'TU', label: 'T', full: 'Tuesday' },
  { key: 'WE', label: 'W', full: 'Wednesday' },
  { key: 'TH', label: 'T', full: 'Thursday' },
  { key: 'FR', label: 'F', full: 'Friday' },
  { key: 'SA', label: 'S', full: 'Saturday' },
  { key: 'SU', label: 'S', full: 'Sunday' },
]

export function RecurrencePicker({ value, recurrenceType, onChange }: RecurrencePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'presets' | 'custom'>('presets')
  const [customFreq, setCustomFreq] = useState('WEEKLY')
  const [customInterval, setCustomInterval] = useState(1)
  const [customDays, setCustomDays] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<'fixed' | 'after_completion'>(
    (recurrenceType as 'fixed' | 'after_completion') || 'fixed'
  )
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync state when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseRRule(value)
      setCustomFreq(parsed.freq)
      setCustomInterval(parsed.interval)
      setCustomDays(parsed.byDay ? parsed.byDay.split(',') : [])
    }
  }, [value])

  useEffect(() => {
    setSelectedType((recurrenceType as 'fixed' | 'after_completion') || 'fixed')
  }, [recurrenceType])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  function handlePresetSelect(rule: string) {
    onChange(rule, selectedType)
    setIsOpen(false)
    setMode('presets')
  }

  function handleCustomApply() {
    const parts: { freq: string; interval?: number; byDay?: string | null } = {
      freq: customFreq,
      interval: customInterval,
    }
    if (customFreq === 'WEEKLY' && customDays.length > 0) {
      parts.byDay = customDays.join(',')
    }
    const rule = buildRRule(parts)
    onChange(rule, selectedType)
    setIsOpen(false)
    setMode('presets')
  }

  function handleClear() {
    onChange(null, null)
    setIsOpen(false)
    setMode('presets')
  }

  function toggleDay(day: string) {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function handleTypeChange(type: 'fixed' | 'after_completion') {
    setSelectedType(type)
    if (value) {
      onChange(value, type)
    }
  }

  const description = describeRRule(value)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <div className="flex items-center gap-3">
        <Repeat
          className={`h-4 w-4 shrink-0 ${value ? 'text-blue-400' : 'text-muted-foreground'}`}
        />
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Repeat</label>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 w-full text-sm text-left mt-0.5 hover:text-primary transition-colors"
          >
            <span className={value ? 'text-blue-400' : 'text-muted-foreground'}>
              {description || 'None'}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
          </button>
        </div>
        {value && (
          <button
            onClick={handleClear}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-400 transition-colors"
            title="Remove recurrence"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-700">
            <button
              onClick={() => setMode('presets')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                mode === 'presets'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Quick
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                mode === 'custom'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Custom
            </button>
          </div>

          {mode === 'presets' ? (
            <div className="p-2 space-y-1">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.rule}
                  onClick={() => handlePresetSelect(preset.rule)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    value === preset.rule
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {preset.label}
                  <span className="text-xs text-zinc-500 ml-2">
                    {describeRRule(preset.rule)}
                  </span>
                </button>
              ))}
              {value && (
                <button
                  onClick={handleClear}
                  className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                >
                  No repeat
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {/* Frequency + Interval */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 shrink-0">Every</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={customInterval}
                  onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={customFreq}
                  onChange={(e) => {
                    setCustomFreq(e.target.value)
                    if (e.target.value !== 'WEEKLY') setCustomDays([])
                  }}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {FREQ_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day picker for weekly */}
              {customFreq === 'WEEKLY' && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">On these days</label>
                  <div className="flex gap-1">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        title={day.full}
                        className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                          customDays.includes(day.key)
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recurrence type */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Schedule type</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('fixed')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      selectedType === 'fixed'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                    }`}
                  >
                    Fixed schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('after_completion')}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      selectedType === 'after_completion'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                    }`}
                  >
                    After completion
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {selectedType === 'fixed'
                    ? 'Next date anchored to the original schedule'
                    : 'Next date calculated from when you complete it'}
                </p>
              </div>

              {/* Preview + Apply */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                <span className="text-xs text-zinc-400">
                  {describeRRule(
                    buildRRule({
                      freq: customFreq,
                      interval: customInterval,
                      byDay: customFreq === 'WEEKLY' && customDays.length > 0 ? customDays.join(',') : null,
                    })
                  )}
                </span>
                <button
                  onClick={handleCustomApply}
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
