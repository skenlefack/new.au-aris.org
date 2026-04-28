'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  HeartPulse, Stethoscope, Syringe, Pill, Thermometer, Microscope, TestTube,
  ShieldCheck, Bug, Skull, Activity, Heart, Brain, Eye, Ear, Bone,
  Bird, Fish, Cat, Dog, Rabbit, Leaf, TreePine, Flower, Sun, Cloud, Droplets, Mountain, Globe,
  Wheat, Apple, Egg, Milk, Tractor, Factory, Warehouse, Package, Scale, Weight, Ruler,
  BarChart3, LineChart, PieChart, TrendingUp, Database, Table2, FileText, FileSpreadsheet,
  Calculator, Hash, Percent, Binary,
  Map, MapPin, Navigation, Compass, Globe2, Flag, Building2, Landmark,
  LayoutDashboard, Gauge, Zap, Target, Award, Trophy, Medal, Star, Bookmark,
  ShoppingCart, DollarSign, CreditCard, Receipt, Truck, Ship, Plane,
  Gavel, Shield, Lock, Key, Building, Users, UserCheck, Briefcase,
  CloudRain, Wind, Waves, Flame, Snowflake, Sprout,
  Bell, Mail, MessageCircle, Phone, Radio, Wifi, Send,
} from 'lucide-react';

// ─── Icon Map ──────────────────────────────────────────────────────────────────
// Maps string names (PascalCase) to their lucide-react component.
// Exported so other components can render icons by name.

export const ICON_MAP: Record<string, LucideIcon> = {
  // Health / Medical
  HeartPulse, Stethoscope, Syringe, Pill, Thermometer, Microscope, TestTube,
  ShieldCheck, Bug, Skull, Activity, Heart, Brain, Eye, Ear, Bone,
  // Animals / Nature
  Bird, Fish, Cat, Dog, Rabbit, Leaf, TreePine, Flower, Sun, Cloud, Droplets, Mountain, Globe,
  // Agriculture / Production
  Wheat, Apple, Egg, Milk, Tractor, Factory, Warehouse, Package, Scale, Weight, Ruler,
  // Data / Analytics
  BarChart3, LineChart, PieChart, TrendingUp, Database, Table2, FileText, FileSpreadsheet,
  Calculator, Hash, Percent, Binary,
  // Maps / Geography
  Map, MapPin, Navigation, Compass, Globe2, Flag, Building2, Landmark,
  // Dashboard / UI
  LayoutDashboard, Gauge, Zap, Target, Award, Trophy, Medal, Star, Bookmark,
  // Trade / Commerce
  ShoppingCart, DollarSign, CreditCard, Receipt, Truck, Ship, Plane,
  // Government / Legal
  Gavel, Shield, Lock, Key, Building, Users, UserCheck, Briefcase,
  // Environment / Climate
  CloudRain, Wind, Waves, Flame, Snowflake, Sprout,
  // Communication
  Bell, Mail, MessageCircle, Phone, Radio, Wifi, Send,
  // Generic
  Circle,
};

const ICON_ENTRIES = Object.entries(ICON_MAP);

// ─── Component ─────────────────────────────────────────────────────────────────

interface IconPickerProps {
  open: boolean;
  value: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ open, value, onSelect, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_ENTRIES;
    const q = search.toLowerCase();
    return ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(q));
  }, [search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Icon</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              autoFocus
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-[#1F4E79] focus:outline-none focus:ring-1 focus:ring-[#1F4E79] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No icons found.</p>
          ) : (
            <div className="grid grid-cols-8 gap-2 lg:grid-cols-10">
              {filtered.map(([name, IconComp]) => {
                const isSelected = name === value;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => { onSelect(name); onClose(); }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-[#1F4E79] text-white ring-2 ring-[#1F4E79] ring-offset-1 dark:ring-offset-gray-800'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    <IconComp className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-2.5 dark:border-gray-700">
          <p className="text-xs text-gray-400">
            {filtered.length} icon{filtered.length !== 1 ? 's' : ''}
            {value && <span> &middot; Selected: <strong className="text-gray-600 dark:text-gray-300">{value}</strong></span>}
          </p>
        </div>
      </div>
    </div>
  );
}
