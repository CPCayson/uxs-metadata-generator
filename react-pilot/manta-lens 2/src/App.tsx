/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  AlertCircle,
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Database, 
  FileText, 
  Map as MapIcon, 
  Tag, 
  Share2,
  RefreshCw,
  Zap,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  Cell
} from 'recharts';
import { cn } from './lib/utils.ts';
import { getSymbioteSuggestion } from './services/geminiService.ts';

// --- TYPES ---
type StepId = 'mission' | 'platform' | 'sensors' | 'spatial' | 'keywords' | 'distribution';

interface ValidationError {
  field: keyof AppState | string;
  message: string;
  tier: 'T1' | 'T2' | 'T3';
  line?: number;
}

const FIELD_MAPPING: Record<string, { step: StepId; label: string }> = {
  title: { step: 'mission', label: 'Official Title' },
  abstract: { step: 'mission', label: 'Abstract' },
  doi: { step: 'distribution', label: 'Digital Object Identifier (DOI)' },
  accession: { step: 'distribution', label: 'NCEI Accession ID' },
  org: { step: 'distribution', label: 'Responsible Organization' },
  email: { step: 'distribution', label: 'Point of Contact Email' },
  north: { step: 'spatial', label: 'North Coordinate' },
  south: { step: 'spatial', label: 'South Coordinate' },
  east: { step: 'spatial', label: 'East Coordinate' },
  west: { step: 'spatial', label: 'West Coordinate' },
};

interface Step {
  id: StepId;
  label: string;
  icon: React.ReactNode;
}

interface Sensor {
  id: string;
  type: string;
  observedVariable: string;
  manufacturer: string;
  model: string;
  sn: string;
}

interface Platform {
  id: string;
  manufacturer: string;
  model: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  maxSpeed: string;
  powerSource: string;
  navigation: string;
}

interface AppState {
  title: string;
  abstract: string;
  purpose: string;
  doi: string;
  accession: string;
  org: string;
  email: string;
  west: number;
  east: number;
  south: number;
  north: number;
  uxsContext: string;
  uxsOutcome: string;
  maintenanceFrequency: string;
  platform: Platform | null;
  sensors: Sensor[];
}

// --- CONSTANTS ---
const SENSOR_LIBRARY = [
  { type: "Synthetic Aperture Sonar", observedVariable: "Bathymetry", manufacturer: "Kraken", model: "KATFISH" },
  { type: "Multibeam Echosounder", observedVariable: "Seafloor Topography", manufacturer: "Kongsberg", model: "EM 2040" },
  { type: "Side Scan Sonar", observedVariable: "Seafloor Imagery", manufacturer: "EdgeTech", model: "4200" }
];

const PLATFORM_LIBRARY: Record<string, Platform> = {
  "REMUS 620": {
    id: "REMUS620_401",
    manufacturer: "HII",
    model: "REMUS 620",
    weight: "450 kg",
    length: "3.5 m",
    width: "0.48 m",
    height: "0.48 m",
    maxSpeed: "4 knots",
    powerSource: "Lithium Ion",
    navigation: "Inertial / DVL / GPS"
  }
};

const SENSOR_METRICS = [
  { name: 'Resolution', value: 85 },
  { name: 'Range', value: 72 },
  { name: 'Precision', value: 94 },
  { name: 'Data Rate', value: 60 },
  { name: 'Reliability', value: 88 },
];

const PLATFORM_PERFORMANCE = [
  { subject: 'Speed', A: 120, B: 110, fullMark: 150 },
  { subject: 'Battery', A: 98, B: 130, fullMark: 150 },
  { subject: 'Payload', A: 86, B: 130, fullMark: 150 },
  { subject: 'Depth', A: 140, B: 100, fullMark: 150 },
  { subject: 'Maneuver', A: 85, B: 90, fullMark: 150 },
];

const INITIAL_STATE: AppState = {
  title: 'RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 01',
  abstract: 'The MDBC Mapping team will conduct UUV missions to collect synthetic aperture sonar data using the REMUS 620 platform.',
  purpose: 'This data is available to the public for a wide variety of uses including scientific research and analysis.',
  doi: '',
  accession: '',
  org: 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES',
  email: 'errol.ronje@noaa.gov',
  maintenanceFrequency: 'As Needed',
  west: -87.12,
  east: -87.24,
  south: 29.89,
  north: 29.95,
  uxsContext: 'Dive',
  uxsOutcome: 'Completed',
  platform: null,
  sensors: []
};

const STEPS: Step[] = [
  { id: 'mission', label: 'Mission', icon: <FileText size={18} /> },
  { id: 'platform', label: 'Platform', icon: <Database size={18} /> },
  { id: 'sensors', label: 'Sensors', icon: <Sparkles size={18} /> },
  { id: 'spatial', label: 'Spatial', icon: <MapIcon size={18} /> },
  { id: 'keywords', label: 'Keywords', icon: <Tag size={18} /> },
  { id: 'distribution', label: 'Distribution', icon: <Share2 size={18} /> },
];

