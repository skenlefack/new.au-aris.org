'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  // Health / Medical / Veterinary
  HeartPulse, Stethoscope, Syringe, Pill, Thermometer, Microscope, TestTube,
  ShieldCheck, Bug, Skull, Activity, Heart, Brain, Eye, Ear, Bone,
  Cross, Scan, Biohazard, Dna, Bandage, Baby, Accessibility,
  // Animals / Nature / Wildlife
  Bird, Fish, Cat, Dog, Rabbit, Leaf, TreePine, Flower, Sun, Cloud, Droplets,
  Mountain, Globe, TreeDeciduous, Turtle, Squirrel, Rat, PawPrint, Feather, Shell,
  Trees, Vegan, Clover,
  // Agriculture / Production / Livestock
  Wheat, Apple, Egg, Milk, Tractor, Factory, Warehouse, Package, Scale, Weight,
  Ruler, Beef, Ham, Drumstick, Cherry, Grape, Carrot, Salad, Citrus, Bean,
  // Data / Analytics / KPIs
  BarChart3, LineChart, PieChart, TrendingUp, Database, Table2, FileText,
  FileSpreadsheet, Calculator, Hash, Percent, Binary, ChartArea, ChartBar,
  ChartColumn, ChartLine, ChartPie, ChartSpline, SquareStack, Sigma,
  // Maps / Geography / Geo
  Map, MapPin, Navigation, Compass, Globe2, Flag, Building2, Landmark,
  MapPinned, Route, Locate, Earth,
  // Dashboard / Indicators / UI
  LayoutDashboard, Gauge, Zap, Target, Award, Trophy, Medal, Star, Bookmark,
  Sparkles, Crown, Gem, Lightbulb, Eye as EyeIcon, Signal, Radar,
  // Trade / Commerce / Markets
  ShoppingCart, DollarSign, CreditCard, Receipt, Truck, Ship, Plane, Package as PackageIcon,
  Store, Banknote, Coins, BadgeDollarSign, Container, Handshake,
  // Government / Legal / Governance
  Gavel, Shield, Lock, Key, Building, Users, UserCheck, Briefcase,
  Vote, Scale as ScaleIcon, Scroll, FileCheck, FileLock, Stamp, BadgeCheck,
  // Environment / Climate / Water
  CloudRain, Wind, Waves, Flame, Snowflake, Sprout, Droplet,
  ThermometerSun, CloudSun, Tornado, Umbrella, Recycle, Leaf as LeafIcon,
  // Communication / Alerts
  Bell, Mail, MessageCircle, Phone, Radio, Wifi, Send, AlertTriangle,
  Info, HelpCircle, CheckCircle, XCircle, AlertOctagon, BellRing, Megaphone,
  // Files / Documents
  FileBarChart, FilePieChart, ClipboardList, ClipboardCheck, FolderOpen,
  Archive, BookOpen, Notebook, FileSearch, Files,
  // People / Organization
  UserPlus, UsersRound, Contact, PersonStanding, HeartHandshake,
  GraduationCap, School, Hospital, Sticker,
  // Misc / Tools
  Settings, Wrench, Hammer, Scissors, Pipette, Palette, Paintbrush,
  Shapes, Layers, Grid3X3, LayoutGrid, Component, Puzzle, Blocks,
  Calendar, Clock, Timer, Hourglass, History,
} from 'lucide-react';

// ─── Icon Map ──────────────────────────────────────────────────────────────────

export const ICON_MAP: Record<string, LucideIcon> = {
  // Health / Medical / Veterinary
  HeartPulse, Stethoscope, Syringe, Pill, Thermometer, Microscope, TestTube,
  ShieldCheck, Bug, Skull, Activity, Heart, Brain, Eye, Ear, Bone,
  Cross, Scan, Biohazard, Dna, Bandage, Baby, Accessibility,
  // Animals / Nature / Wildlife
  Bird, Fish, Cat, Dog, Rabbit, Leaf, TreePine, Flower, Sun, Cloud, Droplets,
  Mountain, Globe, TreeDeciduous, Turtle, Squirrel, Rat, PawPrint, Feather, Shell,
  Trees, Vegan, Clover,
  // Agriculture / Production / Livestock
  Wheat, Apple, Egg, Milk, Tractor, Factory, Warehouse, Package, Scale, Weight,
  Ruler, Beef, Ham, Drumstick, Cherry, Grape, Carrot, Salad, Citrus, Bean,
  // Data / Analytics
  BarChart3, LineChart, PieChart, TrendingUp, Database, Table2, FileText,
  FileSpreadsheet, Calculator, Hash, Percent, Binary, ChartArea, ChartBar,
  ChartColumn, ChartLine, ChartPie, ChartSpline, SquareStack, Sigma,
  // Maps / Geography
  Map, MapPin, Navigation, Compass, Globe2, Flag, Building2, Landmark,
  MapPinned, Route, Locate, Earth,
  // Dashboard / Indicators
  LayoutDashboard, Gauge, Zap, Target, Award, Trophy, Medal, Star, Bookmark,
  Sparkles, Crown, Gem, Lightbulb, Signal, Radar,
  // Trade / Commerce
  ShoppingCart, DollarSign, CreditCard, Receipt, Truck, Ship, Plane,
  Store, Banknote, Coins, BadgeDollarSign, Container, Handshake,
  // Government / Legal
  Gavel, Shield, Lock, Key, Building, Users, UserCheck, Briefcase,
  Vote, Scroll, FileCheck, FileLock, Stamp, BadgeCheck,
  // Environment / Climate
  CloudRain, Wind, Waves, Flame, Snowflake, Sprout, Droplet,
  ThermometerSun, CloudSun, Tornado, Umbrella, Recycle,
  // Communication / Alerts
  Bell, Mail, MessageCircle, Phone, Radio, Wifi, Send, AlertTriangle,
  Info, HelpCircle, CheckCircle, XCircle, AlertOctagon, BellRing, Megaphone,
  // Files / Documents
  FileBarChart, FilePieChart, ClipboardList, ClipboardCheck, FolderOpen,
  Archive, BookOpen, Notebook, FileSearch, Files,
  // People / Organization
  UserPlus, UsersRound, Contact, PersonStanding, HeartHandshake,
  GraduationCap, School, Hospital, Sticker,
  // Tools / Misc
  Settings, Wrench, Hammer, Scissors, Pipette, Palette, Paintbrush,
  Shapes, Layers, Grid3X3, LayoutGrid, Component, Puzzle, Blocks,
  Calendar, Clock, Timer, Hourglass, History,
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Shake animation when clicking backdrop
  const [shake, setShake] = useState(false);
  const handleBackdropClick = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return ICON_ENTRIES;
    const q = search.toLowerCase();
    return ICON_ENTRIES.filter(([name]) => name.toLowerCase().includes(q));
  }, [search]);

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 ${
          shake ? 'animate-[shake_0.3s_ease-in-out]' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Icon
            <span className="ml-2 text-xs font-normal text-gray-400">({ICON_ENTRIES.length} available)</span>
          </h3>
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
              placeholder="Search icons... (e.g. heart, fish, chart)"
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
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 lg:grid-cols-12">
              {filtered.map(([name, IconComp]) => {
                const isSelected = name === value;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => onSelect(name)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[#1F4E79] text-white ring-2 ring-[#1F4E79] ring-offset-1 scale-110 dark:ring-offset-gray-800'
                        : 'text-gray-600 hover:bg-gray-100 hover:scale-105 dark:text-gray-400 dark:hover:bg-gray-700'
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

      {/* Shake animation keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );

  return createPortal(modal, document.body);
}