export default function App() {
  const [step, setStep] = useState<StepId | 'dashboard'>('mission');
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [activeField, setActiveField] = useState<keyof AppState | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [t2Valid, setT2Valid] = useState(false);
  const [t3Valid, setT3Valid] = useState(false);
  const [showErrorSummary, setShowErrorSummary] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ insight: string; suggestion: string } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock dashboard records
  const [records, setRecords] = useState<AppState[]>([INITIAL_STATE]);

  // Validation System
  useEffect(() => {
    const newErrors: ValidationError[] = [];

    // T2: Schema Compliance (Mandatory Fields)
    const mandatoryFields: (keyof AppState)[] = ['title', 'abstract', 'doi', 'accession'];
    mandatoryFields.forEach(f => {
      if (!state[f]) {
        newErrors.push({
          field: f,
          message: `${FIELD_MAPPING[f].label} is mandatory for ISO compliance`,
          tier: 'T2'
        });
      }
    });

    // T3: Business Rules & API readiness
    if (state.org && !state.org.includes('NOAA')) {
      newErrors.push({
        field: 'org',
        message: 'Organization must specify a NOAA branch for CoMET integration',
        tier: 'T3'
      });
    }

    if (state.north <= state.south) {
      newErrors.push({
        field: 'north',
        message: 'Spatial inconsistency: North must be > South',
        tier: 'T3'
      });
    }

    setErrors(newErrors);
    setT2Valid(!newErrors.some(e => e.tier === 'T2'));
    setT3Valid(!newErrors.some(e => e.tier === 'T3'));
  }, [state]);

  // Debounced AI calculation for insights
  useEffect(() => {
    if (!activeField || (activeField !== 'abstract' && activeField !== 'title')) {
      setAiInsight(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingAi(true);
      const res = await getSymbioteSuggestion({
        field: activeField,
        value: state[activeField] as string,
        title: state.title,
        abstract: state.abstract
      });
      if (res) setAiInsight(res);
      setLoadingAi(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [state.abstract, state.title, activeField]);

  const handleInputChange = (field: keyof AppState, value: any) => {
    setState(prev => ({ ...prev, [field]: value }));
  };

  const handlePlatformSelect = (platformKey: string) => {
    setState(prev => ({ ...prev, platform: PLATFORM_LIBRARY[platformKey] }));
  };

  const addSensorFromLibrary = (libSensor: typeof SENSOR_LIBRARY[0]) => {
    const newSensor: Sensor = {
      id: `S-${Date.now()}`,
      ...libSensor,
      sn: `SN-${Math.floor(Math.random() * 10000)}`
    };
    setState(prev => ({ ...prev, sensors: [...prev.sensors, newSensor] }));
  };

  const removeSensor = (id: string) => {
    setState(prev => ({ ...prev, sensors: prev.sensors.filter(s => s.id !== id) }));
  };

  const filteredRecords = records.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.platform?.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.sensors.some(s => s.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const applyMagicFix = () => {
    if (aiInsight && activeField) {
      handleInputChange(activeField, aiInsight.suggestion);
      setAiInsight(null);
    }
  };

  const navigateToField = (field: keyof AppState | string) => {
    const mapping = FIELD_MAPPING[field];
    if (mapping) {
      setStep(mapping.step);
      setActiveField(field as keyof AppState);
      // Optional: scroll to field logic could go here
    }
  };

  const getFieldValidation = (field: keyof AppState) => {
    return errors.find(e => e.field === field);
  };

  const currentStepErrors = errors.filter(e => {
    const mapping = FIELD_MAPPING[e.field];
    return mapping && mapping.step === step;
  });

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-300 font-sans selection:bg-teal-500/30 flex flex-col overflow-hidden">
      {/* HEADER BAR */}
      <header className="h-16 border-b border-slate-800 bg-[#161b22] sticky top-0 z-50 px-8 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setStep('mission')}>
             <div className="relative flex items-center justify-center">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="w-8 h-8 bg-teal-400 rounded-full blur-md absolute shadow-[0_0_15px_rgba(0,206,209,0.5)]" 
                />
                <Zap className="text-[#0d1117] relative z-10 w-4 h-4" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-white uppercase">
                MANTA<span className="text-teal-400 font-light ml-1">LENS</span>
             </h1>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search records..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0d1117] border border-slate-700 rounded-full pl-10 pr-4 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-400 transition-all w-64"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setStep('dashboard')}
            className={cn(
              "px-4 py-2 text-[10px] font-bold transition flex items-center gap-2 uppercase tracking-widest",
              step === 'dashboard' ? "text-teal-400" : "text-slate-400 hover:text-white"
            )}
          >
            Dashboard
          </button>
          <div className="flex gap-4">
            <button 
              onClick={() => setState(INITIAL_STATE)}
              className="px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-white transition flex items-center gap-2 uppercase tracking-widest"
            >
              <RefreshCw size={12} /> Reset
            </button>
            <button 
              onClick={() => {
                setRecords(prev => [state, ...prev]);
                alert('Record Saved locally. Check Dashboard.');
              }}
              className="px-6 py-2 bg-teal-400 hover:bg-teal-300 text-[#0d1117] rounded-md text-[10px] font-black tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(0,206,209,0.3)] active:scale-95"
            >
              Save Record
            </button>
          </div>
        </div>
      </header>

      {/* PROGRESS NAVIGATION */}
      <nav className="h-14 flex items-center justify-center gap-1 bg-[#090c10] border-b border-slate-800 px-8">
        <div className="flex-1 flex justify-between max-w-4xl h-full">
          {STEPS.map((s, idx) => {
            const isActive = step === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex items-center gap-2 px-4 h-full transition-all duration-300 relative group",
                  isActive 
                    ? "text-teal-400 border-b-2 border-teal-400" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <span className="text-xs font-bold font-mono">0{idx + 1}</span>
                <span className="text-[11px] uppercase tracking-wider font-medium">{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* STEP CONTENT: THE GUIDED WIZARD */}
        <section className={cn(
          "p-8 overflow-y-auto flex flex-col gap-8 border-r border-slate-800 bg-[#0d1117]",
          step === 'dashboard' ? "col-span-12" : "col-span-12 lg:col-span-7"
        )}>
          {step === 'dashboard' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h2 className="text-3xl font-light text-white tracking-tight">Records <span className="text-slate-500">Dashboard</span></h2>
              <div className="grid gap-4">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((r, i) => (
                    <div key={i} className="bg-[#161b22] border border-slate-800 p-6 rounded-2xl flex justify-between items-center group transition hover:border-teal-500/50">
                      <div>
                        <h4 className="font-bold text-white mb-1">{r.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-1">{r.abstract}</p>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => { setState(r); setStep('mission'); }} className="text-xs font-bold text-teal-400 hover:underline">Edit</button>
                        <button onClick={() => setRecords(prev => prev.filter((_, idx) => idx !== i))} className="text-xs font-bold text-red-500 hover:underline">Delete</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-slate-600">No records found matching search query.</div>
                )}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div 
                key={step}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-8"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-light text-white tracking-tight">
                    {STEPS.find(s => s.id === step)?.label} <span className="text-slate-500">Configuration</span>
                  </h2>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700 font-mono">ISO 19115-2 / GMI</span>
                </div>

                {step === 'mission' && (
                  <div className="space-y-8">
                    <div className="flex justify-between items-center bg-[#161b22] px-6 py-4 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Metadata Standard</span>
                      <span className="text-[10px] font-mono text-teal-400 bg-teal-400/10 px-3 py-1 rounded border border-teal-400/20">ISO 19115-2:2015</span>
                    </div>

                    {/* UXS Operational Context */}
                    <div className="bg-teal-900/10 border border-teal-500/20 p-6 rounded-lg relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-teal-400/50" />
                      <label className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em] block mb-4">UxS Operational Context</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Primary Layer</span>
                          <div className="relative group/select">
                            <select 
                              className="w-full bg-[#0d1117] border border-slate-700 rounded px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400 outline-none transition appearance-none cursor-pointer"
                              value={state.uxsContext}
                              onChange={(e) => handleInputChange('uxsContext', e.target.value)}
                            >
                              <option>Dive</option>
                              <option>Run</option>
                              <option>Deployment</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Outcome</span>
                          <div className="relative">
                            <select 
                              className="w-full bg-[#0d1117] border border-slate-700 rounded px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400 outline-none transition appearance-none cursor-pointer"
                              value={state.uxsOutcome}
                              onChange={(e) => handleInputChange('uxsOutcome', e.target.value)}
                            >
                              <option>Completed</option>
                              <option>Partial</option>
                              <option>Aborted</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400 pointer-events-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Deployment ID</span>
                          <input 
                            type="text" 
                            className="w-full bg-[#0d1117] border border-slate-700 rounded px-4 py-2.5 text-sm text-slate-200 focus:border-teal-400 outline-none transition"
                            defaultValue="MDBC_2025_01"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2 relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Official Title</label>
                        <div className="relative">
                          <input 
                            className={cn(
                              "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none transition-all",
                              getFieldValidation('title') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                            )}
                            value={state.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            onFocus={() => setActiveField('title')}
                          />
                          {getFieldValidation('title') && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 group/err">
                              <AlertCircle size={16} className="animate-pulse" />
                              <div className="absolute right-0 bottom-full mb-2 w-48 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                {getFieldValidation('title')?.message}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Abstract</label>
                        <div className="relative">
                          <textarea 
                            className={cn(
                              "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white h-32 resize-none outline-none leading-relaxed transition-all",
                              getFieldValidation('abstract') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                            )}
                            value={state.abstract}
                            onChange={(e) => handleInputChange('abstract', e.target.value)}
                            onFocus={() => setActiveField('abstract')}
                          />
                          {getFieldValidation('abstract') && (
                            <div className="absolute right-4 top-4 text-red-500 group/err">
                              <AlertCircle size={16} className="animate-pulse" />
                              <div className="absolute right-0 bottom-full mb-2 w-48 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                {getFieldValidation('abstract')?.message}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* SYMBIOTE OVERLAY BOX (EXISTING LOGIC) */}
                        <AnimatePresence>
                          {activeField === 'abstract' && aiInsight && (
                            <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="absolute -right-4 top-10 w-72 bg-teal-900/90 backdrop-blur-md border border-teal-400 p-5 rounded-lg shadow-2xl z-50 transition-all"
                            >
                               <div className="flex items-center gap-2 text-teal-400 font-bold text-[10px] mb-3 uppercase tracking-widest">✨ SYMBIOTE INSIGHT</div>
                               <p className="text-xs text-slate-200 mb-4 leading-relaxed">{aiInsight.insight}</p>
                               <button onClick={applyMagicFix} className="w-full py-2 bg-teal-400 text-[#0d1117] text-[10px] font-bold rounded uppercase tracking-widest">Apply Architecture Fix</button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}

                {step === 'platform' && (
                  <div className="space-y-8">
                    <div className="bg-[#161b22] p-6 rounded-2xl border border-slate-800">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-4">The Library Hub</label>
                      <div className="flex gap-4">
                        <select 
                          className="flex-1 bg-[#0d1117] border border-slate-700 rounded px-4 py-3 text-sm text-white focus:border-teal-400 outline-none"
                          onChange={(e) => handlePlatformSelect(e.target.value)}
                        >
                          <option value="">Select Platform...</option>
                          {Object.keys(PLATFORM_LIBRARY).map(key => (
                            <option key={key} value={key}>{key}</option>
                          ))}
                        </select>
                        <button className="px-6 bg-slate-800 text-teal-400 border border-slate-700 rounded-lg text-xs font-bold font-mono">SCAN REGISTRY</button>
                      </div>
                    </div>

                    {state.platform && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Manufacturer', value: state.platform.manufacturer },
                            { label: 'Model', value: state.platform.model },
                            { label: 'Platform ID', value: state.platform.id },
                            { label: 'Max Speed', value: state.platform.maxSpeed }
                          ].map(item => (
                            <div key={item.label} className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                              <span className="text-[8px] uppercase tracking-widest text-slate-600 block mb-1">{item.label}</span>
                              <span className="text-sm font-bold text-slate-300">{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900/60 rounded-2xl border border-slate-800">
                           <div className="space-y-4">
                             <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Physical Specifications</h4>
                             <div className="grid grid-cols-2 gap-4">
                               {['Weight', 'Length', 'Width', 'Height'].map(field => (
                                 <div key={field}>
                                   <label className="text-[9px] text-slate-600 uppercase mb-1 block">{field}</label>
                                   <input readOnly value={(state.platform as any)[field.toLowerCase()]} className="w-full bg-[#0d1117] border border-slate-800 rounded p-2 text-xs text-slate-400" />
                                 </div>
                               ))}
                             </div>
                           </div>
                           <div className="space-y-4">
                             <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Operational</h4>
                             <div className="space-y-3">
                               <div>
                                 <label className="text-[9px] text-slate-600 uppercase mb-1 block">Power Source</label>
                                 <input readOnly value={state.platform.powerSource} className="w-full bg-[#0d1117] border border-slate-800 rounded p-2 text-xs text-slate-400" />
                               </div>
                               <div>
                                 <label className="text-[9px] text-slate-600 uppercase mb-1 block">Navigation System</label>
                                 <input readOnly value={state.platform.navigation} className="w-full bg-[#0d1117] border border-slate-800 rounded p-2 text-xs text-slate-400" />
                               </div>
                             </div>
                           </div>
                        </div>
                        <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800 mt-4">
                           <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-6">Capabilities Benchmark</h4>
                           <div className="h-[300px] w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <RadarChart cx="50%" cy="50%" outerRadius="80%" data={PLATFORM_PERFORMANCE}>
                                 <PolarGrid stroke="#1e293b" />
                                 <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                                 <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                                 <Radar
                                   name="Platform Specs"
                                   dataKey="A"
                                   stroke="#2dd4bf"
                                   fill="#2dd4bf"
                                   fillOpacity={0.6}
                                 />
                                 <Tooltip 
                                    contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px', color: '#2dd4bf' }}
                                 />
                               </RadarChart>
                             </ResponsiveContainer>
                           </div>
                           <p className="mt-4 text-center text-[10px] text-slate-500 italic uppercase tracking-widest">Synthetic Performance Profile vs Fleet Average</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {step === 'sensors' && (
                  <div className="space-y-8">
                     <div className="flex justify-between items-center bg-[#161b22] p-6 rounded-2xl border border-slate-800">
                        <div>
                          <h4 className="text-lg font-light text-white">Sensor <span className="text-slate-500">Suite</span></h4>
                          <p className="text-[10px] text-slate-600 uppercase font-mono mt-1">Pinging GCMD for active instrument classes...</p>
                        </div>
                        <div className="relative group">
                          <button className="flex items-center gap-3 px-6 py-3 bg-teal-400/10 border border-teal-400/30 text-teal-400 rounded-xl text-xs font-black uppercase tracking-widest transition hover:bg-teal-400 hover:text-slate-950">
                            <Sparkles size={14} /> Add from Library
                          </button>
                          <div className="absolute right-0 top-full mt-2 w-72 bg-[#161b22] border border-slate-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 p-2">
                             {SENSOR_LIBRARY.map((s, idx) => (
                               <button 
                                 key={idx}
                                 onClick={() => addSensorFromLibrary(s)}
                                 className="w-full text-left p-3 hover:bg-slate-800 rounded-lg transition group/item"
                               >
                                 <div className="text-xs font-bold text-white group-hover/item:text-teal-400">{s.type}</div>
                                 <div className="text-[10px] text-slate-500 mt-1">{s.manufacturer} · {s.model}</div>
                               </button>
                             ))}
                          </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AnimatePresence>
                          {state.sensors.map(sensor => (
                            <motion.div 
                              key={sensor.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 relative group overflow-hidden"
                            >
                               <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition">
                                 <button onClick={() => removeSensor(sensor.id)} className="text-red-500 hover:text-red-400 uppercase text-[10px] font-black">Remove</button>
                               </div>
                               <div className="flex gap-4 items-center mb-6 border-b border-slate-800 pb-4">
                                  <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-teal-400 border border-slate-800">
                                    <Zap size={20} />
                                  </div>
                                  <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-widest font-mono">{sensor.id}</div>
                                    <div className="text-sm font-bold text-white uppercase">{sensor.type}</div>
                                  </div>
                               </div>
                               <div className="grid grid-cols-2 gap-6">
                                  <div>
                                    <span className="text-[9px] text-slate-600 uppercase block mb-1">Manufacturer</span>
                                    <span className="text-xs text-slate-300 font-bold">{sensor.manufacturer}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-600 uppercase block mb-1">Model</span>
                                    <span className="text-xs text-slate-300 font-bold">{sensor.model}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-600 uppercase block mb-1">Variable</span>
                                    <span className="text-xs text-teal-500/80 font-bold">{sensor.observedVariable}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-600 uppercase block mb-1">SN</span>
                                    <span className="text-xs text-slate-400 font-mono italic">{sensor.sn}</span>
                                  </div>
                               </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                     </div>
                  </div>
                )}

                {step === 'spatial' && (
                  <div className="space-y-8">
                    <div className="bg-slate-900/60 p-8 rounded-2xl border border-slate-800 relative">
                       <MapIcon className="absolute top-6 right-6 text-teal-400/20 w-32 h-32 -z-10" />
                       <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-[0.2em] mb-8">Spatial Bounding Box</h4>
                       
                       <div className="max-w-md mx-auto grid grid-cols-3 gap-4">
                          <div />
                          <div className="flex flex-col items-center gap-2">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">North</span>
                             <div className="relative group/field">
                               <input 
                                  type="number" 
                                  step="0.01"
                                  value={state.north}
                                  onChange={(e) => handleInputChange('north', parseFloat(e.target.value))}
                                  className={cn(
                                    "w-32 bg-[#161b22] border border-slate-700 rounded p-3 text-center text-sm text-white focus:border-teal-400 outline-none transition-all",
                                    getFieldValidation('north') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                  )}
                               />
                               {getFieldValidation('north') && (
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                   <AlertCircle size={14} className="animate-pulse" />
                                   <div className="absolute right-0 bottom-full mb-2 w-32 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                     {getFieldValidation('north')?.message}
                                   </div>
                                 </div>
                               )}
                             </div>
                          </div>
                          <div />

                          <div className="flex flex-col items-center gap-2">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">West</span>
                             <div className="relative group/field">
                               <input 
                                  type="number" 
                                  step="0.01"
                                  value={state.west}
                                  onChange={(e) => handleInputChange('west', parseFloat(e.target.value))}
                                  className={cn(
                                    "w-32 bg-[#161b22] border border-slate-700 rounded p-3 text-center text-sm text-white focus:border-teal-400 outline-none transition-all",
                                    getFieldValidation('west') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                  )}
                               />
                               {getFieldValidation('west') && (
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                   <AlertCircle size={14} className="animate-pulse" />
                                   <div className="absolute right-0 bottom-full mb-2 w-32 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                     {getFieldValidation('west')?.message}
                                   </div>
                                 </div>
                               )}
                             </div>
                          </div>
                          <div className="flex items-center justify-center">
                             <div className="w-12 h-12 border-2 border-dashed border-slate-800 rounded-lg" />
                          </div>
                          <div className="flex flex-col items-center gap-2">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">East</span>
                             <div className="relative group/field">
                               <input 
                                  type="number" 
                                  step="0.01"
                                  value={state.east}
                                  onChange={(e) => handleInputChange('east', parseFloat(e.target.value))}
                                  className={cn(
                                    "w-32 bg-[#161b22] border border-slate-700 rounded p-3 text-center text-sm text-white focus:border-teal-400 outline-none transition-all",
                                    getFieldValidation('east') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                  )}
                               />
                               {getFieldValidation('east') && (
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                   <AlertCircle size={14} className="animate-pulse" />
                                   <div className="absolute right-0 bottom-full mb-2 w-32 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                     {getFieldValidation('east')?.message}
                                   </div>
                                 </div>
                               )}
                             </div>
                          </div>

                          <div />
                          <div className="flex flex-col items-center gap-2">
                             <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">South</span>
                             <div className="relative group/field">
                               <input 
                                  type="number" 
                                  step="0.01"
                                  value={state.south}
                                  onChange={(e) => handleInputChange('south', parseFloat(e.target.value))}
                                  className={cn(
                                    "w-32 bg-[#161b22] border border-slate-700 rounded p-3 text-center text-sm text-white focus:border-teal-400 outline-none transition-all",
                                    getFieldValidation('south') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                  )}
                               />
                               {getFieldValidation('south') && (
                                 <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                   <AlertCircle size={14} className="animate-pulse" />
                                   <div className="absolute right-0 bottom-full mb-2 w-32 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                     {getFieldValidation('south')?.message}
                                   </div>
                                 </div>
                               )}
                             </div>
                          </div>
                          <div />
                       </div>
                       <p className="mt-8 text-center text-[10px] text-slate-500 italic">Values expected in Decimal Degrees (WGS84)</p>
                    </div>
                  </div>
                )}

                {step === 'keywords' && (
                   <div className="space-y-8">
                      <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800">
                         <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-6">Controlled Vocabulary (GCMD)</h4>
                         <div className="flex flex-wrap gap-3">
                            {['OCEANS', 'BATHYMETRY/SEAFLOOR TOPOGRAPHY', 'SONAR', 'UNMANNED UNDERWATER VEHICLES', 'REMUS 620'].map(tag => (
                               <div key={tag} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-full group hover:border-teal-500/50 transition">
                                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-teal-400">{tag}</span>
                                  <button className="text-slate-600 hover:text-red-500"><XCircle size={12} /></button>
                               </div>
                            ))}
                            <button className="px-4 py-2 border border-dashed border-teal-500/30 text-teal-400 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-teal-400/5 transition">
                               + Add Keyword
                            </button>
                         </div>
                      </div>

                      <div className="p-8 bg-slate-900/40 rounded-2xl border border-slate-800">
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Thematic Categories</h4>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['Oceans', 'Imagery', 'Inland Waters', 'Location'].map(cat => (
                               <div key={cat} className="flex items-center gap-3 p-4 bg-[#0d1117] border border-slate-800 rounded-xl cursor-not-allowed opacity-50">
                                  <div className="w-2 h-2 rounded-full bg-teal-500" />
                                  <span className="text-xs font-bold text-slate-400">{cat}</span>
                               </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-[#161b22] p-8 rounded-2xl border border-slate-800 mt-4">
                        <h4 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-6">Suite Analytical Matrix</h4>
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={SENSOR_METRICS}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                              <YAxis hide />
                              <Tooltip 
                                 cursor={{ fill: 'transparent' }}
                                 contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1e293b', borderRadius: '8px' }}
                                 itemStyle={{ fontSize: '12px', color: '#2dd4bf' }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {SENSOR_METRICS.map((_entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#2dd4bf' : '#0d9488'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-4">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#2dd4bf]" />
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Primary Metric</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-[#0d9488]" />
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Secondary Metric</span>
                           </div>
                        </div>
                      </div>
                   </div>
                )}

                {step === 'distribution' && (
                  <div className="space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                           <div className="space-y-2 relative">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Responsible Organization</label>
                              <div className="relative">
                                <input 
                                   className={cn(
                                     "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none capitalize",
                                     getFieldValidation('org') && "border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                                   )}
                                   value={state.org}
                                   onChange={(e) => handleInputChange('org', e.target.value)}
                                />
                                {getFieldValidation('org') && (
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 group/err">
                                    <AlertCircle size={16} className="animate-pulse" />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-amber-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                      {getFieldValidation('org')?.message}
                                    </div>
                                  </div>
                                )}
                              </div>
                           </div>
                           <div className="space-y-2 relative">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Point of Contact Email</label>
                              <div className="relative">
                                <input 
                                   className={cn(
                                     "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none",
                                     getFieldValidation('email') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                   )}
                                   value={state.email}
                                   onChange={(e) => handleInputChange('email', e.target.value)}
                                />
                                {getFieldValidation('email') && (
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                    <AlertCircle size={16} className="animate-pulse" />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                      {getFieldValidation('email')?.message}
                                    </div>
                                  </div>
                                )}
                              </div>
                           </div>
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-2 relative">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Digital Object Identifier (DOI)</label>
                              <div className="relative">
                                <input 
                                   placeholder="e.g. 10.25921/xyz-123"
                                   className={cn(
                                     "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none",
                                     getFieldValidation('doi') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                   )}
                                   value={state.doi}
                                   onChange={(e) => handleInputChange('doi', e.target.value)}
                                />
                                {getFieldValidation('doi') && (
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                    <AlertCircle size={16} className="animate-pulse" />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                      {getFieldValidation('doi')?.message}
                                    </div>
                                  </div>
                                )}
                              </div>
                           </div>
                           <div className="space-y-2 relative">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">NCEI Accession ID</label>
                              <div className="relative">
                                <input 
                                   placeholder="e.g. 0284912"
                                   className={cn(
                                     "w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none",
                                     getFieldValidation('accession') && "border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                                   )}
                                   value={state.accession}
                                   onChange={(e) => handleInputChange('accession', e.target.value)}
                                />
                                {getFieldValidation('accession') && (
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 group/err">
                                    <AlertCircle size={16} className="animate-pulse" />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-red-900/90 text-white text-[10px] p-2 rounded opacity-0 group-hover/err:opacity-100 transition-opacity pointer-events-none z-50">
                                      {getFieldValidation('accession')?.message}
                                    </div>
                                  </div>
                                )}
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest ml-1">Maintenance Frequency</label>
                              <div className="relative">
                                <select 
                                  className="w-full bg-[#161b22] border border-slate-700 rounded p-4 text-sm text-white focus:border-teal-400 outline-none appearance-none cursor-pointer"
                                  value={state.maintenanceFrequency}
                                  onChange={(e) => handleInputChange('maintenanceFrequency', e.target.value)}
                                >
                                  {['As Needed', 'Annually', 'Bi-Annually', 'Continually'].map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-400 pointer-events-none" />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl">
                        <div className="flex items-start gap-4">
                           <AlertTriangle className="text-amber-400 mt-1" size={20} />
                           <div>
                              <h5 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-1">Curation Policy Reminder</h5>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                 The organization and email provided above will be listed as the primary metadata contacts. 
                                 Ensure these match the approved NCEI project management plan protocols.
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {/* RIGHT PANELS: PREVIEW & VALIDATION */}
        {step !== 'dashboard' && (
          <section className="col-span-12 lg:col-span-5 bg-[#010409] flex flex-col h-full overflow-hidden">
            
            {/* ISO 19115 PREVIEW */}
            <div className="flex-1 flex flex-col overflow-hidden relative group">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#161b22]/50">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Live ISO XML Preview</span>
                <span className="text-[9px] text-slate-500 font-mono hidden group-hover:block animate-pulse">⚡ SYMMETRIC MAPPING ACTIVE</span>
              </div>
              
              <div className="flex-1 p-6 font-mono text-[11px] text-teal-500/80 overflow-auto bg-[#010409] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <div className="text-slate-600">&lt;gmi:MI_Metadata xmlns:gmi="..."&gt;</div>
                <div className="pl-4 text-slate-600">&lt;gmd:fileIdentifier&gt;</div>
                <div className="pl-8 text-teal-400">&lt;gco:CharacterString&gt;gov.noaa.ncei.uxs:{state.accession || '2025_01'}&lt;/gco:CharacterString&gt;</div>
                <div className="pl-4 text-slate-600">&lt;/gmd:fileIdentifier&gt;</div>
                <div className="pl-4 text-slate-600">&lt;gmd:identificationInfo&gt;</div>
                <div className="pl-8 text-slate-600">&lt;gmd:MD_DataIdentification&gt;</div>
                <div className="pl-12 text-slate-600">&lt;gmd:citation&gt;</div>
                <div className="pl-16 text-slate-600">&lt;gmd:title&gt;</div>
                <div 
                  onClick={() => navigateToField('title')}
                  className={cn(
                    "pl-20 py-0.5 rounded cursor-pointer transition-colors",
                    getFieldValidation('title') ? "bg-red-500/10 text-red-400 border-l border-red-500/50" : "text-white hover:bg-white/5"
                  )}
                >
                  &lt;gco:CharacterString&gt;{state.title || '[MISSING]'}&lt;/gco:CharacterString&gt;
                </div>
                <div className="pl-16 text-slate-600">&lt;/gmd:title&gt;</div>
                <div className="pl-12 text-slate-600">&lt;/gmd:citation&gt;</div>
                <div className="pl-12 text-slate-600">&lt;gmd:abstract&gt;</div>
                <div 
                  onClick={() => navigateToField('abstract')}
                  className={cn(
                    "pl-16 py-0.5 rounded cursor-pointer transition-colors leading-loose",
                    getFieldValidation('abstract') ? "bg-red-500/10 text-red-400 border-l border-red-500/50" : "text-white hover:bg-white/5"
                  )}
                >
                  &lt;gco:CharacterString&gt;{state.abstract || '[MISSING_ABSTRACT]'}&lt;/gco:CharacterString&gt;
                </div>
                <div className="pl-12 text-slate-600">&lt;/gmd:abstract&gt;</div>
                {state.platform && (
                  <div className="pl-12 text-teal-500/50">
                    &lt;gmi:acquisitionInformation&gt;
                      &lt;gmi:platform&gt;
                        &lt;gmi:identifier&gt;{state.platform.id}&lt;/gmi:identifier&gt;
                      &lt;/gmi:platform&gt;
                    &lt;/gmi:acquisitionInformation&gt;
                  </div>
                )}
                <div className="pl-8 text-slate-600">&lt;/gmd:MD_DataIdentification&gt;</div>
                <div className="pl-4 text-slate-600">&lt;/gmd:identificationInfo&gt;</div>
                <div className="text-slate-600">&lt;/gmi:MI_Metadata&gt;</div>
              </div>
            </div>

            {/* VALIDATION STATUS HUB */}
            <div className={cn(
              "p-6 bg-[#0d1117] border-t border-slate-800 space-y-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transition-all duration-300",
              showErrorSummary ? "h-[400px]" : "h-auto"
            )}>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Validation Status</span>
                <div className="flex gap-2">
                  <div title="T1: XML well-formedness" className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-bold uppercase tracking-tight cursor-help">T1: WELL-FORMED ✅</div>
                  <div 
                    title="T2: ISO 19139 schema compliance"
                    onClick={() => setShowErrorSummary(!showErrorSummary)}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tight border transition-colors cursor-pointer",
                      t2Valid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-500"
                    )}
                  >
                    T2: ISO STRICT {t2Valid ? '✅' : '❌'}
                  </div>
                  <div 
                    title="T3: CoMET business rules"
                    onClick={() => setShowErrorSummary(!showErrorSummary)}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tight border transition-colors cursor-pointer",
                      t3Valid ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    )}
                  >
                    T3: COMET API {t3Valid ? '✅' : '🟡'}
                  </div>
                </div>
              </div>

              {showErrorSummary && (
                <div className="space-y-4 max-h-[220px] overflow-auto pr-2 custom-scrollbar">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Diagnostic Summary ({errors.length})</h4>
                  {errors.length > 0 ? (
                    errors.map((e, i) => (
                      <div 
                        key={i} 
                        onClick={() => navigateToField(e.field)}
                        className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer group"
                      >
                        <AlertCircle size={14} className={e.tier === 'T2' ? "text-red-500" : "text-amber-500"} />
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-[10px] font-bold text-slate-300 uppercase letter-spacing-1">{FIELD_MAPPING[e.field]?.label || e.field}</span>
                            <span className="text-[9px] font-mono text-slate-500">[{e.tier}]</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug mt-1">{e.message}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-700 group-hover:text-teal-400 transition-colors" />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 opacity-50">
                      <CheckCircle size={32} className="text-emerald-500 mb-2" />
                      <span className="text-xs uppercase tracking-widest">Awaiting Submission</span>
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={() => {
                  if (t2Valid) {
                    // Logic to save/push
                    setRecords(prev => [...prev, state]);
                    alert('Metadata successfully pushed to CoMET API pipeline.');
                  } else {
                    setShowErrorSummary(!showErrorSummary);
                  }
                }}
                className={cn(
                  "w-full py-4 rounded-lg font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 relative group overflow-hidden shadow-[0_0_30px_rgba(0,206,209,0.15)]",
                  t2Valid 
                    ? "bg-teal-400 text-[#0d1117] hover:bg-teal-300 hover:scale-[1.01] active:scale-95 shadow-[0_0_30px_rgba(0,206,209,0.25)]" 
                    : "bg-slate-800 text-slate-600 hover:text-slate-300 shadow-none border border-slate-700"
                )}
              >
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10 flex items-center justify-center gap-3">
                  {t2Valid ? 'Finalize & Push to CoMET' : (showErrorSummary ? 'Close Diagnostics' : 'Resolve Protocol Gaps')}
                  {t2Valid ? <Zap size={14} fill="currentColor" /> : <ChevronDown size={14} className={cn("transition-transform", showErrorSummary && "rotate-180")} />}
                </span>
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="h-8 bg-[#090c10] border-t border-slate-800 flex items-center px-8 justify-between text-[10px] text-slate-600 font-medium">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span>Session:</span>
            <span className="text-slate-400 font-bold uppercase tracking-tighter">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Cloud:</span>
            <span className="text-emerald-500 font-bold uppercase tracking-tighter">Connected</span>
          </div>
        </div>
        <div className="font-mono uppercase tracking-[0.2em] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
          System Diagnostics: <span className="text-teal-500 font-bold">Operational</span>
        </div>
      </footer>
    </div>
  );
}
